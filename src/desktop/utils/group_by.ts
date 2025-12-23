/**
 * @deprecated use lodash _.groupBy
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const groupBy = <T, K extends keyof any>(list: T[], getKey: (item: T) => K) =>
  list.reduce(
    (previous, currentItem) => {
      const group = getKey(currentItem);
      if (!previous[group]) previous[group] = []; // eslint-disable-line no-param-reassign
      previous[group].push(currentItem);
      return previous;
    },
    {} as Record<K, T[]>,
  );
