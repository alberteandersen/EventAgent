import type { Metadata } from "next";
import { Cormorant_Garamond, EB_Garamond, Hanken_Grotesk, Inter } from "next/font/google";
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
  title: "Kalas, plan the wedding, skip the stress",
  description:
    "Kalas is your wedding-planning agent: it finds venues, contacts them for quotes, designs invites, and tracks RSVPs, all from your own Gmail.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} ${hanken.variable} ${ebGaramond.variable} h-full antialiased`}>
      <body className="flex min-h-screen flex-col bg-cream font-[family-name:var(--font-inter)] text-ink">
        {children}
      </body>
    </html>
  );
}
