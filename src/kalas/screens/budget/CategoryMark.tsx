import { createElement } from 'react';
import { resolveBudgetIcon } from '../../lib/budget-style';
import { cn } from '../../ui';

/* A category's icon on a wash of its own colour. The colour is the couple's
   to pick, so it is kept to a tint here and saved at full strength for the
   allocation bar, where it is the data. */
export default function CategoryMark({
  icon,
  color,
  size = 'md',
  className,
}: {
  icon: string;
  color: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center',
        size === 'sm' ? 'size-8 rounded-[10px]' : 'size-10 rounded-[13px]',
        className,
      )}
      style={{ background: `color-mix(in srgb, ${color} 15%, var(--color-card))`, color }}
    >
      {createElement(resolveBudgetIcon(icon), { size: size === 'sm' ? 15 : 18, strokeWidth: 1.9 })}
    </span>
  );
}
