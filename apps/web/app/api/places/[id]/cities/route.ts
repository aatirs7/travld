import { getPlaceCities } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const placeId = Number(id);
  if (!Number.isInteger(placeId)) {
    return Response.json({ error: "invalid place id" }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
  const cities = await getPlaceCities(getUserId(req), placeId, limit);
  return Response.json({ cities });
}
