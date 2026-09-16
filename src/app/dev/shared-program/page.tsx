"use client";

/* The shared programme page against fixtures. The real one is reached by a
   token that only exists once a couple shares; the view takes plain props.
   The date is today, so the "Nu" marker shows at the reader's own clock. */

import { PublicProgram } from '@/app/p/[token]/PublicProgram';

const today = new Date();
const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const at = (offsetMin: number) => {
  const d = new Date(today.getTime() + offsetMin * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function DevSharedProgramPage() {
  return (
    <PublicProgram
      lang="da"
      names="Emma & Frederik"
      dateISO={iso}
      dateLabel="I dag"
      photoUrl={null}
      items={[
        { id: '1', time: at(-120), title: 'Gæsternes ankomst', subtitle: 'Havens indgang · Velkomstdrinks', duration_min: 45, owner: 'Toastmaster', notes: null },
        { id: '2', time: at(-30), title: 'Vielse', subtitle: 'Oliventræshaven', duration_min: 45, owner: 'Præst', notes: 'Ringene ligger hos forloveren.' },
        { id: '3', time: at(30), title: 'Champagne & portrætter', subtitle: 'Øvre terrasse', duration_min: 90, owner: 'Fotograf', notes: null },
        { id: '4', time: at(150), title: 'Middag', subtitle: 'Gårdhave · Taler efter hovedretten', duration_min: 150, owner: null, notes: null },
      ]}
    />
  );
}
