import { tagUser } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { taggedUserId?: string } | null;
  if (!body?.taggedUserId) return Response.json({ error: "taggedUserId required" }, { status: 400 });
  await tagUser(getUserId(req), Number(id), body.taggedUserId);
  return Response.json({ ok: true });
}
