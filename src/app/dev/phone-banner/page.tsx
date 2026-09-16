"use client";

/* The Home screen's phone banner on its own; the real Home needs a wedding.
   Desktop only, so look at it wider than 1024px. Once dismissed it stays
   gone: clear `kalas_phone_banner_dismissed` in localStorage to see it again. */

import PhoneBanner from '@/kalas/screens/home/PhoneBanner';

export default function DevPhoneBannerPage() {
  return (
    <div className="theme-kalas min-h-screen bg-[#f4f5f3] px-12 py-10 font-sans">
      <PhoneBanner />
    </div>
  );
}
