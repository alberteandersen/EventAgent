import { describe, expect, it } from "vitest";
import { acceptDecision } from "./accept";

const invite = (status: string) => ({ id: "i1", user_id: "inviter", event_id: "e1", status });

describe("acceptDecision", () => {
  it("lets the partner join from a sent or opened invitation", () => {
    expect(acceptDecision(invite("sent"), "partner", null)).toEqual({ kind: "join" });
    expect(acceptDecision(invite("opened"), "partner", null)).toEqual({ kind: "join" });
  });

  it("does nothing when the inviter opens their own link", () => {
    expect(acceptDecision(invite("sent"), "inviter", null)).toEqual({ kind: "own" });
  });

  it("refuses a revoked invitation", () => {
    expect(acceptDecision(invite("revoked"), "partner", null)).toEqual({ kind: "spent" });
  });

  it("lets the same partner open an accepted link again, but nobody else", () => {
    expect(acceptDecision(invite("accepted"), "partner", "partner")).toEqual({ kind: "join" });
    expect(acceptDecision(invite("accepted"), "stranger", "partner")).toEqual({ kind: "spent" });
  });
});
