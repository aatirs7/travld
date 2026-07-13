import { getCompare } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;
  const result = await getCompare(getUserId(req), userId);
  if (!result) return Response.json({ error: "user not found" }, { status: 404 });
  return Response.json(result);
}
