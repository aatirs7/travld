import { getSettings, setSettings } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const settings = await getSettings(getUserId(req));
  return Response.json({ settings });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as { includeTransit?: boolean } | null;
  const settings = await setSettings(getUserId(req), {
    includeTransit: body?.includeTransit,
  });
  return Response.json({ settings });
}
