import { loadKernel } from '@metaharness/kernel';
/** Actual MetaHarness loader; reports selected backend, never labels JS as WASM. */
export async function createMetaHarness() {
  const kernel = await loadKernel();
  return {
    backend: kernel.backend,
    info: kernel.kernelInfo(),
    validateConnector(spec) {
      const error = kernel.mcpValidate(JSON.stringify(spec));
      if (error) throw new Error(error);
      return true;
    }
  };
}
