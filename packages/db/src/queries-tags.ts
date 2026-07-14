import { sql } from "drizzle-orm";
import { db } from "./client";

export async function setPushToken(userId: string, token: string): Promise<void> {
  await db.execute(sql`UPDATE users SET expo_push_token = ${token} WHERE id = ${userId}`);
}

export interface UserSearchRow {
  id: string;
  handle: string;
  displayName: string;
}

/** Find users to tag (by handle/name), excluding the actor. */
export async function searchUsers(userId: string, q: string): Promise<UserSearchRow[]> {
  const like = `%${q.toLowerCase()}%`;
  const rows = await db.execute(sql`
    SELECT id, handle, display_name AS "displayName" FROM users
    WHERE id <> ${userId} AND (lower(handle) LIKE ${like} OR lower(display_name) LIKE ${like})
    LIMIT 10
  `);
  return rows.rows as unknown as UserSearchRow[];
}

/** Send an Expo push to a user if they have a token. Best-effort. */
async function sendPush(userId: string, title: string, body: string): Promise<void> {
  const rows = await db.execute(sql`SELECT expo_push_token AS token FROM users WHERE id = ${userId}`);
  const token = (rows.rows[0] as any)?.token as string | undefined;
  if (!token) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: token, title, body, sound: "default" }),
    });
  } catch {
    /* best-effort */
  }
}

/** Tag a user on one of the actor's visits → pending tag + push. */
export async function tagUser(
  actorId: string,
  visitId: number,
  taggedUserId: string,
): Promise<void> {
  // guard: the visit must belong to the actor
  const owns = await db.execute(
    sql`SELECT 1 FROM visits WHERE id = ${visitId} AND user_id = ${actorId} LIMIT 1`,
  );
  if (owns.rows.length === 0) return;
  await db.execute(sql`
    INSERT INTO visit_tags (visit_id, tagged_user_id, status)
    VALUES (${visitId}, ${taggedUserId}, 'pending')
    ON CONFLICT DO NOTHING
  `);
  const actor = await db.execute(sql`SELECT display_name AS name FROM users WHERE id = ${actorId}`);
  const place = await db.execute(sql`
    SELECT p.name FROM visits v JOIN places p ON p.id = v.place_id WHERE v.id = ${visitId}
  `);
  const who = (actor.rows[0] as any)?.name ?? "Someone";
  const where = (place.rows[0] as any)?.name ?? "a place";
  await sendPush(taggedUserId, "You were tagged", `${who} tagged you in ${where}.`);
}

export interface PendingTag {
  visitId: number;
  taggerName: string;
  placeId: number;
  placeName: string;
  countryName: string | null;
}

export async function listPendingTags(userId: string): Promise<PendingTag[]> {
  const rows = await db.execute(sql`
    SELECT t.visit_id AS "visitId", u.display_name AS "taggerName",
           p.id AS "placeId", p.name AS "placeName",
           cc.name AS "countryName"
    FROM visit_tags t
    JOIN visits v ON v.id = t.visit_id
    JOIN users u ON u.id = v.user_id
    JOIN places p ON p.id = v.place_id
    LEFT JOIN places cc ON cc.level = 'country' AND cc.iso2 = COALESCE(p.country_code, p.iso2)
    WHERE t.tagged_user_id = ${userId} AND t.status = 'pending'
    ORDER BY t.created_at DESC
  `);
  return (rows.rows as any[]).map((r) => ({
    visitId: Number(r.visitId),
    taggerName: r.taggerName,
    placeId: Number(r.placeId),
    placeName: r.placeName,
    countryName: r.countryName ?? null,
  }));
}

/** Accept or decline a tag. Accepting only records the companion link — it never
 *  writes to the user's own map (that's a separate opt-in via createVisit). */
export async function respondTag(
  userId: string,
  visitId: number,
  accept: boolean,
): Promise<void> {
  await db.execute(sql`
    UPDATE visit_tags SET status = ${accept ? "accepted" : "declined"}
    WHERE visit_id = ${visitId} AND tagged_user_id = ${userId}
  `);
}
