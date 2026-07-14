import { searchUsers } from "@travld/db";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 1) return Response.json({ users: [] });
  const users = await searchUsers(getUserId(req), q.trim());
  return Response.json({ users });
}
