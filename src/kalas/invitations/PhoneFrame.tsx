'use client';

import './templates.css';
import type { ReactNode } from 'react';

/** iPhone-style frame (`.phone > .screen > .island`) for gallery + editor
    previews. `width` overrides the default 280px; aspect-ratio keeps height. */
export function PhoneFrame({ children, width, className }: { children: ReactNode; width?: number; className?: string }) {
  return (
    <div className={`kinv${className ? ` ${className}` : ''}`}>
      <div className="phone" style={width ? { width } : undefined}>
        <div className="screen">
          <div className="island" />
          {children}
        </div>
      </div>
    </div>
  );
}

/** A phone preview scaled down to a thumbnail `width` without distorting the
    280×590 design, used by the gallery grid, the category selector, and the
    editor's AI-variant previews. Inert unless `interactive`, for a preview
    large enough that a tap-to-open card should open. */
export function ScaledPhone({ width, interactive = false, children }: { width: number; interactive?: boolean; children: ReactNode }) {
  const base = 280;
  const scale = width / base;
  const height = (base * 590) / 280; // phone aspect 280/590
  return (
    <div style={{ width, height: height * scale, pointerEvents: interactive ? undefined : 'none' }}>
      <div style={{ width: base, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}

/** Full-bleed stage for the public share page — the invitation fills the
    viewport (no phone chrome, no notch). */
export function InvitationStage({ children }: { children: ReactNode }) {
  return (
    <div className="kinv kinv-stage">
      <div className="screen">{children}</div>
    </div>
  );
}
