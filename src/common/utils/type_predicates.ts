import { isBoolean, isString, isPlainObject } from 'lodash';

export function isArrayOfString(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;

  return value.every(val => isString(val));
}

export function isRecordOfStringBoolean(value: unknown): value is Record<string, boolean> {
  if (!value) return false;
  if (!isPlainObject(value)) return false;

  return Object.values(value).every(val => isBoolean(val));
}

export function isRecordOfStringString(value: unknown): value is Record<string, string> {
  if (!value) return false;
  if (!isPlainObject(value)) return false;

  return Object.values(value).every(val => isString(val));
}

export { isBoolean, isString };
