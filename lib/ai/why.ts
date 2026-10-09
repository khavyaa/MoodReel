import "server-only";
import { generateText } from "ai";
import { ENERGY, MOODS } from "@/lib/moods";
import { formatRuntime, ruleBasedWhy, type WhyInput } from "@/lib/picks/why";
import { AI_MODEL, aiAvailable, gatewayOptions } from "./gateway";

/** One plain sentence, no quotes, no line breaks, a sensible length. */
export function cleanWhy(text: string | undefined): string | null {
  if (!text) return null;
  // Trim before and after removing wrapping quotes: models often add both.
  const line = text.replace(/\s+/g, " ").trim().replace(/^["'“”]+|["'“”]+$/g, "").trim();
  if (line.length < 20 || line.length > 240) return null;
  return line;
}

/** The pick's one-line reason: AI-written when it's available and quick, rule-based otherwise. */
export async function writeWhy(input: WhyInput & { overview: string }): Promise<{ text: string; source: "ai" | "rules" }> {
  const fallback = { text: ruleBasedWhy(input), source: "rules" as const };
  if (!aiAvailable()) return fallback;
  try {
    const { text } = await generateText({
      model: AI_MODEL,
      providerOptions: gatewayOptions("why"),
      timeout: 6000,
      maxRetries: 0,
      prompt: [
        `Write one sentence (max 28 words) telling someone why "${input.title}" is the right film for their night.`,
        `Their mood: ${MOODS[input.mood].label}, energy: ${ENERGY[input.energy]}.`,
        input.beat > 0 ? `It beat ${input.beat} other films they shortlisted.` : "",
        `Facts you may use: ${input.languageLabel}, ${formatRuntime(input.runtime) ?? "runtime unknown"}, TMDb ${input.rating.toFixed(1)}.`,
        input.streamingOn.length ? `It's on ${input.streamingOn[0]}.` : "",
        `Synopsis (don't spoil it): ${input.overview.slice(0, 300)}`,
        "Plain, warm, specific. No quotes, no hype words, no spoilers. Just the sentence.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    const line = cleanWhy(text);
    return line ? { text: line, source: "ai" } : fallback;
  } catch (error) {
    console.warn("[moodreel] AI why skipped:", error instanceof Error ? error.message : error);
    return fallback;
  }
}
