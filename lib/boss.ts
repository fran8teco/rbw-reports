import { PgBoss } from "pg-boss";

let bossPromise: Promise<PgBoss> | undefined;

export function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss(process.env.DATABASE_URL!);
      boss.on("error", (error) => console.error("[pg-boss]", error));
      await boss.start();
      return boss;
    })();
  }
  return bossPromise;
}
