import { createVisit, type CreateVisitInput } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<CreateVisitInput> | null;
  if (!body || typeof body.placeId !== "number") {
    return Response.json({ error: "placeId (number) is required" }, { status: 400 });
  }
  const summary = await createVisit(getUserId(req), {
    placeId: body.placeId,
    arrivedAt: body.arrivedAt ?? null,
    departedAt: body.departedAt ?? null,
    purpose: body.purpose,
    note: body.note ?? null,
  });
  return Response.json(summary);
}
