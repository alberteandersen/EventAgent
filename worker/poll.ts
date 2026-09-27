// Standalone mailbox poller — run every 5 minutes by GitHub Actions
// (.github/workflows/poll-replies.yml → `npm run poll`). One pass over the
// platform inbox, a JSON summary on stdout, then exit. Scheduled polling
// lives HERE, not in the Next.js app: Netlify's scheduled functions run at
// most hourly and stop after 30 seconds.
//
// Env comes from the workflow's repository secrets. Locally:
//   npx tsx --env-file=.env worker/poll.ts
// Needs: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//        TOKEN_ENCRYPTION_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
//        GEMINI_API_KEY.

import { WebSocket as WsWebSocket } from "ws";
import { pollPlatformReplies } from "@/lib/gmail/poll";

// supabase-js constructs a realtime client (and demands a WebSocket
// implementation) even though this poller never opens a channel. Node 22+
// has a native global; on Node 20 we lend it ws.
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = WsWebSocket as unknown as typeof globalThis.WebSocket;
}

// Bail before the next 5-minute tick rather than pile up runs.
const WATCHDOG_MS = 4 * 60 * 1000;

const watchdog = setTimeout(() => {
  console.error("[worker/poll] watchdog timeout after 4m — exiting");
  process.exit(2);
}, WATCHDOG_MS);

pollPlatformReplies()
  .then((summary) => {
    clearTimeout(watchdog);
    console.log(JSON.stringify({ at: new Date().toISOString(), ...summary }));
    if (summary.error) process.exitCode = 1;
  })
  .catch((err) => {
    console.error("[worker/poll] poll failed:", err);
    process.exit(1);
  });
