import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle, Monitor, Settings,
} from 'lucide-react';
import {
  NAV, NavRow, Wordmark, useNav, ModeToggle, PAGE_BG, CHROME_BG, CHROME_WASH,
  SIDEBAR_RAIL_W, type ScreenId,
} from './Shell';
import { cn } from './ui';
import { useLang } from './i18n';

/*
 * Chat mode: collapsed icon-rail sidebar + Ava-driven stage. The chat column
 * sits on the right; the stage in the middle renders whichever screen Ava (or
 * the user, via the rail icons) pulls up. On mobile the two become switchable
 * views, and agent navigation flips to the stage automatically.
 */

export default function ChatShell({
  current,
  onNavigate,
  onChatModeChange,
  stageSignal,
  inboxBadge = 0,
  hideModeToggle = false,
  chat,
  children,
}: {
  current: ScreenId;
  onNavigate: (s: ScreenId) => void;
  onChatModeChange: (on: boolean) => void;
  /** Increments every time the agent navigates — flips mobile to the stage. */
  stageSignal: number;
  inboxBadge?: number;
  /** Hidden during the walkthrough — the couple chooses their mode at the end. */
  hideModeToggle?: boolean;
  chat: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const nav = useNav();
  const [mobileView, setMobileView] = useState<'chat' | 'stage'>('chat');

  // Agent-driven navigation should be seen: switch the mobile view to the
  // stage whenever a ui action lands (desktop shows both, so no-op there).
  const lastSignal = useRef(stageSignal);
  useEffect(() => {
    if (stageSignal !== lastSignal.current) {
      lastSignal.current = stageSignal;
      setMobileView('stage');
    }
  }, [stageSignal]);

  const currentLabel = NAV.find((n) => n.id === current)?.label ?? '';
  const navigate = (s: ScreenId) => {
    onNavigate(s);
    setMobileView('stage');
  };

  return (
    <div className="flex h-dvh overflow-hidden text-ink" style={{ backgroundColor: CHROME_BG }}>
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundImage: CHROME_WASH }}
        />

        {/* ── Collapsed icon rail (desktop) ──────────────────────────── */}
        <aside
          className="relative z-10 hidden h-full shrink-0 overflow-hidden lg:block"
          style={{ width: SIDEBAR_RAIL_W }}
        >
          <div className="flex h-full min-h-0 flex-col px-2.5 py-5">
            <div className="flex shrink-0 flex-col items-center gap-2 px-1 pb-3">
              <span className="font-serif text-[1.35rem] leading-none text-[#24413a]" aria-hidden>K</span>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto pt-1" aria-label={t('Alle sider')}>
              {nav.filter((n) => n.group === 'main').map((n) => (
                <NavRow
                  key={n.id}
                  item={n}
                  active={current === n.id}
                  onClick={() => navigate(n.id)}
                  badge={n.id === 'inbox' ? inboxBadge : undefined}
                  collapsed
                />
              ))}
              <div className="mx-auto my-3 h-px w-8 bg-[#dcdfdb]" />
              {nav.filter((n) => n.group === 'plan').map((n) => (
                <NavRow
                  key={n.id}
                  item={n}
                  active={current === n.id}
                  onClick={() => navigate(n.id)}
                  collapsed
                />
              ))}
              <div className="mx-auto my-3 h-px w-8 bg-[#dcdfdb]" />
              {nav.filter((n) => n.group === 'help').map((n) => (
                <NavRow
                  key={n.id}
                  item={n}
                  active={current === n.id}
                  onClick={() => navigate(n.id)}
                  collapsed
                />
              ))}
            </nav>
          </div>
        </aside>

        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          {/* ── Header ───────────────────────────────────────────────── */}
          <header className="flex h-12 shrink-0 items-center justify-between gap-3 px-4 lg:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="lg:hidden"><Wordmark /></span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!hideModeToggle && <ModeToggle chatMode onChange={onChatModeChange} />}
              <a
                href="/settings"
                aria-label={t('Indstillinger')}
                className="flex size-8 items-center justify-center rounded-full border border-[#dcdfdb] text-[#5f6b66] transition-colors hover:bg-[#24413a]/6 hover:text-[#24413a]"
              >
                <Settings size={15} strokeWidth={1.6} />
              </a>
            </div>
          </header>

          {/* ── Body: stage + chat column (chat on the right) ────────── */}
          <div className="flex min-h-0 flex-1">
            {/* Stage, the page Ava pulled up */}
            <section
              aria-label={t('Skærm')}
              className={cn(
                'min-h-0 min-w-0 flex-1 flex-col px-0 lg:flex lg:px-3',
                mobileView === 'stage' ? 'flex w-full' : 'hidden',
              )}
            >
              <main
                className="relative min-w-0 flex-1 overflow-y-auto rounded-t-[20px] border border-[#e2e6e2] border-b-0 pb-28 lg:pb-0"
                style={{ backgroundColor: PAGE_BG }}
              >
                {/* Stage strip: what Ava is showing right now */}
                <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-[#e2e6e2]/70 bg-[#f4f5f3]/92 px-5 py-2 backdrop-blur-sm">
                  <Monitor size={13} className="text-[#7d938a]" />
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={current}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.16 }}
                      className="text-[0.72rem] font-semibold text-[#46574f]"
                    >
                      {t('Viser: {page}', { page: t(currentLabel) })}
                    </motion.span>
                  </AnimatePresence>
                  <span className="ml-auto hidden text-[0.68rem] italic text-[#8a9992] md:block">
                    {t('Ava styrer skærmen, sig hvad I vil se.')}
                  </span>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={current}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="min-h-full"
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </main>
            </section>

            {/* Chat panel, always mounted so the stream survives view flips.
                The same surface as the stage, so the two read as a pair. */}
            <section
              aria-label={t('Tal med Ava')}
              className={cn(
                'h-full min-h-0 flex-col',
                // Mobile: full width, toggled; desktop: fixed panel on the right.
                mobileView === 'chat' ? 'flex w-full' : 'hidden',
                'lg:flex lg:w-[400px] lg:shrink-0 lg:pr-3 xl:w-[448px]',
              )}
            >
              <div
                className="flex h-full w-full min-h-0 flex-col overflow-hidden rounded-t-[20px] border border-[#e2e6e2] border-b-0 pb-[76px] lg:pb-0"
                style={{ backgroundColor: PAGE_BG }}
              >
                {chat}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ── Mobile chat/stage switch ─────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="mx-auto mb-4 flex w-fit items-center gap-1 rounded-full bg-card/95 p-1.5 shadow-[0_8px_30px_rgba(46,51,37,0.10)] backdrop-blur-xl rule">
          {(
            [
              { id: 'chat' as const, label: 'Chat', icon: MessageCircle },
              { id: 'stage' as const, label: 'Skærm', icon: Monitor },
            ]
          ).map(({ id, label, icon: Icon }) => {
            const active = mobileView === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMobileView(id)}
                aria-pressed={active}
                className="relative flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.8rem] font-semibold cursor-pointer"
              >
                {active && (
                  <motion.span
                    layoutId="kalas-chatmode-tab"
                    className="absolute inset-0 rounded-full bg-sage-tint"
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  />
                )}
                <Icon size={15} strokeWidth={1.8} className={cn('relative z-10', active ? 'text-ink' : 'text-muted')} />
                <span className={cn('relative z-10', active ? 'text-ink' : 'text-muted')}>{t(label)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
