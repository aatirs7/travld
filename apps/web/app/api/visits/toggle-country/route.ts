import { toggleCountryVisit } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { placeId?: number } | null;
  const placeId = body?.placeId;
  if (typeof placeId !== "number") {
    return Response.json({ error: "placeId (number) is required" }, { status: 400 });
  }
  const result = await toggleCountryVisit(getUserId(req), placeId);
  return Response.json(result);
}
