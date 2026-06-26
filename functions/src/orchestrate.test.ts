import { describe, it, expect } from "vitest";
import { planSends } from "./orchestrate";
import { parseEvent } from "../../packages/core/src/domain/event";

const T = Date.UTC(2026, 0, 5, 9, 0, 0);
const MIN = 60000;

describe("planSends", () => {
  it("produces sends only for owners with due reminders and tokens", () => {
    const e = parseEvent({ id: "e1", ownerId: "u1", createdAt: 1, updatedAt: 1, deletedAt: null, title: "Réu", start: T, end: T + 3600000, reminderOffsets: [10] });
    const owners = [
      { ownerId: "u1", tokens: ["tA", "tB"], events: [e], tasks: [], lastCheck: T - 10 * MIN - 1 },
      { ownerId: "u2", tokens: ["tC"], events: [], tasks: [], lastCheck: T - 10 * MIN - 1 },
    ];
    const sends = planSends(owners, T - 10 * MIN);
    expect(sends).toHaveLength(1);
    expect(sends[0]!.ownerId).toBe("u1");
    expect(sends[0]!.tokens).toEqual(["tA", "tB"]);
    expect(sends[0]!.payloads[0]!.title).toBe("Réu");
  });
});
