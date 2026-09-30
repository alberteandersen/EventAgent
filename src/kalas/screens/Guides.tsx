'use client';

/* The guide and the FAQ inside the app. Same content as /guide, but the
   buttons open the part of Kalas that does the job, not a sign-up page, and a
   link to another guide opens it here instead of leaving the app. */

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, BookOpen, Check, ExternalLink, MessageCircleQuestion, Search, X } from 'lucide-react';
import { ARTICLES, CATEGORIES, articlesIn, getArticle, getCategory, relatedTo } from '@/content/guide';
import type { GuideArticle } from '@/content/guide/types';
import { FAQ } from '@/content/faq';
import { Markdown } from '@/components/guide/Markdown';
import { FaqItemCard } from '@/components/guide/FaqItemCard';
import { parseMarkdown, readingMinutes } from '@/lib/guide/markdown';
import { useLang } from '../i18n';
import { Page, PageHeader, Tabs } from '../ui';
import type { NavigateTarget } from '../lib/hub-nav';
import { GUIDE_ACTION, OPEN_GUIDE_EVENT, peekPendingGuide, takePendingGuide } from './guides/links';

type Tab = 'guides' | 'faq';

const FAQ_ITEMS = FAQ.flatMap((g) => g.items);
const normalize = (s: string) => s.toLowerCase().normalize('NFKC');

