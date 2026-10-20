/*
 * A poster's colour, for the tint behind a cover flow. Sampled in the browser
 * from a small copy of the image (TMDb and Open Library both allow it), once
 * per image per visit. Null when the image can't be read, so the page keeps
 * its normal look.
 */

const cache = new Map<string, Promise<string | null>>();

export function tintOf(src: string): Promise<string | null> {
  let found = cache.get(src);
  if (!found) {
    found = sample(src);
    cache.set(src, found);
  }
  return found;
}

function sample(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 24;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, 16, 24);
        resolve(dominant(ctx.getImageData(0, 0, 16, 24).data));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Hue families a poster's pixels are sorted into; one more holds the near-greys. */
const HUES = 12;

/**
 * Pure: the colour a poster reads as. Pixels are sorted by hue family, each
 * counting by how colourful it is and how far from black or white, and the
 * strongest family wins: a vivid figure outweighs a grey sky or a black border,
 * and a poster of cyan sky and red figures reads as one of them, not as the
 * grey their average would be. Exported for tests.
 */
export function dominant(rgba: ArrayLike<number>): string | null {
  const bins = Array.from({ length: HUES + 1 }, () => ({ r: 0, g: 0, b: 0, w: 0 }));
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const [pr, pg, pb] = [rgba[i], rgba[i + 1], rgba[i + 2]];
    const [h, sat, light] = hsl(pr / 255, pg / 255, pb / 255);
    const weight = 0.04 + sat * (1 - Math.abs(light - 0.5) * 1.6);
    if (weight <= 0) continue;
    const bin = bins[sat < 0.12 ? HUES : Math.floor(h / (360 / HUES)) % HUES];
    bin.r += pr * weight;
    bin.g += pg * weight;
    bin.b += pb * weight;
    bin.w += weight;
  }
  const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
  if (!best.w) return null;
  return vivid(best.r / best.w, best.g / best.w, best.b / best.w);
}

/** The same hue, made rich enough to tint with: an averaged poster is often a muddy grey-brown. */
function vivid(r: number, g: number, b: number): string {
  const [h, s, l] = hsl(r / 255, g / 255, b / 255);
  // Next to no colour at all (a black-and-white poster): a cool neutral rather than an invented hue.
  const sat = s < 0.08 ? 0.12 : Math.max(0.5, Math.min(0.85, s * 1.5));
  return rgbHex(h, sat, Math.max(0.4, Math.min(0.58, l)));
}

function hsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [220, 0, l];
  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function rgbHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
