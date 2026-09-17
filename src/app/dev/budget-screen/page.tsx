"use client";

/* The real Budget screen against a fixture wedding. Every category starts
   unseeded, so this shows the usual posts arriving once, folded out, with the
   paid ticks; the photographer's post is already paid and priced. */

import { LanguageProvider } from '@/kalas/i18n';
import Budget from '@/kalas/screens/Budget';
import { estimatedLines } from '@/kalas/screens/budget/estimate';
import { FixtureWedding } from '../_fixture/wedding';
import type { BudgetItemRow, BudgetSubItemRow } from '@/lib/db/types';

const now = new Date().toISOString();

const ITEMS: BudgetItemRow[] = estimatedLines(225000).map((l, i) => ({
  id: `b${i}`, event_id: 'dev', user_id: 'dev', paid_amount: 0, actual_cost: 0, notes: null, reminder_at: null,
  created_at: now, sub_items_seeded: false, ...l,
}));

const SUBS: BudgetSubItemRow[] = [
  { id: 's-photo', event_id: 'dev', user_id: 'dev', category: 'photo', label: 'Fotograf', vendor: 'Lys & Linse', amount: 18500, sort: 0, paid: true, created_at: now },
];

export default function DevBudgetScreenPage() {
  return (
    <LanguageProvider initialLang="da">
      <FixtureWedding budgetItems={ITEMS} budgetSubItems={SUBS}>
        <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
          <Budget />
        </div>
      </FixtureWedding>
    </LanguageProvider>
  );
}
