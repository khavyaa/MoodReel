import localFont from "next/font/local";

/*
 * The four families live in app/fonts (from Google Fonts, each with its SIL
 * Open Font License), so a build never has to download them: a hiccup fetching
 * from Google once failed a CI build. Each file holds Latin plus the arrows and
 * symbols the app uses (← → ↔ ★ ✓ ⌘ ₹); app/fonts/README.md says how to remake them.
 */
const shoulders = localFont({
  // One variable file covers every weight used (700 to 900).
  src: "./fonts/big-shoulders.woff2",
  weight: "700 900",
  variable: "--font-shoulders",
  // There are no metrics to size-match a fallback for this family; use a condensed stack.
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "Impact", "sans-serif"],
});
const instrument = localFont({
  src: [
    { path: "./fonts/instrument-serif.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  adjustFontFallback: "Times New Roman",
});
const onest = localFont({ src: "./fonts/onest.woff2", weight: "100 900", variable: "--font-onest" });
const jetbrains = localFont({
  src: "./fonts/jetbrains-mono.woff2",
  weight: "100 800",
  variable: "--font-jetbrains",
  // A monospace face: size-matching to Arial would do more harm than good.
  adjustFontFallback: false,
});

/** The four families' CSS variables, for the root layout and the global error page (which renders its own document). */
export const fontVariables = `${shoulders.variable} ${instrument.variable} ${onest.variable} ${jetbrains.variable}`;
