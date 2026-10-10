import { describe, expect, it } from "vitest";
import { EMPTY_FLAGS, foldActions } from "@/lib/picks/state";

const at = (n: number) => new Date(2026, 9, 1, 20, n);

describe("foldActions", () => {
  it("is empty with no actions", () => {
    expect(foldActions([])).toEqual(EMPTY_FLAGS);
  });

  it("a later save clears an old skip; a dislike clears a save", () => {
    expect(foldActions([{ action: "skipped", createdAt: at(1) }, { action: "saved", createdAt: at(2) }])).toMatchObject({
      saved: true,
      skipped: false,
    });
    expect(foldActions([{ action: "saved", createdAt: at(1) }, { action: "disliked", createdAt: at(2) }])).toMatchObject({
      saved: false,
      disliked: true,
    });
  });

  it("a pick keeps its time and comes off the saved list", () => {
    const flags = foldActions([{ action: "saved", createdAt: at(1) }, { action: "picked", createdAt: at(5) }]);
    expect(flags).toMatchObject({ saved: false, pickedAt: at(5) });
  });
});
