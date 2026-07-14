import { deleteTrip, getTripDetail, updateTrip } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const detail = await getTripDetail(getUserId(req), Number(id));
  if (!detail) return Response.json({ error: "trip not found" }, { status: 404 });
  return Response.json(detail);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    startDate?: string | null;
    endDate?: string | null;
  };
  await updateTrip(getUserId(req), Number(id), body);
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await deleteTrip(getUserId(req), Number(id));
  return Response.json({ ok: true });
}
