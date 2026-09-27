import { describe, expect, it } from "vitest";
import { takeSseFrames } from "./sse";

describe("takeSseFrames", () => {
  it("returns complete frames and keeps the partial tail", () => {
    const { frames, rest } = takeSseFrames(
      'event: tool\ndata: {"phase":"start"}\n\nevent: message\ndata: {"id"'
    );
    expect(frames).toEqual([{ event: "tool", data: '{"phase":"start"}' }]);
    expect(rest).toBe('event: message\ndata: {"id"');
  });

  it("defaults the event name to message and drops empty frames", () => {
    const { frames } = takeSseFrames('data: {"a":1}\n\nevent: ping\n\n');
    expect(frames).toEqual([{ event: "message", data: '{"a":1}' }]);
  });

  it("joins multi-line data", () => {
    const { frames } = takeSseFrames("event: x\ndata: ab\ndata: cd\n\n");
    expect(frames[0].data).toBe("abcd");
  });
});
