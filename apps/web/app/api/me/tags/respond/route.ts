import { respondTag } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { visitId?: number; accept?: boolean }
    | null;
  if (typeof body?.visitId !== "number" || typeof body?.accept !== "boolean") {
    return Response.json({ error: "visitId and accept required" }, { status: 400 });
  }
  await respondTag(getUserId(req), body.visitId, body.accept);
  return Response.json({ ok: true });
}
