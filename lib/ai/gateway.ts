import "server-only";

/*
 * AI goes through Vercel's AI Gateway. On Vercel it authenticates by itself
 * (OIDC); locally it needs AI_GATEWAY_API_KEY, and without one the app simply
 * uses its rule-based fallbacks. Nothing in the flow ever waits on AI.
 *
 * Primary: a fast, cheap model with structured output, paid from the gateway's
 * free monthly credit. Fallback: a model that is free outright.
 */

export const AI_MODEL = "anthropic/claude-haiku-5.5";
export const AI_FALLBACK_MODELS = ["inclusionai/ling-3.1-flash"];

export function aiAvailable(): boolean {
  if (process.env.MOODREEL_AI === "off") return false;
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL);
}

export function gatewayOptions(feature: "curate" | "why") {
  return { gateway: { models: AI_FALLBACK_MODELS, tags: ["moodreel", feature] } };
}
