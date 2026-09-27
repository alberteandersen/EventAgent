import { describe, expect, it } from "vitest";
import { memoryContext, threadTitle } from "./memory";

describe("threadTitle", () => {
  it("keeps a short opener whole, on one line", () => {
    expect(threadTitle("  Hvor står\nbudgettet?  ")).toBe("Hvor står budgettet?");
  });

  it("cuts a long opener at a word", () => {
    const title = threadTitle(
      "Vi har fundet ud af at vi gerne vil have en fotograf der også kan filme hele dagen"
    );
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title).not.toMatch(/\s…$/);
  });
});

describe("memoryContext", () => {
  const base = { snapshot: null, otherThreads: [], today: "2026-09-26" };

  it("groups memories by category with their ids", () => {
    const text = memoryContext({
      ...base,
      memories: [
        { id: "m1", category: "preference", content: "Elsker pastelfarver" },
        { id: "m2", category: "followup", content: "Spørg til mormors transport" },
      ],
    });
    expect(text).toContain("Preferences and taste:\n- [m1] Elsker pastelfarver");
    expect(text).toContain("To follow up on:\n- [m2] Spørg til mormors transport");
    expect(text).not.toContain("Decisions made");
  });

  it("says so when nothing is saved, and includes the snapshot and other threads", () => {
    const text = memoryContext({
      memories: [],
      snapshot: { guests: { total: 80 } },
      otherThreads: [{ title: "Fotograf", updated_at: "2026-09-20T10:00:00Z" }],
      today: "2026-09-26",
    });
    expect(text).toContain("nothing saved yet");
    expect(text).toContain('{"guests":{"total":80}}');
    expect(text).toContain("- Fotograf (2026-09-20)");
    expect(text).toContain("Today is 2026-09-26.");
  });
});
