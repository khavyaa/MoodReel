import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Instrument_Serif, JetBrains_Mono, Onest } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/shell/service-worker";

const shoulders = Big_Shoulders({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-shoulders",
  // Next has no metrics to size-match a fallback for this family; use a condensed stack.
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "Impact", "sans-serif"],
});
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
});
const onest = Onest({ subsets: ["latin"], variable: "--font-onest" });
// Variable font: one file covers every weight. Requesting fixed weights
// ("400", "600") broke Turbopack's Google font loader in Next 16.4.
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

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
