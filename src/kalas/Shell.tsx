import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, UsersRound,
  Wallet, Users, Globe, Mail, ListChecks, LayoutDashboard,
  LayoutGrid, X, Settings, Gift, PanelLeftClose, PanelLeft,
  LogOut, UserPlus, Inbox,
  MessageCircle, BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import WeddingRings from './icons/WeddingRings';
import { useWedding } from './useWedding';
import { nygiftInMenu } from './screens/nygift/shared';
import { cn } from './ui';
import { useLang } from './i18n';
import { SignOutButton } from '@/components/auth/SignOutButton';

export type ScreenId =
  | 'home' | 'ava' | 'team' | 'inbox'
  | 'budget' | 'guests' | 'website' | 'registry' | 'invites' | 'planning' | 'seating'
  | 'nygift' | 'guides';

export type NavItem = { id: ScreenId; label: string; icon: LucideIcon; group: 'main' | 'plan' | 'help' };

export const NAV: NavItem[] = [
  { id: 'home',        label: 'Hjem',          icon: Home,          group: 'main' },
  { id: 'planning',    label: 'Planlægning',   icon: ListChecks,    group: 'main' },
  { id: 'inbox',       label: 'Henvendelser',  icon: Inbox,         group: 'main' },
  { id: 'team',        label: 'Venue & leverandører', icon: UsersRound,  group: 'plan' },
  { id: 'budget',      label: 'Budget',        icon: Wallet,        group: 'plan' },
  { id: 'guests',      label: 'Gæster',        icon: Users,         group: 'plan' },
  { id: 'website',     label: 'Hjemmeside',    icon: Globe,         group: 'plan' },
  { id: 'registry',    label: 'Ønskeliste',    icon: Gift,          group: 'plan' },
  { id: 'invites',     label: 'Invitationer',  icon: Mail,          group: 'plan' },
  { id: 'seating',     label: 'Bordplan',      icon: LayoutDashboard, group: 'plan' },
  { id: 'nygift',      label: 'Nygift',        icon: WeddingRings,  group: 'plan' },
  { id: 'guides',      label: 'Guides & FAQ',  icon: BookOpen,      group: 'help' },
];

/** The menu as this wedding sees it: Nygift joins a week before the day. */
export function useNav(): NavItem[] {
  const { event } = useWedding();
  const withNygift = nygiftInMenu(event?.event_date);
  return withNygift ? NAV : NAV.filter((n) => n.id !== 'nygift');
}

const MOBILE_TABS: ScreenId[] = ['home', 'planning', 'inbox'];

const SIDEBAR_W = 224;
const SIDEBAR_RAIL_W = 72;

const shellTransition = { type: 'spring' as const, stiffness: 380, damping: 36 };

/** The page surface, and the chrome behind the sidebar + header. */
export const PAGE_BG = 'var(--color-canvas)';
export const CHROME_BG = 'var(--color-chrome)';
/** Soft green wash from top-left (sits behind sidebar + header as one layer) */
export const CHROME_WASH =
  'radial-gradient(ellipse 520px 380px at 0% 0%, rgba(31,77,64,0.16) 0%, rgba(31,77,64,0.07) 42%, transparent 72%)';

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span
      className={cn(
        'text-[1.75rem] leading-none',
        light ? 'text-paper' : 'text-ink',
      )}
      style={{ fontFamily: 'var(--font-wordmark)', fontWeight: 700, letterSpacing: 0 }}
    >
      Kalas
    </span>
  );
}

function Initials({ light = false }: { light?: boolean }) {
  const { couple } = useWedding();
  const a = couple.a.trim()[0] ?? '';
  const b = couple.b.trim()[0] ?? '';
  if (!a && !b) return null;
  return (
    <div
      className={cn(
        'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[0.72rem] font-bold tracking-wide',
        light ? 'bg-terracotta text-white' : 'bg-ink text-canvas',
      )}
    >
      {a}{b ? `+${b}` : ''}
    </div>
  );
}

