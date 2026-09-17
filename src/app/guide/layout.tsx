import { GuideFooter, GuideNav } from "@/components/guide/GuideChrome";

/* The guide wears the app's theme, so a couple who reads a guide and signs up
   lands somewhere that already looks familiar. It is Danish while the root
   <html> says "en" for the English landing page, so the language is declared
   on this subtree. The wash in the corner is the app shell's CHROME_WASH. */
export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      lang="da"
      className="theme-kalas flex min-h-screen flex-col bg-canvas font-sans text-ink"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 620px 420px at 0% 0%, rgba(31,77,64,0.12) 0%, rgba(31,77,64,0.05) 42%, transparent 72%)",
        backgroundRepeat: "no-repeat",
      }}
    >
      <GuideNav />
      <main className="flex-1">{children}</main>
      <GuideFooter />
    </div>
  );
}
