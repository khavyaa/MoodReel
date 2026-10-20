import { describe, expect, it } from "vitest";
import { dominant } from "@/lib/tint";

const pixels = (...colours: [number, number, number][]) => colours.flatMap(([r, g, b]) => [r, g, b, 255]);
const hue = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  return max === r ? "red" : max === g ? "green" : "blue";
};

describe("poster tint", () => {
  it("reads a poster by its colourful part, not its black border or grey sky", () => {
    const poster = pixels(...Array(30).fill([0, 0, 0]), ...Array(30).fill([128, 128, 128]), ...Array(10).fill([30, 60, 200]));
    expect(hue(dominant(poster)!)).toBe("blue");
  });

  it("makes a muddy average rich enough to tint with, and keeps a black-and-white poster neutral", () => {
    const muddy = dominant(pixels(...Array(10).fill([110, 90, 70])))!;
    const [r, , b] = [1, 3, 5].map((i) => parseInt(muddy.slice(i, i + 2), 16));
    expect(r - b).toBeGreaterThan(60);
    const grey = dominant(pixels(...Array(10).fill([120, 120, 120])))!;
    const [gr, gg, gb] = [1, 3, 5].map((i) => parseInt(grey.slice(i, i + 2), 16));
    expect(Math.max(gr, gg, gb) - Math.min(gr, gg, gb)).toBeLessThan(40);
  });

  it("picks one of two opposite colours rather than the grey they'd average to", () => {
    const poster = pixels(...Array(12).fill([150, 220, 225]), ...Array(8).fill([220, 50, 40]));
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(dominant(poster)!.slice(i, i + 2), 16));
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(60);
  });

  it("has nothing to say about a see-through image", () => {
    expect(dominant([0, 0, 0, 0, 255, 0, 0, 10])).toBeNull();
  });
});
