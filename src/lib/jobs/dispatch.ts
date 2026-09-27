/* A route's way to start slow work (see run.ts for the kinds).

   Locally, and anywhere JOBS_BACKGROUND is unset, the work runs inside the
   request as it always has, and the route answers 200 with its result.

   With JOBS_BACKGROUND=netlify (production), a request would be cut off at
   60 seconds, so the work is recorded in `jobs` and handed to the Netlify
   background function, and the route answers 202 { jobId }. The browser
   then waits on /api/jobs/<id> (see client.ts). */

import { createAdminClient } from "@/lib/supabase/admin";
import { logAgentError } from "@/lib/gemini/log";
import { JOB_KINDS, runJobInline, type JobInput, type JobKindId } from "./run";

export const BACKGROUND_FUNCTION_PATH = "/.netlify/functions/run-job-background";

export async function dispatchJob(request: Request, kind: JobKindId, job: JobInput): Promise<Response> {
  if (process.env.JOBS_BACKGROUND !== "netlify") {
    try {
      return Response.json(await runJobInline(kind, job));
    } catch (err) {
      logAgentError(`jobs/${kind}`, err, { eventId: job.eventId });
      return Response.json({ error: JOB_KINDS[kind].failure }, { status: 502 });
    }
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("jobs")
    .insert({ event_id: job.eventId, user_id: job.userId, kind, payload: job.payload })
    .select("id")
    .single();
  if (error || !row) {
    logAgentError(`jobs/${kind}:enqueue`, error ?? new Error("no row"), { eventId: job.eventId });
    return Response.json({ error: JOB_KINDS[kind].failure }, { status: 502 });
  }

  // A background function answers 202 as soon as Netlify has accepted the
  // run, so this wait is short. Same deploy, so the request's own origin.
  const trigger = await fetch(new URL(BACKGROUND_FUNCTION_PATH, request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
    body: JSON.stringify({ jobId: row.id }),
  }).catch((err: unknown) => err);
  if (!(trigger instanceof Response) || !trigger.ok) {
    logAgentError(`jobs/${kind}:trigger`, trigger instanceof Response ? new Error(`HTTP ${trigger.status}`) : trigger, { jobId: row.id });
    await admin.from("jobs").update({ status: "failed", error: JOB_KINDS[kind].failure, finished_at: new Date().toISOString() }).eq("id", row.id);
    return Response.json({ error: JOB_KINDS[kind].failure }, { status: 502 });
  }
  return Response.json({ jobId: row.id }, { status: 202 });
}
