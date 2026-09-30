import type { Metadata } from "next";

// The login page is a client component, so its title lives here.
export const metadata: Metadata = { title: "Log ind · Kalas", robots: { index: false } };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
