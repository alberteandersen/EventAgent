import type { Metadata } from "next";
import { Cormorant_Garamond, EB_Garamond, Hanken_Grotesk, Inter } from "next/font/google";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Serif for the whole product, the landing page included. Fraunces used to set
// the marketing headlines, and its hooked display "f" read as a typo there.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

// Kalas wordmark (corner logo).
const ebGaramond = EB_Garamond({
  variable: "--font-wordmark",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Ownership tags for Google Search Console and Bing Webmaster Tools; set the
  // codes in Netlify and the tags appear, with no code change.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } }
      : {}),
  },
  title: "Kalas: bryllupsplanlægning med Juno",
  // Opened from a phone's home screen, Kalas runs full screen like an app.
  appleWebApp: { capable: true, title: "Kalas", statusBarStyle: "default" },
  icons: { apple: "/pwa-icon/180" },
  description:
    "Kalas er jeres bryllupsplanlægger: Juno finder steder og leverandører, skriver til dem for tilbud og holder styr på gæster og budget. Intet sendes, før I har godkendt det.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Danish first. LanguageProvider switches it on the client to the language
  // the couple chose (the app) or the couple's own (a wedding site).
  return (
    <html lang="da" className={`${inter.variable} ${cormorant.variable} ${hanken.variable} ${ebGaramond.variable} h-full antialiased`}>
      <body className="flex min-h-screen flex-col bg-cream font-[family-name:var(--font-inter)] text-ink">
        {children}
      </body>
    </html>
  );
}
