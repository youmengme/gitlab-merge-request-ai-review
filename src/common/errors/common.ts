export const stackToArray = (stack: string | undefined): string[] => (stack ?? '').split('\n');

export interface DetailedError extends Error {
  readonly details: Record<string, unknown>;
}

export function isDetailedError(object: unknown): object is DetailedError {
  return Boolean((object as DetailedError).details);
}
