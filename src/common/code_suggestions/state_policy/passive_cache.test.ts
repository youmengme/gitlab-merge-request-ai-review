import { PassiveCache } from './passive_cache';

describe('PassiveCache', () => {
  let cache: PassiveCache<string>;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new PassiveCache(50);
    cache.set('key', 'value');
  });

  it('retrieves value within time-to-live', () => {
    expect(cache.get('key')).toBe('value');
  });

  it('returns undefined after time-to-live has expired', () => {
    jest.advanceTimersByTime(51);

    expect(cache.get('key')).toBe(undefined);
  });
});
