"use client";

/* Harness for BudgetLineDetail — the modal a budget row opens into. The real
   screen sits behind useWedding()/Supabase, but the modal itself takes plain
   props, so it can be checked directly: the draft-vs-save behaviour, the
   icon & colour swatches, the delete confirm, and that the contract panel
   mounts without an eventId (it no-ops rather than fetching). */

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import BudgetLineDetail from '@/kalas/screens/BudgetLineDetail';
import type { BudgetSubItemRow } from '@/lib/db/types';

const now = new Date().toISOString();

export default function DevBudgetDetailPage() {
  return (
    <Suspense>
      <Harness />
    </Suspense>
  );
}

function Harness() {
  /* `?category=rental` opens a standard line, to see its sub-item suggestions. */
  const category = useSearchParams().get('category') ?? 'custom-1';
  const [open, setOpen] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((l) => [...l, line]);
  const [subItems, setSubItems] = useState<BudgetSubItemRow[]>([
    { id: 's1', event_id: 'dev', user_id: 'dev', category: 'custom-1', label: 'Telt', vendor: 'Partytelte ApS', amount: 15000, sort: 0, created_at: now },
    { id: 's2', event_id: 'dev', user_id: 'dev', category: 'custom-1', label: 'Stole', vendor: 'Møbeludlejning Fyn', amount: 3000, sort: 1, created_at: now },
  ]);

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
            categoryId={category}
            label={category === 'custom-1' ? 'Transport' : category}
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
            subItems={subItems}
            onAddSubItem={(item) => {
              const row: BudgetSubItemRow = {
                id: `s${Date.now()}`, event_id: 'dev', user_id: 'dev', category: 'custom-1',
                label: item.label, vendor: item.vendor ?? null, amount: item.amount, sort: subItems.length, created_at: now,
              };
              setSubItems((rows) => [...rows, row]);
              note(`add sub-item: ${JSON.stringify(item)}`);
            }}
            onUpdateSubItem={(id, patch) => {
              setSubItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
              note(`update sub-item ${id}: ${JSON.stringify(patch)}`);
            }}
            onDeleteSubItem={(id) => {
              setSubItems((rows) => rows.filter((r) => r.id !== id));
              note(`delete sub-item ${id}`);
            }}
          />
        )}
      </div>
    </LanguageProvider>
  );
}
