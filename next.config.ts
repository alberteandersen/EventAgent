import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The globe's library imports three's WebGPU build and never uses it here.
  turbopack: {
    resolveAlias: {
      "three/webgpu": "./src/kalas/onboarding/three-webgpu-stub.ts",
      "three/tsl": "./src/kalas/onboarding/three-webgpu-stub.ts",
    },
  },
  // The FAQ lives in the guide; /faq and /guides are the addresses people guess.
  async redirects() {
    return [
      { source: "/faq", destination: "/guide/faq", permanent: true },
      { source: "/guides", destination: "/guide", permanent: true },
      { source: "/guides/:path*", destination: "/guide/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
