import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ServiceWorker } from "@/components/shell/service-worker";

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

export const metadata: Metadata = {
  title: { default: "MoodReel", template: "%s · MoodReel" },
  description: "Three taps, a short deck, one pick. Movies, series and books for the mood you're in.",
  applicationName: "MoodReel",
  appleWebApp: { capable: true, title: "MoodReel", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0e12" },
  ],
};

/*
 * Runs before first paint. If this device has a look override saved, apply it
 * so the page never flashes the other look. With no override, CSS alone follows
 * the device's appearance.
 */
const LOOK_SCRIPT = `try{var l=localStorage.getItem("mr-look");if(l==="playful"||l==="cinematic")document.documentElement.dataset.look=l}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${shoulders.variable} ${instrument.variable} ${onest.variable} ${jetbrains.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: LOOK_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
