"use client";

import { cn } from "@/lib/utils";
import { AnimatedList } from "@/components/ui/animated-list";

interface AgentUpdate {
  name: string;
  description: string;
  icon: string;
  color: string;
  time: string;
}

export const agentUpdates: AgentUpdate[] = [
  {
    name: "Ønsker modtaget",
    description: "Havebryllup i København, ca. 120 gæster 💍",
    time: "Lige nu",
    icon: "💍",
    color: "#c2b280",
  },
  {
    name: "Steder fundet",
    description: "10 bryllupssteder, der passer. Se dem igennem →",
    time: "2 min siden",
    icon: "🔎",
    color: "#ddd6c0",
  },
  {
    name: "Forespørgsler sendt",
    description: "Skriver til jeres 4 favoritter om tilbud…",
    time: "8 min siden",
    icon: "✉️",
    color: "#cfc8ae",
  },
  {
    name: "Tilbud modtaget",
    description: "Botanik: 145.000 kr. alt inkl., lørdag 14. juni ledig",
    time: "1 t siden",
    icon: "📊",
    color: "#ddd6c0",
  },
  {
    name: "Tilbud modtaget",
    description: "Nyhavn Loft: 158.000 kr., vielse på terrassen inkl.",
    time: "1 t siden",
    icon: "📊",
    color: "#c5bea6",
  },
  {
    name: "Bedste match",
    description: "Botanik vinder på pris, dato og antal gæster",
    time: "2 t siden",
    icon: "🤝",
    color: "#c2b280",
  },
  {
    name: "I er booket",
    description: "Jeres svar er sendt, og Botanik holder datoen",
    time: "3 t siden",
    icon: "✅",
    color: "#4A4E3C",
  },
  {
    name: "Hjemmesiden er live",
    description: "118 gæster inviteret · 24 har allerede svaret ja",
    time: "I dag",
    icon: "💌",
    color: "#ddd6c0",
  },
];

function AgentUpdateCard({
  name,
  description,
  icon,
  color,
  time,
  compact,
  onWallpaper,
}: AgentUpdate & { compact?: boolean; onWallpaper?: boolean }) {
  return (
    <figure
      className={cn(
        "relative isolate mx-auto min-h-fit w-full overflow-hidden rounded-2xl",
        compact ? "p-2" : "max-w-[400px] rounded-[1.25rem] p-4",
        onWallpaper
          ? "rounded-[1.1rem] border border-white/30 bg-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-2xl backdrop-saturate-150"
          : compact
            ? "border border-border/40 bg-surface/90"
            : "border border-white/55 bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_8px_24px_rgba(74,78,60,0.08)] backdrop-blur-xl backdrop-saturate-150"
      )}
    >
      <div className="flex flex-row items-center gap-2.5">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl backdrop-blur-md",
            onWallpaper
              ? "border border-white/25 bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
              : "border border-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
            compact ? "size-8 text-base" : "size-10 rounded-[0.85rem] text-lg"
          )}
          style={
            onWallpaper
              ? { backgroundColor: `${color}35` }
              : { backgroundColor: `${color}cc` }
          }
        >
          <span>{icon}</span>
        </div>
        <div className="flex min-w-0 flex-col overflow-hidden">
          <figcaption className="flex flex-row items-center whitespace-pre text-velvet">
            <span
              className={cn(
                "truncate font-semibold tracking-[-0.01em]",
                compact ? "text-[11px]" : "text-sm sm:text-[15px]",
                onWallpaper && "text-[#d4f8f8]"
              )}
            >
              {name}
            </span>
            <span className={cn("mx-1", onWallpaper ? "text-white/40" : "text-velvet-soft/70")}>·</span>
            <span
              className={cn(
                "shrink-0 font-medium",
                compact ? "text-[9px]" : "text-[11px]",
                onWallpaper ? "text-white/50" : "text-velvet-muted/80"
              )}
            >
              {time}
            </span>
          </figcaption>
          <p
            className={cn(
              "truncate leading-snug font-normal",
              compact ? "text-[10px]" : "text-[13px]",
              onWallpaper ? "text-white/65" : "text-velvet-body/85"
            )}
          >
            {description}
          </p>
        </div>
      </div>
    </figure>
  );
}

interface AgentLiveFeedProps {
  className?: string;
  delay?: number;
  variant?: "default" | "phone";
}

export function AgentLiveFeed({ className, delay = 2600, variant = "default" }: AgentLiveFeedProps) {
  const isPhone = variant === "phone";

  return (
    <div className={cn("relative h-full", className)}>
      {!isPhone && (
        <div className="pointer-events-none absolute -inset-3 -z-10 rounded-[2.25rem]">
          <div className="absolute left-0 top-0 h-32 w-32 rounded-full bg-rose-blush/80 blur-3xl" />
          <div className="absolute right-0 top-1/4 h-28 w-28 rounded-full bg-rose-blush/50 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-butter-light/60 blur-3xl" />
        </div>
      )}

      <div
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden",
          isPhone
            ? "bg-transparent px-2 pb-3 pt-2"
            : "rounded-[1.75rem] border border-white/50 bg-white/30 p-4 shadow-[0_24px_64px_-16px_rgba(74,78,60,0.18),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl backdrop-saturate-150 sm:p-5",
          !isPhone && "h-[480px]"
        )}
      >
        {!isPhone && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
        )}

        <AnimatedList delay={isPhone ? 2400 : delay} loop loopPause={5000} className={isPhone ? "gap-1.5" : "gap-3"}>
          {agentUpdates.map((item, idx) => (
            <AgentUpdateCard {...item} key={`${item.name}-${idx}`} compact={isPhone} onWallpaper={isPhone} />
          ))}
        </AnimatedList>

        {!isPhone && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-cream/90 via-cream/40 to-transparent backdrop-blur-[2px]" />
        )}
      </div>
    </div>
  );
}
