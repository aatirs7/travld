import { createMMKV } from "react-native-mmkv";

// Small persistent key/value for local UI flags (e.g. "seen the how-to").
// Lazy + guarded so a storage issue never crashes startup.
let _s: ReturnType<typeof createMMKV> | null = null;
function store() {
  if (_s) return _s;
  try {
    _s = createMMKV({ id: "travld-flags" });
  } catch {
    _s = null;
  }
  return _s;
}

export function getFlag(key: string): boolean {
  try {
    return store()?.getBoolean(key) ?? false;
  } catch {
    return false;
  }
}

export function setFlag(key: string, value: boolean): void {
  try {
    store()?.set(key, value);
  } catch {
    /* no-op */
  }
}

export function getString(key: string): string | undefined {
  try {
    return store()?.getString(key);
  } catch {
    return undefined;
  }
}

export function setString(key: string, value: string): void {
  try {
    store()?.set(key, value);
  } catch {
    /* no-op */
  }
}
