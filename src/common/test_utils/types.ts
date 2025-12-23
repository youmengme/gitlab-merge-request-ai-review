export type Mutable<T> = { -readonly [P in keyof T]: T[P] };
export const asMutable = <T>(value: T): Mutable<T> => value as Mutable<T>;
