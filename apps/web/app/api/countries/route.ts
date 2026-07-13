import { listCountries } from "@travld/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const countries = await listCountries();
  return Response.json({ countries });
}
