export type NotifyFn<T> = (data: T) => Promise<void>;

export interface Notifier<T> {
  initNotifier(notify: NotifyFn<T>): void;
}
