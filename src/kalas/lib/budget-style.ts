import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  UtensilsCrossed,
  Camera,
  Flower2,
  Music,
  Shirt,
  Mail,
  Car,
  Gift,
  Gem,
  CakeSlice,
  Wine,
  Sparkles,
  Heart,
  Home,
  Plane,
  Tent,
  Mic2,
} from 'lucide-react';

export type BudgetIconId =
  | 'building'
  | 'utensils'
  | 'camera'
  | 'flower'
  | 'music'
  | 'shirt'
  | 'mail'
  | 'car'
  | 'gift'
  | 'gem'
  | 'cake'
  | 'wine'
  | 'sparkles'
  | 'heart'
  | 'home'
  | 'plane'
  | 'tent'
  | 'mic';

export const BUDGET_ICON_MAP: Record<BudgetIconId, LucideIcon> = {
  building: Building2,
  utensils: UtensilsCrossed,
  camera: Camera,
  flower: Flower2,
  music: Music,
  shirt: Shirt,
  mail: Mail,
  car: Car,
  gift: Gift,
  gem: Gem,
  cake: CakeSlice,
  wine: Wine,
  sparkles: Sparkles,
  heart: Heart,
  home: Home,
  plane: Plane,
  tent: Tent,
  mic: Mic2,
};

export const BUDGET_ICON_IDS = Object.keys(BUDGET_ICON_MAP) as BudgetIconId[];

/** Curated swatches — earthy, distinct enough for the allocation bar. */
export const BUDGET_COLORS = [
  '#4A5D3A', // deep olive
  '#C17A4A', // warm clay
  '#5A6E7A', // blue-gray
  '#A66B7A', // dusty rose
  '#8B6B3A', // amber gold
  '#8B5E4A', // cocoa
  '#3D5A5B', // teal slate
  '#6B7568', // sage gray
  '#B8956A', // sand
  '#6E4A5A', // plum brown
  '#4F6F5A', // forest
  '#9A6B5A', // terracotta soft
] as const;

export function isBudgetIconId(v: string | null | undefined): v is BudgetIconId {
  return Boolean(v && v in BUDGET_ICON_MAP);
}

export function resolveBudgetIcon(id: string | null | undefined): LucideIcon {
  return BUDGET_ICON_MAP[isBudgetIconId(id) ? id : 'gem'];
}

export function nextBudgetColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  return BUDGET_COLORS.find((c) => !taken.has(c.toLowerCase())) ?? BUDGET_COLORS[0];
}
