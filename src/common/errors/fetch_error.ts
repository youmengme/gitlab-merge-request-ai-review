/* eslint max-classes-per-file: 0 */

import { ResponseError } from '../platform/web_ide';
import { REQUEST_TIMEOUT_MILLISECONDS } from '../constants';
import { extractURL } from '../utils/extract_url';
import { stackToArray, DetailedError } from './common';

const getErrorType = (body: string): string | unknown => {
  try {
    const parsedBody = JSON.parse(body);
    return parsedBody?.error;
  } catch {
    return undefined;
  }
};

const isInvalidTokenError = (response: Response, body?: string) =>
  Boolean(response.status === 401 && body && getErrorType(body) === 'invalid_token');

const isInvalidRefresh = (response: Response, body?: string) =>
  Boolean(response.status === 400 && body && getErrorType(body) === 'invalid_grant');

export class FetchError extends Error implements ResponseError, DetailedError {
  response: Response;

  #body?: string;

  constructor(response: Response, resourceName: string, body?: string) {
    let message = `Fetching ${resourceName} from ${response.url} failed`;
    if (isInvalidTokenError(response, body)) {
      message = `Request for ${resourceName} failed because the token is expired or revoked.`;
    }
    if (isInvalidRefresh(response, body)) {
      message = `Request to refresh token failed, because it's revoked or already refreshed.`;
    }
    super(message);
    this.response = response;
    this.#body = body;
  }

  get status() {
    return this.response.status;
  }

  isInvalidToken(): boolean {
    return (
      isInvalidTokenError(this.response, this.#body) || isInvalidRefresh(this.response, this.#body)
    );
  }

  get details() {
    const { message, stack } = this;
    return {
      message,
      stack: stackToArray(stack),
      response: {
        status: this.response.status,
        headers: this.response.headers,
        body: this.#body,
      },
    };
  }
}

export const isMissingDefaultDuoGroupError = (error: unknown) => {
  const isFetchError = error instanceof FetchError;

  if (!isFetchError) return false;

  const errorBody = error.details.response.body;
  if (!errorBody) return false;

  try {
    const body = JSON.parse(errorBody);

    return body.error === 'missing_default_duo_group';
  } catch {
    return false;
  }
};

export class TimeoutError extends Error {
  constructor(url: URL | RequestInfo) {
    const timeoutInSeconds = Math.round(REQUEST_TIMEOUT_MILLISECONDS / 1000);
    super(
      `Request to ${extractURL(url)} timed out after ${timeoutInSeconds} second${timeoutInSeconds === 1 ? '' : 's'}`,
    );
  }
}
