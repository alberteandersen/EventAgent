"use client";

/* Juno, the couple's coordinator, as a character: a little cupid. A round,
   matte body, two small wings, a halo and a quiet face, drawn rather than illustrated
   so she can sit on the edge of whatever she is working on, look at it, and
   look up when someone comes by. With `bow` she carries her bow and a
   heart-tipped arrow, which is how she sends things.

   She is kept gentle: no outline, no gloss. She breathes, blinks, works her
   wings as hard as the moment needs, and follows what she is doing. Her colours are
   custom properties (see .juno in globals.css), so a surface can dress her
   from its own palette. */

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export type JunoMood = "calm" | "glad";
/** Standing still, hovering in place, or on her way somewhere. */
export type JunoFlight = "rest" | "hover" | "fly";

export function Juno({
  size = 160,
  mood = "calm",
  flight = "rest",
  look,
  follow = false,
  shadow = true,
  bow = false,
  className,
  label,
}: {
  /** Width in px, wings included. She is a little shorter than she is wide. */
  size?: number;
  mood?: JunoMood;
  /** How her wings move. The caller moves her; this only matches the wings. */
  flight?: JunoFlight;
  /** Where her eyes rest, each axis from -1 to 1 (right and down positive). */
  look?: { x: number; y: number };
  /** Glance at the pointer when it moves, then go back to `look`. */
  follow?: boolean;
  /** The soft shadow she stands on. Off when she perches on an edge. */
  shadow?: boolean;
  /** Her bow and arrow. For the larger sizes; it is noise below about 90px. */
  bow?: boolean;
  className?: string;
  /** Named for screen readers when she carries meaning; decorative otherwise. */
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const restX = look?.x ?? 0;
  const restY = look?.y ?? 0;

  // Her gaze is two custom properties, written straight to the element, so a
  // moving pointer never re-renders anything.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rest = () => {
      el.style.setProperty("--juno-gx", String(restX));
      el.style.setProperty("--juno-gy", String(restY));
    };
    rest();
    if (!follow) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let back: ReturnType<typeof setTimeout> | undefined;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const box = el.getBoundingClientRect();
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height * 0.65);
      const reach = Math.max(box.width * 2.2, 320);
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      el.style.setProperty("--juno-gx", clamp(dx / reach).toFixed(3));
      el.style.setProperty("--juno-gy", clamp(dy / reach).toFixed(3));
      clearTimeout(back);
      back = setTimeout(rest, 2400);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      clearTimeout(back);
    };
  }, [follow, restX, restY]);

  const glad = mood === "glad";
  const wing = (
    <g className="juno-wing">
      <path className="juno-wing-back" d={WING_BACK} />
      <path className="juno-wing-front" d={WING_FRONT} />
    </g>
  );

  return (
    <svg
      ref={ref}
      viewBox="0 0 200 190"
      width={size}
      height={(size * 190) / 200}
      className={cn("juno", glad && "juno-glad", flight === "hover" && "juno-hover", flight === "fly" && "juno-flying", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        {/* Matte volume: a pale crown that deepens toward the base. */}
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--juno-light)" />
          <stop offset="0.55" stopColor="var(--juno-body)" />
          <stop offset="1" stopColor="var(--juno-shade)" />
        </linearGradient>
      </defs>

      {shadow && <ellipse className="juno-ground" cx="100" cy="177" rx="52" ry="5.5" />}

      {/* Her halo: a thin gold ring, a wedding ring as much as anything. */}
      <ellipse className="juno-halo" cx="101" cy="63" rx="23" ry="6.2" transform="rotate(-8 101 63)" />

      {/* The wings are behind her and do not breathe with her. */}
      {wing}
      <g transform="translate(200 0) scale(-1 1)">{wing}</g>

      <g className="juno-figure">
        <path d={BODY} fill={`url(#${id}-body)`} />
        <g className="juno-face">
          <ellipse className="juno-cheek" cx="70" cy="141" rx="8" ry="5" />
          <ellipse className="juno-cheek" cx="130" cy="141" rx="8" ry="5" />
          {glad ? (
            <>
              <path className="juno-smile" d="M75 132 Q83 121 91 132" />
              <path className="juno-smile" d="M109 132 Q117 121 125 132" />
            </>
          ) : (
            <g className="juno-eyes">
              <ellipse className="juno-eye" cx="83" cy="129" rx="4.6" ry="6.4" />
              <ellipse className="juno-eye" cx="117" cy="129" rx="4.6" ry="6.4" />
            </g>
          )}
          <path className="juno-mouth" d="M93.5 141 Q100 147 106.5 141" />
        </g>
      </g>

      {bow && (
        <g className="juno-bow" transform="rotate(-24 152 140)">
          <path className="juno-bow-limb" d="M152 112 Q179 140 152 168" />
          <path className="juno-bow-string" d="M152 112 L152 168" />
          <path className="juno-arrow" d="M126 140 L180 140 M126 140 l-8 -6.5 M126 140 l-8 6.5 M132 140 l-8 -6.5 M132 140 l-8 6.5" />
          <path className="juno-heart" transform="translate(183 140) rotate(-90)" d={HEART} />
        </g>
      )}
    </svg>
  );
}

/* A closed spline through twelve points: a low, fully rounded dome. Nothing
   in it tapers to a tip, on purpose. */
const BODY =
  "M92.0 81.2 C100.3 80.9 112.0 80.9 120.8 84.4 C129.6 87.9 138.7 94.3 144.8 102.0 C150.9 109.7 156.3 121.6 157.6 130.8 C158.9 140.0 157.1 150.4 152.8 157.2 C148.5 164.0 140.8 168.8 132.0 171.6 C123.2 174.4 110.7 174.0 100.0 174.0 C89.3 174.0 76.8 174.4 68.0 171.6 C59.2 168.8 51.5 164.0 47.2 157.2 C42.9 150.4 41.3 139.7 42.4 130.8 C43.5 121.9 48.8 111.1 53.6 103.6 C58.4 96.1 64.8 89.7 71.2 86.0 C77.6 82.3 83.7 81.5 92.0 81.2Z";

/* The left wing, twice: a darker back layer that gives it an edge on a pale
   ground, and the pale feathers on top. The right wing is this one mirrored. */
const WING_BACK = "M64 132 C55 110 34 93 5 97 C3 108 11 118 22 119 C22 128 33 134 43 132 C46 140 56 143 64 139 Z";
const WING_FRONT = "M64 130 C56 113 38 100 14 101 C13 109 20 115 28 115 C29 123 38 128 46 126 C49 133 57 136 64 134 Z";

/* A small heart, point down, centred on its own origin. */
export const HEART = "M0 7 C-8 1 -12 -5 -7 -9.5 C-3.5 -12 0 -9.5 0 -6 C0 -9.5 3.5 -12 7 -9.5 C12 -5 8 1 0 7 Z";
