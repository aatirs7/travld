import { getMapTheme, setMapTheme } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const theme = await getMapTheme(getUserId(req));
  return Response.json({ theme });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as { theme?: unknown } | null;
  const theme = await setMapTheme(getUserId(req), body?.theme);
  return Response.json({ theme });
}
