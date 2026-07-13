import { getVisitedCountries } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const summary = await getVisitedCountries(getUserId(req));
  return Response.json(summary);
}
