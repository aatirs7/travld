/**
 * Auth is deferred to the final phase. Until then every request runs as the
 * seeded dev user. When Clerk lands, this becomes `auth().userId` — and because
 * userId is a plain string everywhere, nothing else changes.
 */
export const DEV_USER_ID = "dev-user";

export function getUserId(_req: Request): string {
  return DEV_USER_ID;
}
