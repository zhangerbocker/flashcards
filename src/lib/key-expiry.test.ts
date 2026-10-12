import { describe, expect, it } from "vitest";
import { keyExpiryNotice } from "./key-expiry";

describe("keyExpiryNotice", () => {
  it("stays quiet until a week before", () => {
    expect(keyExpiryNotice("2026-12-31", "2026-12-23")).toBeNull();
    expect(keyExpiryNotice("2026-12-31", "2026-10-08")).toBeNull();
  });

  it("counts down from 7 days to the last day", () => {
    expect(keyExpiryNotice("2026-12-31", "2026-12-24")).toEqual({ kind: "soon", daysLeft: 7, expiresOn: "2026-12-31" });
    expect(keyExpiryNotice("2026-12-31", "2026-12-31")).toEqual({ kind: "soon", daysLeft: 0, expiresOn: "2026-12-31" });
  });

  it("says expired after the last day", () => {
    expect(keyExpiryNotice("2026-12-31", "2027-01-01")).toEqual({ kind: "expired", expiresOn: "2026-12-31" });
  });

  it("ignores a missing or malformed date", () => {
    expect(keyExpiryNotice(undefined, "2026-12-31")).toBeNull();
    expect(keyExpiryNotice("31/12/2026", "2026-12-31")).toBeNull();
  });
});
