import { getVisitedPins } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const pins = await getVisitedPins(getUserId(req));
  return Response.json({ pins });
}
