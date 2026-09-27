/* What each kind of slow work does, and running one recorded job to the
   end. Called inline by a route in local dev (dispatch.ts) and by the
   Netlify background function in production. Always the service-role
   client: a background run has no session, and the route that queued the
   work has already checked the couple may do it. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAgentError } from "@/lib/gemini/log";
import { buildSiteHtml } from "@/lib/website/buildSite";
import { buildCard } from "@/lib/invitations/buildCard";
import type { CardFormatId } from "@/kalas/invitations/card/formats";
import { sendApprovedDraft } from "@/lib/outreach/sendDraft";
import type { EventRow } from "@/lib/db/types";

export interface JobInput {
  eventId: string;
  userId: string;
  payload: Record<string, unknown>;
}

interface JobKind {
  /** What the couple is told when it fails. */
  failure: string;
  run: (supabase: SupabaseClient, job: JobInput) => Promise<Record<string, unknown>>;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

async function loadEvent(supabase: SupabaseClient, eventId: string): Promise<EventRow> {
  const { data } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!data) throw new Error(`Event ${eventId} not found`);
  return data as EventRow;
}

export const JOB_KINDS = {
  "website.build": {
    failure: "Ava kunne ikke designe siden lige nu, prøv igen.",
    run: async (supabase, { eventId, userId, payload }) => {
      const { row } = await buildSiteHtml({
        supabase, event: await loadEvent(supabase, eventId), userId,
        styleDirection: str(payload.styleDirection),
      });
      return { designId: row.id };
    },
  },
  "website.refine": {
    failure: "Ava kunne ikke justere designet lige nu, prøv igen.",
    run: async (supabase, { eventId, userId, payload }) => {
      const { row } = await buildSiteHtml({
        supabase, event: await loadEvent(supabase, eventId), userId,
        instruction: str(payload.instruction),
        syncContent: payload.syncContent === true,
      });
      return { designId: row.id };
    },
  },
  "invitation.build": {
    failure: "Ava kunne ikke lave kortet lige nu, prøv igen.",
    run: async (supabase, { eventId, userId, payload }) => {
      const row = await buildCard({
        supabase, event: await loadEvent(supabase, eventId), userId,
        styleDirection: str(payload.styleDirection),
        format: str(payload.format) as CardFormatId | undefined,
      });
      return { designId: row.id };
    },
  },
  "invitation.refine": {
    failure: "Ava kunne ikke ændre kortet lige nu, prøv igen.",
    run: async (supabase, { eventId, userId, payload }) => {
      const row = await buildCard({
        supabase, event: await loadEvent(supabase, eventId), userId,
        instruction: str(payload.instruction),
      });
      return { designId: row.id };
    },
  },
  "outreach.send": {
    failure: "Kunne ikke sende lige nu, prøv igen.",
    run: async (supabase, { userId, payload }) => {
      const { results } = await sendApprovedDraft({ supabase, draftId: String(payload.draftId), userId });
      return { results };
    },
  },
} satisfies Record<string, JobKind>;

export type JobKindId = keyof typeof JOB_KINDS;

export const isJobKind = (k: string): k is JobKindId => k in JOB_KINDS;

/** Runs the work directly. Throws what the work throws. */
export async function runJobInline(kind: JobKindId, job: JobInput): Promise<Record<string, unknown>> {
  return JOB_KINDS[kind].run(createAdminClient(), job);
}

/**
 * Runs one recorded job to the end: claims it (only a queued job can be
 * claimed, so a repeated trigger does nothing), does the work, and records
 * the result or the couple-facing failure. Never throws.
 */
export async function runRecordedJob(jobId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  const job = claimed as { kind: string; event_id: string; user_id: string; payload: Record<string, unknown> } | null;
  if (!job) return;

  if (!isJobKind(job.kind)) {
    await finish(admin, jobId, { status: "failed", error: "Noget gik galt. Prøv igen." });
    return;
  }
  const kind = JOB_KINDS[job.kind];
  try {
    const result = await kind.run(admin, { eventId: job.event_id, userId: job.user_id, payload: job.payload ?? {} });
    await finish(admin, jobId, { status: "done", result });
  } catch (err) {
    logAgentError(`jobs/${job.kind}`, err, { jobId, eventId: job.event_id });
    await finish(admin, jobId, { status: "failed", error: kind.failure });
  }
}

async function finish(
  admin: SupabaseClient,
  jobId: string,
  outcome: { status: "done"; result: Record<string, unknown> } | { status: "failed"; error: string },
) {
  await admin.from("jobs").update({ ...outcome, finished_at: new Date().toISOString() }).eq("id", jobId);
}
