import { describe, expect, it } from "vitest";
import { sessionOutcome } from "./orders";

describe("sessionOutcome", () => {
  it("is paid once a completed session has the money", () => {
    expect(sessionOutcome({ status: "complete", payment_status: "paid" })).toBe("paid");
    expect(sessionOutcome({ status: "complete", payment_status: "no_payment_required" })).toBe("paid");
  });

  it("stays open while a delayed payment method has not paid yet", () => {
    expect(sessionOutcome({ status: "complete", payment_status: "unpaid" })).toBe("open");
  });

  it("stays open while the couple is still in Checkout", () => {
    expect(sessionOutcome({ status: "open", payment_status: "unpaid" })).toBe("open");
  });

  it("is canceled when the session expired", () => {
    expect(sessionOutcome({ status: "expired", payment_status: "unpaid" })).toBe("canceled");
  });
});
