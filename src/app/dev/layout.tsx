import { notFound } from 'next/navigation';

/* Harnesses for building screens against fixture data. They exist for
   `next dev` only: in a production build every page under /dev is a 404. */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return children;
}
