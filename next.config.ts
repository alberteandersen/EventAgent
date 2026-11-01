import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The globe's library imports three's WebGPU build and never uses it here.
  turbopack: {
    resolveAlias: {
      "three/webgpu": "./src/kalas/onboarding/three-webgpu-stub.ts",
      "three/tsl": "./src/kalas/onboarding/three-webgpu-stub.ts",
    },
  },
  // The FAQ lives in the guide; /faq is the address people guess.
  async redirects() {
    return [{ source: "/faq", destination: "/guide/faq", permanent: true }];
  },
};

export default nextConfig;
