import { setPushToken } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  if (!body?.token) return Response.json({ error: "token required" }, { status: 400 });
  await setPushToken(getUserId(req), body.token);
  return Response.json({ ok: true });
}