export default function Guides({ onNavigate }: { onNavigate?: (s: NavigateTarget) => void }) {
  const { t, lang } = useLang();
  const top = useRef<HTMLDivElement>(null);
  // A guide asked for before this screen mounted waits in sessionStorage.
  const [pending] = useState(peekPendingGuide);
  const [tab, setTab] = useState<Tab>(pending === 'faq' ? 'faq' : 'guides');
  const [slug, setSlug] = useState<string | null>(pending && getArticle(pending) ? pending : null);
  const [query, setQuery] = useState('');

  const open = (target: string) => {
    if (target === 'faq') {
      setSlug(null);
      setTab('faq');
    } else if (getArticle(target)) {
      setSlug(target);
    }
    setQuery('');
    top.current?.scrollIntoView({ block: 'start' });
  };

  // Consumed once mounted; a guide asked for while the screen is open arrives
  // as the event instead.
  useEffect(() => {
    takePendingGuide();
    const onOpen = () => {
      const next = takePendingGuide();
      if (next) open(next);
    };
    window.addEventListener(OPEN_GUIDE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, onOpen);
  }, []);

  const onInternalLink = (href: string) => {
    const rest = href.replace(/^\/guide\/?/, '').split('#')[0];
    if (!rest) { setSlug(null); setTab('guides'); top.current?.scrollIntoView({ block: 'start' }); return; }
    open(rest);
  };

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return null;
    return {
      articles: ARTICLES.filter((a) =>
        normalize(`${a.title} ${a.description} ${a.summary} ${a.body}`).includes(q)),
      faq: FAQ_ITEMS.filter((i) => normalize(`${i.q} ${i.a}`).includes(q)),
    };
  }, [query]);

  const article = slug ? getArticle(slug) : undefined;

  return (
    <Page ref={top} narrow className="scroll-mt-4">
      {article ? (
        <ArticleView article={article} onBack={() => setSlug(null)} onNavigate={onNavigate} onOpen={open} onInternalLink={onInternalLink} />
      ) : (
        <>
          <PageHeader
            title={t('Guides & FAQ')}
            subtitle={
              <>
                {t('Råd til hele brylluppet, og svar på det, par spørger om.')}
                {lang !== 'da' && <span className="mt-1 block">{t('Guiderne findes indtil videre kun på dansk.')}</span>}
              </>
            }
            actions={
              <label className="focus-shell flex h-10 w-full items-center gap-2.5 rounded-full border border-line bg-card px-4 sm:w-72">
                <Search size={16} className="shrink-0 text-muted" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('Søg i guides og spørgsmål')}
                  aria-label={t('Søg i guides og spørgsmål')}
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label={t('Ryd søgning')} className="cursor-pointer text-muted hover:text-ink">
                    <X size={15} />
                  </button>
                )}
              </label>
            }
          >
            {!results && (
              <Tabs
                label={t('Guides & FAQ')}
                value={tab}
                onChange={setTab}
                items={[
                  { id: 'guides', label: `${t('Guides')} · ${ARTICLES.length}`, icon: BookOpen },
                  { id: 'faq', label: `${t('Spørgsmål og svar')} · ${FAQ_ITEMS.length}`, icon: MessageCircleQuestion },
                ]}
              />
            )}
          </PageHeader>

          {results ? (
            <SearchResults query={query} results={results} onOpen={open} onInternalLink={onInternalLink} />
          ) : tab === 'guides' ? (
            <div className="flex flex-col gap-8">
              {CATEGORIES.map((c) => (
                <section key={c.id} aria-labelledby={`guide-${c.id}`}>
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <h2 id={`guide-${c.id}`} className="font-serif text-2xl font-semibold text-ink">{c.name}</h2>
                    <p className="hidden text-[13px] text-muted sm:block">{c.description}</p>
                  </div>
                  <ArticleRows articles={articlesIn(c.id)} onOpen={open} />
                </section>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {FAQ.map((g) => (
                <section key={g.id} aria-labelledby={`faq-${g.id}`}>
                  <h2 id={`faq-${g.id}`} className="mb-3 font-serif text-2xl font-semibold text-ink">{g.name}</h2>
                  <div className="flex flex-col gap-2.5">
                    {g.items.map((item) => <FaqItemCard key={item.q} item={item} onInternalLink={onInternalLink} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </Page>
  );
}

function ArticleRows({ articles, onOpen }: { articles: GuideArticle[]; onOpen: (slug: string) => void }) {
  const { t } = useLang();
  return (
    <ul className="flex flex-col gap-1 rounded-[28px] border border-line bg-card p-2">
      {articles.map((a) => (
        <li key={a.slug}>
          <button
            type="button"
            onClick={() => onOpen(a.slug)}
            className="group flex w-full cursor-pointer items-center gap-4 rounded-[20px] p-2.5 text-left transition-colors hover:bg-shell"
          >
            <span className="relative size-14 shrink-0 overflow-hidden rounded-[14px] bg-shell">
              <Image src={a.image.src} alt="" fill sizes="56px" className="object-cover" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-snug text-ink">{a.title}</span>
              <span className="mt-0.5 block truncate text-[13px] text-muted">{a.description}</span>
            </span>
            <span className="hidden shrink-0 text-xs text-muted sm:block">{t('{n} min.', { n: readingMinutes(a.body) })}</span>
            <ArrowRight size={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

function SearchResults({
  query,
  results,
  onOpen,
  onInternalLink,
}: {
  query: string;
  results: { articles: GuideArticle[]; faq: typeof FAQ_ITEMS };
  onOpen: (slug: string) => void;
  onInternalLink: (href: string) => void;
}) {
  const { t } = useLang();
  if (!results.articles.length && !results.faq.length) {
    return (
      <div className="rounded-[28px] border border-line bg-card p-7 text-center">
        <p className="font-semibold text-ink">{t('Ingen resultater for "{q}"', { q: query.trim() })}</p>
        <p className="mt-1 text-sm text-ink-soft">{t('Prøv et andet ord, eller spørg Ava i chatten.')}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {results.articles.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-2xl font-semibold text-ink">{t('Guides')}</h2>
          <ArticleRows articles={results.articles} onOpen={onOpen} />
        </section>
      )}
      {results.faq.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-2xl font-semibold text-ink">{t('Spørgsmål og svar')}</h2>
          <div className="flex flex-col gap-2.5">
            {results.faq.map((item) => <FaqItemCard key={item.q} item={item} onInternalLink={onInternalLink} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function ArticleView({
  article,
  onBack,
  onNavigate,
  onOpen,
  onInternalLink,
}: {
  article: GuideArticle;
  onBack: () => void;
  onNavigate?: (s: NavigateTarget) => void;
  onOpen: (slug: string) => void;
  onInternalLink: (href: string) => void;
}) {
  const { t } = useLang();
  const action = GUIDE_ACTION[article.slug];
  const blocks = useMemo(() => parseMarkdown(article.body), [article.body]);
  const act = action && onNavigate ? () => onNavigate(action.target) : undefined;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-sage-strong transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} aria-hidden /> {t('Alle guides')}
        </button>
        <a
          href={`/guide/${article.slug}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
        >
          {t('Åbn som webside')} <ExternalLink size={13} aria-hidden />
        </a>
      </div>

      <header className="grid gap-6 rounded-[28px] border border-line bg-blush p-6 sm:p-7 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sage">{getCategory(article.category).name}</p>
          <h1 className="mt-3 font-serif text-[clamp(2rem,4vw,2.75rem)] font-semibold leading-[1.05] text-ink">{article.title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{article.description}</p>
          <p className="mt-3 text-[13px] text-muted">{t('{n} min. læsning', { n: readingMinutes(article.body) })}</p>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] border-[6px] border-paper shadow-[0_16px_40px_rgba(36,65,58,0.18)]">
          <Image src={article.image.src} alt={article.image.alt} fill sizes="(min-width: 1024px) 380px, 100vw" className="object-cover" />
        </div>
      </header>

      <section className="rounded-[28px] border border-line bg-card p-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-sage">{t('Kort svar')}</p>
        <p className="mt-2.5 text-[1.0625rem] leading-[1.7] text-ink">{article.summary}</p>
        {act && (
          <button
            type="button"
            onClick={act}
            className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-ink-deep"
          >
            {t(action.label)} <ArrowRight size={15} aria-hidden />
          </button>
        )}
      </section>

      <article className="max-w-3xl">
        <Markdown
          blocks={blocks}
          onInternalLink={onInternalLink}
          productCard={<DoItInKalas article={article} label={action ? t(action.label) : undefined} onAct={act} />}
        />
        {article.sources?.length ? (
          <section className="mt-10 rounded-[22px] border border-line bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sage">{t('Kilder')}</p>
            <ul className="mt-2.5 space-y-1.5 text-sm">
              {article.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener" className="text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      <section>
        <h2 className="mb-3 font-serif text-2xl font-semibold text-ink">{t('Læs også')}</h2>
        <ArticleRows articles={relatedTo(article)} onOpen={onOpen} />
      </section>
    </>
  );
}

/** The article's product card, turned from "sign up" into "go and do it". */
function DoItInKalas({ article, label, onAct }: { article: GuideArticle; label?: string; onAct?: () => void }) {
  const { t } = useLang();
  return (
    <aside className="my-9 grid gap-5 rounded-[28px] bg-ink p-6 text-paper sm:p-8 md:grid-cols-[1.1fr_1fr] md:items-center">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-sage-tint">{t('Gør det i Kalas')}</p>
        <p className="mt-2.5 font-serif text-[1.75rem] font-semibold leading-[1.1]">{article.kalas.title}</p>
      </div>
      <div>
        <ul className="space-y-2.5">
          {article.kalas.points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-[0.95rem] leading-snug">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sage-tint text-ink">
                <Check size={12} strokeWidth={3} aria-hidden />
              </span>
              {p}
            </li>
          ))}
        </ul>
        {onAct && label && (
          <button
            type="button"
            onClick={onAct}
            className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-paper px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white"
          >
            {label} <ArrowRight size={15} aria-hidden />
          </button>
        )}
      </div>
    </aside>
  );
}
