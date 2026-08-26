import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginRateLimits } from "@/lib/db/schema";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function checkLoginRateLimit(key: string): Promise<boolean> {
  const nowDate = new Date();
  const resetAtDate = new Date(nowDate.getTime() + WINDOW_MS);
  const now = nowDate.toISOString();
  const resetAt = resetAtDate.toISOString();

  const [row] = await db
    .insert(loginRateLimits)
    .values({ key, count: 1, resetAt: resetAtDate })
    .onConflictDoUpdate({
      target: loginRateLimits.key,
      set: {
        count: sql`case when ${loginRateLimits.resetAt} < ${now} then 1 else ${loginRateLimits.count} + 1 end`,
        resetAt: sql`case when ${loginRateLimits.resetAt} < ${now} then ${resetAt} else ${loginRateLimits.resetAt} end`,
      },
    })
    .returning();

  return row.count <= MAX_ATTEMPTS;
}

export async function resetLoginRateLimit(key: string) {
  await db.delete(loginRateLimits).where(eq(loginRateLimits.key, key));
}
