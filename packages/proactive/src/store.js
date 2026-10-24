import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync, fsyncSync, renameSync, unlinkSync, rmdirSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';

/** Single-writer local storage. Never put this directory on a shared/network volume. */
export class FileStore {
  #directory; #closed = false;
  constructor(directory) {
    this.#directory = resolve(directory);
    mkdirSync(this.#directory, {recursive:true,mode:0o700});
    const stat=lstatSync(this.#directory);
    if(stat.isSymbolicLink() || !stat.isDirectory() || (stat.mode & 0o077)) throw new Error('state directory must be private (0700) and not a symlink');
    // Intentionally no automatic stale lock recovery: an operator must reconcile first.
    mkdirSync(join(this.#directory,'.writer-lock'), {mode:0o700});
  }
  load() {
    if(this.#closed) throw new Error('store closed');
    try { return JSON.parse(readFileSync(join(this.#directory,'state.json'),'utf8')); }
    catch(error) { if(error.code==='ENOENT') return null; throw error; }
  }
  save(state) {
    if(this.#closed) throw new Error('store closed');
    const temp=join(this.#directory,'state.tmp');
    let fd;
    try {
      fd=openSync(temp,'wx',0o600);
      writeFileSync(fd,JSON.stringify(state)); fsyncSync(fd); closeSync(fd); fd=undefined;
      renameSync(temp,join(this.#directory,'state.json'));
      const dir=openSync(this.#directory,'r');try {fsyncSync(dir);} finally {closeSync(dir);}
    } finally {
      if(fd!==undefined) closeSync(fd);
      try {unlinkSync(temp);} catch(error) {if(error.code!=='ENOENT') throw error;}
    }
  }
  close() {
    if(!this.#closed) {rmdirSync(join(this.#directory,'.writer-lock'));this.#closed=true;}
  }
}
