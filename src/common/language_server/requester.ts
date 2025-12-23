export type RequestFn<T> = (payload: unknown) => Promise<T>;

export interface Requester<T> {
  initRequester(request: RequestFn<T>): void;
}
