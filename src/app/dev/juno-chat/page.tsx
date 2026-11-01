"use client";

/* Harness for Juno's chat panel — the real component, without a session or a
   model. Supabase's REST calls for threads, messages and memories are answered
   from the fixtures below, and POST /api/chat streams a scripted turn: two
   tools, one of them slow, then a reply. `?view=new` opens on an empty chat. */

import Shell from '@/kalas/Shell';
import JunoPanel from '@/kalas/screens/JunoPanel';
import { LanguageProvider } from '@/kalas/i18n';
import type { JunoMemoryRow, ChatMessageRow, ChatThreadRow } from '@/lib/db/types';
import { FixtureWedding } from '../_fixture/wedding';

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const base = { event_id: 'dev', user_id: 'dev' };

const THREADS: ChatThreadRow[] = [
  { ...base, id: 't1', title: 'Hvor står budgettet?', created_at: ago(2), updated_at: ago(1) },
  { ...base, id: 't2', title: 'Fotograf der også kan filme', created_at: ago(30), updated_at: ago(26) },
  { ...base, id: 't3', title: 'Gæsteliste fra mormor', created_at: ago(24 * 9), updated_at: ago(24 * 9) },
];

const MESSAGES: ChatMessageRow[] = [
  { ...base, id: 'm1', thread_id: 't1', role: 'user', content: 'Hvor står budgettet? Og så vil vi gerne have 5.000 mere til blomster.', payload: null, created_at: ago(1.2) },
  {
    ...base, id: 'm2', thread_id: 't1', role: 'assistant', payload: null, created_at: ago(1.1),
    content: 'I har planlagt **212.000 kr** af de 225.000 kr, så der er 13.000 kr tilbage.\n\nJeg har hævet blomster fra 15.000 til **20.000 kr**, og noteret at I gerne vil have mange pæoner.\n\n- Lokale: 85.000 kr (betalt depositum)\n- Mad og drikke: 72.000 kr\n- Blomster: 20.000 kr\n\nSkal jeg finde en florist på Fyn, der arbejder med pæoner?',
    tool_calls: [
      { id: '0-0', name: 'get_planning_overview', args: {}, ok: true, result: '{"budget":{"total_dkk":225000,"planned_sum_dkk":207000}}' },
      { id: '1-0', name: 'set_budget_entry', args: { category: 'florals', label: 'Blomster', planned_amount: 20000 }, ok: true, result: '{"ok":true}' },
      { id: '1-1', name: 'remember', args: { content: 'Ønsker mange pæoner i buketter og borddekoration', category: 'preference' }, ok: true, result: '{"ok":true,"memory_id":"x"}' },
      { id: '2-0', name: 'show_page', args: { page: 'budget' }, ok: true, result: '{"ok":true}' },
    ],
  },
];

const MEMORIES: JunoMemoryRow[] = [
  { ...base, id: 'a1', category: 'preference', content: 'Ønsker mange pæoner i buketter og borddekoration', created_at: ago(1), updated_at: ago(1) },
  { ...base, id: 'a2', category: 'preference', content: 'Vil ikke have DJ, kun liveband', created_at: ago(40), updated_at: ago(40) },
  { ...base, id: 'a3', category: 'decision', content: 'Vielsen er i Svendborg Kirke kl. 13', created_at: ago(90), updated_at: ago(90) },
  { ...base, id: 'a4', category: 'fact', content: 'Emmas mormor sidder i kørestol og skal have plads ved døren', created_at: ago(200), updated_at: ago(200) },
  { ...base, id: 'a5', category: 'followup', content: 'Spørg om fotografen kan filme talerne', created_at: ago(26), updated_at: ago(26) },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function scriptedTurn(message: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const frame = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  return new ReadableStream({
    async start(c) {
      const thread: ChatThreadRow = { ...base, id: `t-${Date.now()}`, title: message.slice(0, 60), created_at: ago(0), updated_at: ago(0) };
      c.enqueue(frame('thread', thread));
      c.enqueue(frame('user_message', { ...base, id: `u-${Date.now()}`, thread_id: thread.id, role: 'user', content: message, payload: null, created_at: ago(0) }));
      await sleep(500);
      const tools = [
        { id: '0-0', name: 'get_planning_overview', args: {} },
        { id: '0-1', name: 'list_tasks', args: {} },
      ];
      for (const tool of tools) c.enqueue(frame('tool', { phase: 'start', ...tool }));
      await sleep(700);
      c.enqueue(frame('tool', { phase: 'end', ...tools[0], ok: true, result: '{"tasks":{"overdue":1}}' }));
      await sleep(1600);
      c.enqueue(frame('tool', { phase: 'end', ...tools[1], ok: true, result: '{"tasks":[]}' }));
      await sleep(400);
      c.enqueue(frame('message', {
        ...base, id: `a-${Date.now()}`, thread_id: thread.id, role: 'assistant', payload: null, created_at: ago(0),
        content: 'Tre ting er de næste:\n\n- **Book fotograf** inden 1. november\n- Send save the dates\n- Afklar menu med Svendborg Kro',
        tool_calls: tools.map((t) => ({ ...t, ok: true, result: '{}' })),
      }));
      c.close();
    },
  });
}

if (typeof window !== 'undefined' && !(window as { __avaMock?: boolean }).__avaMock) {
  (window as { __avaMock?: boolean }).__avaMock = true;
  const real = window.fetch.bind(window);
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const empty = new URLSearchParams(window.location.search).get('view') === 'new';
    if (url.includes('/rest/v1/chat_threads')) return json(empty ? [] : THREADS);
    if (url.includes('/rest/v1/chat_messages')) {
      const id = /thread_id=eq\.([^&]+)/.exec(url)?.[1];
      return json(MESSAGES.filter((m) => m.thread_id === id));
    }
    if (url.includes('/rest/v1/ava_memories')) return json(init?.method === 'DELETE' ? [] : MEMORIES);
    if (url.endsWith('/api/chat')) {
      const { message } = JSON.parse(String(init?.body ?? '{}'));
      return new Response(scriptedTurn(message), { headers: { 'Content-Type': 'text/event-stream' } });
    }
    return real(input, init);
  };
}

export default function DevJunoChatPage() {
  return (
    <LanguageProvider initialLang="da">
      <FixtureWedding>
        <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
          <Shell current="budget" onNavigate={() => {}} juno={<JunoPanel onClose={() => {}} />} junoOpen>
            <div className="p-8"><div className="h-[900px] rounded-[20px] border border-line bg-shell" /></div>
          </Shell>
        </div>
      </FixtureWedding>
    </LanguageProvider>
  );
}
