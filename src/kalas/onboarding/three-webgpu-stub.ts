/* Stands in for `three/webgpu` and `three/tsl` (aliased in next.config.ts).

   globe.gl imports three's whole WebGPU build for two things Kalas never
   turns on: the heatmap layer and an opt-in WebGPU renderer. Unminified that
   is 2.4 MB, more than the WebGL three.js the globe actually draws with, and
   every couple downloaded it on the way to onboarding's second step. The
   imports only have to resolve; nothing here is ever constructed. If a later
   feature does want one of them, drop the alias. */
const unused = (name: string) =>
  class {
    constructor() {
      throw new Error(`${name} is stubbed out. See three-webgpu-stub.ts.`);
    }
  };

export const WebGPURenderer = unused('WebGPURenderer');
export const StorageInstancedBufferAttribute = unused('StorageInstancedBufferAttribute');
