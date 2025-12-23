import { isEqual } from 'lodash';
import { fetchFromApi, ApiRequest } from '../platform/web_ide';

export interface FakeRequestHandler<T> {
  request: ApiRequest<T>;
  response: T;
}

export const createFakeFetchFromApi =
  (...handlers: FakeRequestHandler<unknown>[]): fetchFromApi =>
  async <T>(request: ApiRequest<T>) => {
    const handler = handlers.find(h => isEqual(h.request, request));
    if (!handler) {
      throw new Error(`No fake handler to handle request: ${JSON.stringify(request)}`);
    }
    return handler.response as T;
  };
