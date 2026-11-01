import type { MetadataRoute } from "next";

/* Kalas on a phone's home screen. There is no app in a store: this is the
   same app, opened full screen from an icon, which is what "fortsæt på
   telefonen" can honestly promise. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kalas",
    short_name: "Kalas",
    description: "Jeres bryllup: tjekliste, budget, gæsteliste og Juno.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f4f5f3",
    theme_color: "#24413a",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
