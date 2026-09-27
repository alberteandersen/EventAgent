/* Netlify background function (the -background suffix is what makes it
   one): Netlify answers the caller 202 at once and gives this up to 15
   minutes, where a normal request gets 60 seconds. It runs one job that a
   route recorded in `jobs`; see src/lib/jobs/dispatch.ts. */

import { runRecordedJob } from "../../src/lib/jobs/run";

const runJobBackground = async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return;
  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (typeof jobId === "string" && jobId) await runRecordedJob(jobId);
};

export default runJobBackground;
