"use client";

/* The seat-count box on its own, as it opens for a new round table. The full
   flow runs on /dev/seating-screen. */

import { LanguageProvider } from '@/kalas/i18n';
import SeatCountDialog from '@/kalas/screens/seating/SeatCountDialog';

export default function DevSeatCountPage() {
  return (
    <LanguageProvider initialLang="da">
      <div className="theme-kalas min-h-screen bg-canvas font-sans">
        <SeatCountDialog shape="round" onCancel={() => {}} onConfirm={() => {}} />
      </div>
    </LanguageProvider>
  );
}
