export interface SseFrame {
  event: string;
  data: string;
}

/**
 * Splits a growing SSE buffer into complete frames and what is left over.
 * A frame without an `event:` line is a "message", as in the spec; one
 * without data is dropped.
 */
export function takeSseFrames(buffer: string): { frames: SseFrame[]; rest: string } {
  const chunks = buffer.split("\n\n");
  const rest = chunks.pop() ?? "";
  const frames: SseFrame[] = [];
  for (const chunk of chunks) {
    let event = "message";
    let data = "";
    for (const line of chunk.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    if (data) frames.push({ event, data });
  }
  return { frames, rest };
}
