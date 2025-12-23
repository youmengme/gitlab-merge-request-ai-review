export const prettyJson = (
  obj: Record<string, unknown> | unknown[],
  space: string | number = 2,
): string => JSON.stringify(obj, null, space);
