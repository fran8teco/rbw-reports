import { getBoss } from "@/lib/boss";
import { registerGa4Jobs } from "./ga4-sync";
import { registerGoogleAdsJobs } from "./google-ads-sync";
import { registerMetaJobs } from "./meta-sync";

let started = false;

export async function startBackgroundJobs() {
  if (started) return;
  started = true;

  const boss = await getBoss();
  await registerMetaJobs(boss);
  await registerGoogleAdsJobs(boss);
  await registerGa4Jobs(boss);
}
