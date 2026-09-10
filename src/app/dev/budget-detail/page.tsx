"use client";

/* Harness for BudgetLineDetail — the modal a budget row opens into. The real
   screen sits behind useWedding()/Supabase, but the modal itself takes plain
   props, so it can be checked directly: the draft-vs-save behaviour, the
   icon & colour swatches, the delete confirm, and that the contract panel
   mounts without an eventId (it no-ops rather than fetching). */

import { useState } from 'react';
import { LanguageProvider } from '@/kalas/i18n';
import BudgetLineDetail from '@/kalas/screens/BudgetLineDetail';

export default function DevBudgetDetailPage() {
  const [open, setOpen] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((l) => [...l, line]);

  return (
    <LanguageProvider initialLang="da">
      <div className="theme-kalas min-h-screen bg-canvas p-8 text-ink">
        <p className="eyebrow mb-6">Dev · BudgetLineDetail</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink cursor-pointer"
        >
          Åbn detaljer
        </button>
        <pre className="mt-6 text-[12px] text-ink-soft">{log.join('\n') || 'ingen handling endnu'}</pre>

        {open && (
          <BudgetLineDetail
            eventId={null}
            categoryId="custom-1"
            label="Transport"
            icon="sparkles"
            color="#8a7f66"
            custom
            planned={12000}
            actual={9500}
            paid={4000}
            reminder="2027-03-01"
            note="Bus bestilt via Kalas Rejser, depositum 2.000 kr."
            findLabel={undefined}
            onFindVendors={undefined}
            onClose={() => { note('close'); setOpen(false); }}
            onSave={(patch) => note(`save: ${JSON.stringify(patch)}`)}
            onDelete={() => { note('delete'); setOpen(false); }}
            onContractApply={(patch) => note(`contract: ${JSON.stringify(patch)}`)}
          />
        )}
      </div>
    </LanguageProvider>
  );
}
