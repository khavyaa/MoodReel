import { describe, expect, it } from "vitest";
import { CURATION_BOOST, MIN_APPROVED, applyCuration, validCuration } from "@/lib/deck/curation";
import { cleanWhy } from "@/lib/ai/why";
import type { Scored } from "@/lib/deck/compose";

const offered = new Set(Array.from({ length: 30 }, (_, i) => i + 1));
const scored = (id: number, score: number) => ({ score, movie: { id } }) as unknown as Scored;

describe("AI curation", () => {
  it("accepts only ids we offered, once each, in the AI's order", () => {
    const answer = [3, 3, 99, 1, 2, 4, 5, 6, 7, 8, 9, "x", 10];
    expect(validCuration(answer, offered)).toEqual([3, 1, 2, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("ignores thin or malformed answers so the rules decide", () => {
    expect(validCuration(Array.from({ length: MIN_APPROVED - 1 }, (_, i) => i + 1), offered)).toBeNull();
    expect(validCuration("not a list", offered)).toBeNull();
    expect(validCuration(undefined, offered)).toBeNull();
  });

  it("boosts approved films by rank and nudges passed-over ones down", () => {
    const approved = Array.from({ length: 10 }, (_, i) => i + 1);
    const out = applyCuration([scored(1, 0.5), scored(10, 0.5), scored(20, 0.5), scored(99, 0.5)], approved, offered);
    const by = Object.fromEntries(out.map((s) => [s.movie.id, s.score]));
    expect(by[1]).toBeCloseTo(0.5 + CURATION_BOOST);
    expect(by[10]).toBeGreaterThan(0.5);
    expect(by[10]).toBeLessThan(by[1]);
    expect(by[20]).toBeLessThan(0.5); // offered, not approved
    expect(by[99]).toBe(0.5); // never offered: untouched
  });

  it("changes nothing without an AI answer", () => {
    const input = [scored(1, 0.4), scored(2, 0.6)];
    expect(applyCuration(input, null, offered)).toBe(input);
  });
});

describe("AI-written reason", () => {
  it("keeps one clean sentence and rejects junk", () => {
    expect(cleanWhy('  "A quiet, tense courtroom film\nthat earns every twist."  ')).toBe(
      "A quiet, tense courtroom film that earns every twist.",
    );
    expect(cleanWhy("Too short")).toBeNull();
    expect(cleanWhy("x".repeat(300))).toBeNull();
    expect(cleanWhy(undefined)).toBeNull();
  });
});
