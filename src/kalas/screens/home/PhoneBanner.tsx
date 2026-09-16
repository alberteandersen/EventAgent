"use client";

/* "Planlæg videre på telefonen". Most of a wedding is planned in stolen
   minutes, on a phone, and Kalas works there already; the couple at a desk
   just has no way to know. A code to scan, on desktop only, gone for good
   once dismissed.

   It promises what is true: this app, on the phone, added to the home screen
   if they like. There is no store app to download. */

import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useLang } from '../../i18n';
import { QrBlock } from '../website/HubPanels';

const DISMISSED_KEY = 'kalas_phone_banner_dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export default function PhoneBanner() {
  const { t } = useLang();
  // Unknown until mounted: the server cannot read localStorage, and showing
  // the banner for a frame before hiding it again would flash.
  const [state, setState] = useState<{ url: string; dismissed: boolean } | null>(null);

  useEffect(() => {
    // One read on mount, from two things only the browser knows.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ url: `${window.location.origin}/home`, dismissed: readDismissed() });
  }, []);

  if (!state || state.dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* still hide it for this visit */ }
    setState({ ...state, dismissed: true });
  };

  return (
    <aside className="relative hidden items-center gap-6 rounded-[28px] border border-[#dcdfdb] bg-[linear-gradient(110deg,#e8f0ec_0%,#f4f5f3_55%,#eceeeb_100%)] px-7 py-6 lg:flex">
      <QrBlock url={state.url} caption={t('Kalas på telefonen')} size={104} printable={false} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#7d938a]">
          <Smartphone size={13} aria-hidden /> {t('Planlæg videre på telefonen')}
        </p>
        <p className="mt-2 font-serif text-[1.6rem] leading-tight text-[#24413a]">
          {t('Tjekliste, budget og gæsteliste i lommen')}
        </p>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-[#5f6b66]">
          {t('Scan koden med telefonens kamera. Vælg "Føj til hjemmeskærm", så åbner Kalas som en app.')}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('Luk')}
        className="absolute right-4 top-4 rounded-full p-1.5 text-[#7d938a] transition-colors hover:bg-white/70 hover:text-[#24413a] cursor-pointer"
      >
        <X size={16} />
      </button>
    </aside>
  );
}
