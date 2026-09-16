"use client";

/* Harness for TaskDialog and the row it opens from. The real rows need a
   signed-in couple and a seeded checklist; the dialog takes plain props. Two
   rows: one with every detail set (flag, note icon, owner chip), one bare. */

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LanguageProvider } from '@/kalas/i18n';
import TaskRow from '@/kalas/screens/planning/TaskRow';
import TaskDialog from '@/kalas/screens/planning/TaskDialog';
import { assigneeInitials, assigneeName, priorityOf } from '@/kalas/screens/planning/shared';
import type { TimelineTaskRow } from '@/lib/db/types';

const couple = { a: 'Emma', b: 'Frederik' };
const now = new Date().toISOString();

const SEED: TimelineTaskRow[] = [
  {
    id: 't1', event_id: 'dev', user_id: 'dev', title: 'Design bryllupsinvitationer', due_date: '2026-10-28',
    done: false, category: 'papir', kind: 'check', sort: 0, created_at: now,
    priority: 'high', assignee: 'both', notes: 'Papirvalg aftalt med trykkeriet.',
  },
  {
    id: 't2', event_id: 'dev', user_id: 'dev', title: 'Bestil prøvesmagning', due_date: null,
    done: false, category: 'mad', kind: 'check', sort: 1, created_at: now,
  },
];

export default function DevTaskDialogPage() {
  return (
    <Suspense>
      <Harness />
    </Suspense>
  );
}

function Harness() {
  /* `?closed` starts on the rows alone. */
  const closed = useSearchParams().has('closed');
  const [rows, setRows] = useState(SEED);
  const [openId, setOpenId] = useState<string | null>(closed ? null : 't1');
  const [log, setLog] = useState<string[]>([]);
  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <LanguageProvider initialLang="da">
      <div className="theme-kalas min-h-screen space-y-3 bg-canvas p-8 text-ink">
        <p className="eyebrow mb-6">Dev · TaskDialog</p>
        {rows.map((r) => (
          <TaskRow
            key={r.id}
            task={{
              id: r.id, title: r.title, dateISO: r.due_date, done: r.done, weddingDay: false,
              priority: priorityOf(r),
              assigneeInitials: assigneeInitials(r.assignee, couple),
              assigneeName: assigneeName(r.assignee, couple),
              hasNotes: !!r.notes,
            }}
            deleteLabel="Slet punkt"
            menuOpen={false}
            onMenu={() => {}}
            onCloseMenu={() => {}}
            onToggle={() => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)))}
            onOpen={() => setOpenId(r.id)}
            onDateChange={() => {}}
          />
        ))}
        <pre className="text-[12px] text-ink-soft">{log.join('\n') || 'ingen handling endnu'}</pre>
        {open && (
          <TaskDialog
            task={open}
            couple={couple}
            onClose={() => setOpenId(null)}
            onSave={(patch) => {
              setLog((l) => [...l, `save ${open.id}: ${JSON.stringify(patch)}`]);
              setRows((rs) => rs.map((x) => (x.id === open.id ? { ...x, ...patch } : x)));
            }}
            onDelete={() => setLog((l) => [...l, `delete ${open.id}`])}
          />
        )}
      </div>
    </LanguageProvider>
  );
}
