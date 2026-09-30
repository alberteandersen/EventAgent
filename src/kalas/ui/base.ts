/** Joins class names, dropping the falsy ones. */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/** The page gutters every screen shares (see Page). */
export const pagePad = 'px-6 py-8 sm:px-9 lg:px-12 lg:py-8';
