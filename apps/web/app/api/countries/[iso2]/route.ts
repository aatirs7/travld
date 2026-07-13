import { getCountryDetail } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ iso2: string }> }) {
  const { iso2 } = await ctx.params;
  const detail = await getCountryDetail(getUserId(req), iso2.toUpperCase());
  if (!detail) return Response.json({ error: "country not found" }, { status: 404 });
  return Response.json(detail);
}
