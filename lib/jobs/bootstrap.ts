import { getBoss } from "@/lib/boss";
import { registerMetaJobs } from "./meta-sync";

let started = false;

export async function startBackgroundJobs() {
  if (started) return;
  started = true;

  const boss = await getBoss();
  await registerMetaJobs(boss);
}
