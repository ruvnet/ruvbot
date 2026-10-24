import { readFile } from 'node:fs/promises';
/** A real, import-free WASM predicate; never receives payloads or credentials. */
export async function loadPromotionGate() {
  const { instance } = await WebAssembly.instantiate(await readFile(new URL('../wasm/gate.wasm', import.meta.url)), {});
  return metrics => {
    const {candidate,parent,safety,regressions} = metrics;
    return [candidate,parent,safety,regressions].every(Number.isFinite) && Boolean(instance.exports.promote(candidate,parent,safety,regressions));
  };
}