export default function Shell({
  current,
  onNavigate,
  inboxBadge = 0,
  ava,
  avaOpen = false,
  onAvaOpenChange,
  avaSignal = 0,
  children,
}: {
  current: ScreenId;
  onNavigate: (s: ScreenId) => void;
  inboxBadge?: number;
  /** Ava's chat. Beside the page from xl, over it as a drawer from lg, and a
   *  full-screen sheet on a phone. Kept mounted while closed, so a reply that
   *  is still streaming survives the panel being put away. */
  ava?: React.ReactNode;
  avaOpen?: boolean;
  onAvaOpenChange?: (open: boolean) => void;
  /** Bumped when Ava opens a page. On a phone the sheet steps aside, so the
   *  couple sees the page she opened. */
  avaSignal?: number;
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const nav = useNav();
  const [moreOpen, setMoreOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const main = useRef<HTMLElement>(null);

  const sidebarRail = sidebarCollapsed;
  const navigate = (s: ScreenId) => { setMoreOpen(false); onNavigate(s); };
  const moreActive = !MOBILE_TABS.includes(current);
  const setAva = (open: boolean) => { setMoreOpen(false); onAvaOpenChange?.(open); };

  // A new page starts at its top; the page scrolls inside <main>, not the window.
  useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [current]);

  // The tab says which page this is. Next writes its own title into the head
  // after the app mounts, so the page's is put back whenever the head changes.
  const pageLabel = NAV.find((n) => n.id === current)?.label;
  const tabTitle = pageLabel ? `${t(pageLabel)} · Kalas` : 'Kalas';
  useEffect(() => {
    const apply = () => { if (document.title !== tabTitle) document.title = tabTitle; };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [tabTitle]);

  const lastSignal = useRef(avaSignal);
  const setAvaRef = useRef(setAva);
  useEffect(() => { setAvaRef.current = setAva; });
  useEffect(() => {
    if (avaSignal === lastSignal.current) return;
    lastSignal.current = avaSignal;
    if (window.matchMedia('(max-width: 1023.98px)').matches) setAvaRef.current(false);
  }, [avaSignal]);

  return (
    <div className="flex h-dvh overflow-hidden text-ink" style={{ backgroundColor: CHROME_BG }}>
      {/*
        Shared chrome frame: sidebar + header sit in one relative plane so a
        single top-left wash can span both. Main content is solid so it clips
        the wash below the header.
      */}
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundImage: CHROME_WASH }}
        />

        {/* ── Desktop sidebar (transparent over shared wash) ──────────── */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarRail ? SIDEBAR_RAIL_W : SIDEBAR_W }}
          transition={shellTransition}
          className="relative z-10 hidden h-full shrink-0 overflow-hidden lg:block"
        >
          <div className={cn(
            'flex h-full min-h-0 flex-col py-5',
            sidebarRail ? 'px-2.5' : 'px-4',
          )}>
            <div className={cn(
              'shrink-0',
              sidebarRail ? 'flex flex-col items-center gap-2 px-1 pb-2' : 'flex h-16 items-center justify-between px-3',
            )}>
              {sidebarRail ? (
                <>
                  <div className="flex w-full justify-end">
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed(false)}
                      aria-label={t('Vis menu')}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-ink/8 hover:text-ink cursor-pointer"
                    >
                      <PanelLeft size={18} strokeWidth={1.6} />
                    </button>
                  </div>
                  <span className="font-serif text-[1.35rem] leading-none text-ink" aria-hidden>K</span>
                </>
              ) : (
                <>
                  <Wordmark />
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(true)}
                    aria-label={t('Skjul menu')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-ink/8 hover:text-ink cursor-pointer"
                  >
                    <PanelLeftClose size={18} strokeWidth={1.6} />
                  </button>
                </>
              )}
            </div>

            <nav className={cn('min-h-0 flex-1 overflow-y-auto', sidebarRail ? 'pt-1' : 'mt-1 pt-[18px]')}>
              {nav.filter((n) => n.group === 'main').map((n) => (
                <NavRow key={n.id} item={n} active={current === n.id} onClick={() => navigate(n.id)}
                  badge={n.id === 'inbox' ? inboxBadge : undefined}
                  collapsed={sidebarRail}
                />
              ))}
              {!sidebarRail && (
                <p className="mt-6 pb-2 pl-3 text-[10px] font-bold uppercase tracking-[0.16em] text-sage">
                  {t('Brylluppet')}
                </p>
              )}
              {sidebarRail && <div className="mx-auto my-3 h-px w-8 bg-line" />}
              {nav.filter((n) => n.group === 'plan').map((n) => (
                <NavRow key={n.id} item={n} active={current === n.id} onClick={() => navigate(n.id)}
                  collapsed={sidebarRail}
                />
              ))}
              {!sidebarRail && (
                <p className="mt-6 pb-2 pl-3 text-[10px] font-bold uppercase tracking-[0.16em] text-sage">
                  {t('Hjælp')}
                </p>
              )}
              {sidebarRail && <div className="mx-auto my-3 h-px w-8 bg-line" />}
              {nav.filter((n) => n.group === 'help').map((n) => (
                <NavRow key={n.id} item={n} active={current === n.id} onClick={() => navigate(n.id)}
                  collapsed={sidebarRail}
                />
              ))}
            </nav>

            <div className={cn(
              'mt-4 shrink-0 border-t border-line-soft pt-4',
              sidebarRail ? 'flex flex-col items-center gap-1.5' : 'flex flex-col gap-1',
            )}>
              {sidebarRail ? (
                <>
                  <SignOutButton
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-ink/8 hover:text-ink disabled:opacity-50"
                  >
                    <LogOut size={17} strokeWidth={1.6} aria-hidden />
                    <span className="sr-only">{t('Log ud')}</span>
                  </SignOutButton>
                  <a
                    href="/settings#partner"
                    aria-label={t('Invitér jeres partner')}
                    title={t('Invitér jeres partner')}
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-ink/8 hover:text-ink"
                  >
                    <UserPlus size={17} strokeWidth={1.6} />
                  </a>
                </>
              ) : (
                <>
                  <SignOutButton
                    className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-meta font-medium text-ink-soft transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-50"
                  >
                    <LogOut size={17} strokeWidth={1.6} className="shrink-0" />
                    {t('Log ud')}
                  </SignOutButton>
                  <a
                    href="/settings#partner"
                    className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-meta font-medium text-ink-soft transition-colors hover:bg-ink/[0.06] hover:text-ink"
                  >
                    <UserPlus size={17} strokeWidth={1.6} className="shrink-0" />
                    {t('Invitér jeres partner')}
                  </a>
                </>
              )}
            </div>
          </div>
        </motion.aside>

        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Header shares the same wash layer as the sidebar (no own bg) */}
          <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-4 lg:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="lg:hidden"><Wordmark /></span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {ava && (
                <button
                  type="button"
                  data-tour="ava-chat"
                  aria-pressed={avaOpen}
                  onClick={() => setAva(!avaOpen)}
                  className={cn(
                    'hidden h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors lg:flex',
                    avaOpen ? 'border-ink bg-ink text-paper' : 'border-line bg-card/70 text-ink hover:border-ink',
                  )}
                >
                  <MessageCircle size={14} strokeWidth={1.8} aria-hidden />
                  {t('Ava')}
                </button>
              )}
              <a
                href="/settings"
                aria-label={t('Indstillinger')}
                className="flex size-8 items-center justify-center rounded-full border border-line text-muted transition-colors hover:bg-ink/6 hover:text-ink"
              >
                <Settings size={15} strokeWidth={1.6} />
              </a>
              <span className="lg:hidden"><Initials /></span>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 pl-2.5 lg:pl-3">
            {/* Solid page surface, covers the wash below the header */}
            <main
              id="kalas-main"
              ref={main}
              className="min-w-0 flex-1 overflow-y-auto rounded-tl-[20px] border border-line-soft border-b-0 border-r-0 pb-28 lg:pb-0 xl:rounded-tr-[20px] xl:border-r"
              style={{ backgroundColor: PAGE_BG }}
            >
              <div className="min-h-full">{children}</div>
            </main>

            {ava && (
              <aside
                aria-label={t('Ava')}
                className={cn(
                  avaOpen ? 'flex' : 'hidden',
                  // Phone: the whole screen, over the page and the bottom bar.
                  'fixed inset-0 z-50 flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
                  // lg: a drawer over the page, so a two-column screen keeps its width.
                  'lg:inset-auto lg:top-12 lg:right-3 lg:bottom-0 lg:z-30 lg:w-[400px] lg:rounded-t-[20px] lg:border lg:border-b-0 lg:border-line-soft lg:p-0 lg:shadow-[0_24px_60px_-20px_rgba(18,51,43,0.35)]',
                  // xl: beside the page.
                  'xl:static xl:z-auto xl:mx-3 xl:shrink-0 xl:shadow-none 2xl:w-[440px]',
                )}
                style={{ backgroundColor: PAGE_BG }}
              >
                {ava}
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────────────── */}
      {/* Put away while Ava's sheet is up: it would sit over her message box,
          and the sheet has its own way down. */}
      <nav className={cn('fixed inset-x-0 bottom-0 z-40 lg:hidden', avaOpen && Boolean(ava) && 'hidden')}>
        <div className="mx-auto mb-4 flex max-w-sm items-center justify-between gap-1 rounded-full bg-card/95 px-2 py-2 shadow-[0_8px_30px_rgba(46,51,37,0.10)] backdrop-blur-xl rule">
          {[...MOBILE_TABS.slice(0, 2), 'ava' as const, ...MOBILE_TABS.slice(2)].map((id) => {
            if (id === 'ava') {
              if (!ava) return null;
              return (
                <button key="ava" type="button" data-tour="ava-chat" onClick={() => setAva(true)} aria-label={t('Ava')}
                  className="relative flex flex-1 flex-col items-center gap-1 rounded-full py-2 cursor-pointer">
                  <span className="relative z-10 flex size-7 -my-1 items-center justify-center rounded-full bg-ink text-paper">
                    <MessageCircle size={15} strokeWidth={1.8} />
                  </span>
                </button>
              );
            }
            const item = NAV.find((n) => n.id === id)!;
            const Icon = item.icon;
            const active = current === id && !moreOpen;
            return (
              <button key={id} onClick={() => navigate(id)} aria-label={t(item.label)}
                className="relative flex flex-1 flex-col items-center gap-1 rounded-full py-2 cursor-pointer">
                {active && (
                  <motion.span layoutId="kalas-tab" className="absolute inset-0 rounded-full bg-sage-tint"
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }} />
                )}
                <Icon size={19} strokeWidth={1.6} className={cn('relative z-10', active ? 'text-ink' : 'text-muted')} />
                {id === 'inbox' && inboxBadge > 0 && (
                  <span className="absolute right-[22%] top-1 z-10 size-2 rounded-full bg-terracotta" aria-hidden />
                )}
              </button>
            );
          })}
          {/* Mere */}
          <button onClick={() => setMoreOpen((v) => !v)} aria-label={t('Flere sider')} aria-expanded={moreOpen}
            className="relative flex flex-1 flex-col items-center gap-1 rounded-full py-2 cursor-pointer">
            {(moreOpen || moreActive) && (
              <motion.span layoutId="kalas-tab" className="absolute inset-0 rounded-full bg-sage-tint"
                transition={{ type: 'spring', stiffness: 320, damping: 30 }} />
            )}
            <LayoutGrid size={19} strokeWidth={1.6}
              className={cn('relative z-10', moreOpen || moreActive ? 'text-ink' : 'text-muted')} />
          </button>
        </div>
      </nav>

      {/* ── Mobile "Mere" sheet ─────────────────────────────────────── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] lg:hidden"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-canvas px-6 pt-5 pb-24 lg:hidden"
              role="dialog" aria-label={t('Alle sider')}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="eyebrow">{t('Alle sider')}</p>
                <button onClick={() => setMoreOpen(false)} aria-label={t('Luk')}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-shell text-muted hover:text-ink cursor-pointer">
                  <X size={15} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {nav.filter((n) => n.group !== 'main' || !MOBILE_TABS.includes(n.id)).map((n) => {
                  const Icon = n.icon;
                  const active = current === n.id;
                  return (
                    <button key={n.id} onClick={() => navigate(n.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-2xl px-2 py-4 transition-colors cursor-pointer',
                        active ? 'bg-sage-tint text-ink' : 'bg-card text-ink-soft hover:bg-shell',
                      )}>
                      <Icon size={20} strokeWidth={1.6} />
                      <span className="text-[0.72rem] font-medium">{t(n.label)}</span>
                    </button>
                  );
                })}
                <a href="/settings"
                  className="flex flex-col items-center gap-2 rounded-2xl bg-card px-2 py-4 text-ink-soft transition-colors hover:bg-shell">
                  <Settings size={20} strokeWidth={1.6} />
                  <span className="text-[0.72rem] font-medium">{t('Indstillinger')}</span>
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NavRow({ item, active, onClick, badge, collapsed = false }: {
  item: NavItem; active: boolean; onClick: () => void; badge?: number; collapsed?: boolean;
}) {
  const { t } = useLang();
  const Icon = item.icon;
  return (
    <button onClick={onClick} aria-label={t(item.label)} title={collapsed ? t(item.label) : undefined}
      data-tour={item.id}
      className={cn(
        'group relative mb-1.5 flex w-full items-center rounded-[10px] text-left transition-colors duration-200 cursor-pointer',
        collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
        active
          ? 'bg-white/70 text-ink shadow-sm'
          : 'text-ink-soft hover:bg-ink/[0.06] hover:text-ink',
      )}>
      <span className="relative z-10 shrink-0">
        <Icon size={18} strokeWidth={2} />
        {collapsed && badge ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-0.5 text-[0.55rem] font-bold text-white">
            {badge}
          </span>
        ) : null}
      </span>
      {!collapsed && (
        <>
          <span className="relative z-10 text-sm font-semibold">{t(item.label)}</span>
          {badge ? (
            <span className="relative z-10 ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1.5 text-[0.65rem] font-bold text-white">
              {badge}
            </span>
          ) : null}
        </>
      )}
    </button>
  );
}
