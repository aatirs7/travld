import { createTrip, getTrips } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const trips = await getTrips(getUserId(req));
  return Response.json({ trips });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { title?: string; startDate?: string | null; endDate?: string | null }
    | null;
  if (!body?.title?.trim()) {
    return Response.json({ error: "title required" }, { status: 400 });
  }
  const id = await createTrip(getUserId(req), body.title.trim(), body.startDate, body.endDate);
  return Response.json({ id });
}
