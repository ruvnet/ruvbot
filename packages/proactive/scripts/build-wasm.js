import wabtFactory from 'wabt';
import { readFile, writeFile } from 'node:fs/promises';
const wabt = await wabtFactory();
const path = new URL('../wasm/gate.wat', import.meta.url);
const module = wabt.parseWat('gate.wat', await readFile(path, 'utf8'));
module.validate();
await writeFile(new URL('../wasm/gate.wasm', import.meta.url), module.toBinary({canonicalize_lebs:true}).buffer);
module.destroy();
