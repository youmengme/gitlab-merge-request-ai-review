import { omitBy } from 'lodash';

interface CacheEntry<T> {
  timestamp: number;
  value: T;
}

export class PassiveCache<T> {
  #cache: Record<string, CacheEntry<T>> = {};

  /** Time To Live - interval for how long the entry is valid */
  #ttl: number;

  constructor(ttl: number) {
    this.#ttl = ttl;
  }

  set(key: string, value: T) {
    this.#cache[key] = {
      timestamp: Date.now(),
      value,
    };
  }

  get(key: string): T | undefined {
    this.#removeOldEntries();
    return this.#cache[key]?.value;
  }

  #removeOldEntries() {
    this.#cache = omitBy(this.#cache, cacheEntry => cacheEntry.timestamp + this.#ttl < Date.now());
  }
}
