"use client";

import { lazy, useEffect } from 'react';

/* Hjem and Juno's panel come with the app; every other page is its own chunk
   (the venue hub alone brings the world map). They are
   all fetched while the couple reads Hjem, and a page change is a transition,
   so the page on screen stays until the next one is ready: no loader between
   pages, and a first load that carries only what Hjem needs. */
const PAGES = {
  team: () => import('./screens/team/VendorHub'),
  inbox: () => import('./screens/Inbox'),
  planning: () => import('./screens/Planning'),
  budget: () => import('./screens/Budget'),
  guests: () => import('./screens/Guests'),
  website: () => import('./screens/Website'),
  registry: () => import('./screens/Registry'),
  invites: () => import('./screens/Invites'),
  seating: () => import('./screens/Seating'),
  nygift: () => import('./screens/Nygift'),
};
export const VendorHub = lazy(PAGES.team);
export const Inbox = lazy(PAGES.inbox);
export const Planning = lazy(PAGES.planning);
export const Budget = lazy(PAGES.budget);
export const Guests = lazy(PAGES.guests);
export const Website = lazy(PAGES.website);
export const Registry = lazy(PAGES.registry);
export const Invites = lazy(PAGES.invites);
export const Seating = lazy(PAGES.seating);
export const Nygift = lazy(PAGES.nygift);

export function usePrefetchPages() {
  useEffect(() => {
    const load = () => { for (const page of Object.values(PAGES)) void page().catch(() => {}); };
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(load, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(load, 1500);
    return () => clearTimeout(id);
  }, []);
}
