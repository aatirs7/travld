import { setVisitTrip } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { tripId?: number | null } | null;
  await setVisitTrip(getUserId(req), Number(id), body?.tripId ?? null);
  return Response.json({ ok: true });
}
