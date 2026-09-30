"use client";

/* Something on the floor that is not a table: the dance floor, the DJ, the
   buffet. No chairs and no drop targets, so it is far simpler than TableNode,
   but it moves and selects the same way, so the canvas has one set of habits. */

import { memo } from 'react';
import {
  Cake, Camera, DoorOpen, Gift, GripVertical, Mic, Music, Sparkles, UtensilsCrossed, Wine,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../ui';
import type { FloorElement, FloorElementKind } from './model';

export const ELEMENT_ICON: Record<FloorElementKind, LucideIcon> = {
  dansegulv: Sparkles,
  dj: Music,
  buffet: UtensilsCrossed,
  kage: Cake,
  bar: Wine,
  gaver: Gift,
  scene: Mic,
  fotoboks: Camera,
  indgang: DoorOpen,
};

function ElementNodeInner({ element, selected, onSelect, onPointerDown }: {
  element: FloorElement;
  selected: boolean;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const Icon = ELEMENT_ICON[element.kind];
  // The dance floor is a surface, not a piece of furniture: drawn as a floor.
  const floor = element.kind === 'dansegulv';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={element.label}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      className={cn(
        'group absolute flex cursor-grab flex-col items-center justify-center gap-1 rounded-2xl border transition-colors active:cursor-grabbing',
        selected
          ? 'border-solid border-ink shadow-[0_6px_20px_rgba(18,51,43,0.12)]'
          : 'border-dashed border-sage',
        floor ? 'bg-sage-wash' : 'bg-sage-wash',
      )}
      style={{
        left: element.x,
        top: element.y,
        width: element.w,
        height: element.h,
        transform: 'translate(-50%, -50%)',
        ...(floor
          ? {
              backgroundImage:
                'linear-gradient(45deg, rgba(125,147,138,0.12) 25%, transparent 25%, transparent 75%, rgba(125,147,138,0.12) 75%), linear-gradient(45deg, rgba(125,147,138,0.12) 25%, transparent 25%, transparent 75%, rgba(125,147,138,0.12) 75%)',
              backgroundSize: '28px 28px',
              backgroundPosition: '0 0, 14px 14px',
            }
          : null),
      }}
    >
      <Icon size={element.h < 70 ? 14 : 18} strokeWidth={1.75} className="pointer-events-none text-sage-strong" aria-hidden />
      <span className="pointer-events-none max-w-full truncate px-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
        {element.label}
      </span>
      <span className="pointer-events-none absolute left-2 top-2 text-line-strong opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical size={13} />
      </span>
    </div>
  );
}

export const ElementNode = memo(ElementNodeInner);
