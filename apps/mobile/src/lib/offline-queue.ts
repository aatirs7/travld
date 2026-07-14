import { createMMKV } from "react-native-mmkv";
import { BASE_URL } from "./config";

/**
 * Offline write queue. Visits (and other mutations) created without signal are
 * persisted to MMKV and replayed on reconnect. Reads are never queued.
 * See the open-items note in the spec: "visits created without signal must sync."
 */
const KEY = "pending";

// Lazy: don't touch the native module at import time, so a storage init issue
// can never crash app startup — the queue just degrades to a no-op.
let _storage: ReturnType<typeof createMMKV> | null = null;
function store(): ReturnType<typeof createMMKV> | null {
  if (_storage) return _storage;
  try {
    _storage = createMMKV({ id: "travld-offline-queue" });
  } catch {
    _storage = null;
  }
  return _storage;
}

export interface QueuedRequest {
  method: string;
  path: string;
  body?: unknown;
  queuedAt: number;
}

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

function read(): QueuedRequest[] {
  const s = store()?.getString(KEY);
  if (!s) return [];
  try {
    return JSON.parse(s) as QueuedRequest[];
  } catch {
    return [];
  }
}

function write(q: QueuedRequest[]): void {
  store()?.set(KEY, JSON.stringify(q));
  for (const l of listeners) l(q.length);
}

export function pendingCount(): number {
  return read().length;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  l(read().length);
  return () => listeners.delete(l);
}

export function enqueue(req: Omit<QueuedRequest, "queuedAt">): void {
  write([...read(), { ...req, queuedAt: Date.now() }]);
}

let flushing = false;

/** Replay queued mutations in order. Stops (keeps the queue) on network failure. */
export async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    let queue = read();
    while (queue.length > 0) {
      const req = queue[0]!;
      try {
        const res = await fetch(`${BASE_URL}${req.path}`, {
          method: req.method,
          headers: { "Content-Type": "application/json" },
          body: req.body != null ? JSON.stringify(req.body) : undefined,
        });
        // 4xx = permanent (bad request); drop it. 5xx/ok = consume. Network error throws.
        if (!res.ok && res.status >= 500) throw new Error(`server ${res.status}`);
      } catch {
        return; // offline or server down — keep the queue, retry later
      }
      queue = queue.slice(1);
      write(queue);
    }
  } finally {
    flushing = false;
  }
}
