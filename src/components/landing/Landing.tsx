import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { VenueLoop } from "./VenueLoop";
import { Marquee } from "./Marquee";
import { FromYesToThanks } from "./FromYesToThanks";
import { YouDecide } from "./YouDecide";
import { FinalCTA } from "./FinalCTA";
import { LandingFooter } from "./LandingFooter";

/* The page is Juno reporting to the couple. Order: meet her at work (her
   notes, waiting for a yes) → how she finds, writes and compares → where,
   in photographs → everything else she keeps, from the yes to the thank-you
   → the terms → say hello. */
export function Landing() {
  return (
    <main className="landing flex flex-1 flex-col bg-cream text-ink">
      <Nav />
      <Hero />
      <VenueLoop />
      <Marquee />
      <FromYesToThanks />
      <YouDecide />
      <FinalCTA />
      <LandingFooter />
    </main>
  );
}
