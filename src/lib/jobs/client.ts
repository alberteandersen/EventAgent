/* The browser's half of slow work: a route that ran it in the background
   answers 202 { jobId }, and this waits for the job to finish. Any other
   answer is already the final one. See dispatch.ts. */

export interface JobOutcome {
  ok: boolean;
  /** The couple-facing failure, when there is one. */
  error?: string;
  result?: Record<string, unknown>;
}

const POLL_MS = 2500;
/** Past a background function's 15 minutes, the job is not coming back. */
const GIVE_UP_MS = 16 * 60 * 1000;

/** Resolves when the response's work is done. Call after the caller has
    dealt with its own non-OK statuses (402 and the like). */
export async function settleJob(res: Response): Promise<JobOutcome> {
  if (res.status !== 202) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return res.ok ? { ok: true, result: body } : { ok: false, error: typeof body.error === "string" ? body.error : undefined };
  }
  const { jobId } = (await res.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return { ok: false };

  const started = Date.now();
  while (Date.now() - started < GIVE_UP_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const poll = await fetch(`/api/jobs/${jobId}`).catch(() => null);
    if (!poll?.ok) continue; // a dropped poll is not a failed job
    const job = (await poll.json()) as { status: string; error?: string | null; result?: Record<string, unknown> | null };
    if (job.status === "done") return { ok: true, result: job.result ?? undefined };
    if (job.status === "failed") return { ok: false, error: job.error ?? undefined };
  }
  return { ok: false };
}
