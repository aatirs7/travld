import { getRegionProgress } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const progress = await getRegionProgress(getUserId(req));
  return Response.json({ progress });
}
