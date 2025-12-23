export interface UiError extends Error {
  showUi(): Promise<void>;
}

export const isUiError = (o: unknown): o is UiError => typeof (o as UiError).showUi === 'function';
