import { Landing } from "@/components/landing/landing";

export const metadata = { title: { absolute: "MoodReel · Three taps. One pick." } };

/** The landing page, for anyone signed out (signed in, proxy.ts sends you to /movies). Static: it reads no request. */
export default function LandingPage() {
  return <Landing />;
}
