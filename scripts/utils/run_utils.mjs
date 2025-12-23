import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { execa } from 'execa';

const dir = dirname(fileURLToPath(import.meta.url));
export const root = resolve(dir, '..', '..');

export const run = (file, args, options) =>
  execa(file, args, { stdio: 'inherit', ...options }).catch(err => {
    console.log(err.shortMessage || err.message || err);
    throw err;
  });
