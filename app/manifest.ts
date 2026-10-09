import type { MetadataRoute } from "next";

/*
 * Makes MoodReel installable: Safari → Share → Add to Home Screen opens it full
 * screen, without browser bars, straight into the movie flow.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MoodReel",
    short_name: "MoodReel",
    description: "Three taps, a short deck, one pick.",
    start_url: "/movies",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0e12",
    theme_color: "#0f0e12",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
