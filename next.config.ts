import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The FAQ lives in the guide; /faq is the address people guess.
  async redirects() {
    return [{ source: "/faq", destination: "/guide/faq", permanent: true }];
  },
};

export default nextConfig;
