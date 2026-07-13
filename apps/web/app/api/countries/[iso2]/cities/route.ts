import { getCountryCities } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ iso2: string }> }) {
  const { iso2 } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
  const cities = await getCountryCities(getUserId(req), iso2.toUpperCase(), limit);
  return Response.json({ cities });
}
