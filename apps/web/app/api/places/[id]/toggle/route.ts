import { togglePlaceVisit } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const placeId = Number(id);
  if (!Number.isInteger(placeId)) {
    return Response.json({ error: "invalid place id" }, { status: 400 });
  }
  const result = await togglePlaceVisit(getUserId(req), placeId);
  return Response.json(result);
}
