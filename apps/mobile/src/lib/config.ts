// EXPO_PUBLIC_API_URL is inlined by Expo at build time. On a physical device,
// localhost won't reach your machine — set it in apps/mobile/.env or at build.
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export function isNetworkError(e: unknown): boolean {
  return (
    e instanceof TypeError ||
    (e instanceof Error && /network|fetch|timeout|connection/i.test(e.message))
  );
}
