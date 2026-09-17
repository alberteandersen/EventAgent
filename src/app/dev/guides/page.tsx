"use client";

import dynamic from "next/dynamic";

// Client only: the harness seeds its state from the query string and sessionStorage.
const Harness = dynamic(() => import("./Harness"), { ssr: false });

export default function DevGuidesPage() {
  return <Harness />;
}
