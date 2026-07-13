import { getCountryVisits } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ iso2: string }> }) {
  const { iso2 } = await ctx.params;
  const visits = await getCountryVisits(getUserId(req), iso2.toUpperCase());
  return Response.json({ visits });
}
