import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import lodash from 'lodash';
import { root } from './run_utils.mjs';

const packageJson = () => JSON.parse(readFileSync(join(root, 'package.json')));
const desktopPackageJson = () => JSON.parse(readFileSync(join(root, 'desktop.package.json')));
const browserPackageJson = () => JSON.parse(readFileSync(join(root, 'browser.package.json')));

function mergeJson(left, right) {
  return lodash.mergeWith(left, right, (src, other) => {
    if (!lodash.isArray(src) || !lodash.isArray(other)) return undefined;

    // This complicated logic is responsible for finding out if an array of
    // objects contains objects with the same ID. This allows us to merge those
    // objects by ID instead of performing a naive concatenation of the arrays.
    // The `id` field is commonly used for identifying contributions items
    // This logic is necessary for merging configuration groups between package.json and the
    // platform-specific package.json files.
    const idMap = new Map();
    src.forEach(item => {
      if (item.id !== undefined) {
        idMap.set(item.id, item);
      }
    });

    const result = [...src];
    other.forEach(item => {
      if (item.id !== undefined && idMap.has(item.id)) {
        const existingItem = idMap.get(item.id);
        const index = result.findIndex(x => x.id === item.id);
        result[index] = mergeJson(existingItem, item);
      } else {
        result.push(item);
      }
    });

    return result;
  });
}

export function prettyPrint(json) {
  return JSON.stringify(json, null, 2);
}

export function createDesktopPackageJson() {
  return mergeJson(packageJson(), desktopPackageJson());
}

export function createBrowserPackageJson() {
  return mergeJson(packageJson(), browserPackageJson());
}
