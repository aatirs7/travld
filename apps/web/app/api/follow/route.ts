import { followUser, unfollowUser } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { userId?: string } | null;
  if (!body?.userId) return Response.json({ error: "userId required" }, { status: 400 });
  await followUser(getUserId(req), body.userId);
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { userId?: string } | null;
  if (!body?.userId) return Response.json({ error: "userId required" }, { status: 400 });
  await unfollowUser(getUserId(req), body.userId);
  return Response.json({ ok: true });
}
