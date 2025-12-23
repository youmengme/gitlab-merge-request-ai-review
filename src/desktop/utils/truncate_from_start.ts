/** Truncate a string from start. Use lodash truncate if you need to truncate the end */
export const truncateFromStart = (str: string, maxLength: number): string => {
  if (str.length < maxLength) {
    return str;
  }

  return `...${str.slice(str.length - maxLength)}`;
};
