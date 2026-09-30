import { cn } from './base';

/** "Kalas", set in the wordmark face. */
export function Wordmark({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <span
      className={cn('text-[1.75rem] leading-none', light ? 'text-paper' : 'text-ink', className)}
      style={{ fontFamily: 'var(--font-wordmark)', fontWeight: 700, letterSpacing: 0 }}
    >
      Kalas
    </span>
  );
}
