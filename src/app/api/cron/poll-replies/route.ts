import { NextRequest } from "next/server";
import { pollPlatformReplies } from "@/lib/gmail/poll";

export const maxDuration = 300;

/**
 * GET /api/cron/poll-replies — manual/emergency poll trigger.
 * Scheduled polling runs in GitHub Actions (.github/workflows/poll-replies.yml
 * → worker/poll.ts) because Netlify caps a request at 60s (the maxDuration
 * export above is a Vercel-ism Netlify ignores), so a large backlog can time
 * out here — harmless, the worker's next tick finishes it.
 * Polls the platform Kalas mailbox for vendor replies across all users:
 * quotes are extracted, attachments stored, and Ava reply proposals queued.
 * Protected by CRON_SECRET bearer auth.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await pollPlatformReplies();
    return Response.json(summary);
  } catch (err) {
    console.error("Platform poll failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
