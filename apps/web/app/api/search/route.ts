import { searchPlaces } from "@travld/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
  const results = await searchPlaces(q, limit);
  return Response.json({ results });
}
