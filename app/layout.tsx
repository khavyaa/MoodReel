import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import { getAppUrl } from "@/lib/app-url";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const appUrl = getAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "MoodReel - movies that match your mood",
    template: "%s · MoodReel",
  },
  description:
    "Pick a mood, swipe through English, Hindi and Tamil films, and keep a watchlist that actually remembers you.",
  applicationName: "MoodReel",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "MoodReel", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "MoodReel",
    description: "Mood-first movie recommendations in English, Hindi and Tamil.",
    url: appUrl,
    siteName: "MoodReel",
    type: "website",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink-950 text-ink-100">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
