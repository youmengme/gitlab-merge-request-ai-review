import type * as https from 'https';
import { GraphQLClient } from 'graphql-request';
import type { HttpsProxyAgent } from 'https-proxy-agent';
import type { Variables, RequestDocument } from 'graphql-request';
import { ApiRequest, fetchFromApi } from '../../platform/web_ide';
import fetch from '../../fetch_logged';
import { QueryValue, createQueryString } from '../../utils/create_query_string';
import { handleFetchError } from '../../errors/handle_fetch_error';
import { REQUEST_TIMEOUT_MILLISECONDS } from '../../constants';
import { TimeoutError } from '../../errors/fetch_error';
import { log } from '../../log';
import { connectToCable } from './action_cable';

export interface ApiClient {
  readonly fetchFromApi: fetchFromApi;
}

export interface AuthProvider {
  getAuthHeaders(): Promise<Record<string, string>>;
}

export interface DefaultApiClientOptions {
  instanceUrl: string;
  authProvider?: AuthProvider;
  headers?: Record<string, string>;
  agent?: HttpsProxyAgent<string> | https.Agent;
}

export const NOOP_AUTH_PROVIDER: AuthProvider = {
  getAuthHeaders: () => Promise.resolve({}),
};

export class DefaultApiClient implements ApiClient {
  readonly #authProvider: AuthProvider;

  readonly #instanceUrl: string;

  readonly #headers: Record<string, string>;

  readonly #agent?: HttpsProxyAgent<string> | https.Agent;

  constructor(options: DefaultApiClientOptions) {
    this.#instanceUrl = options.instanceUrl;
    this.#authProvider = options.authProvider || NOOP_AUTH_PROVIDER;
    this.#headers = options.headers || {};
    this.#agent = options.agent;
  }

  async fetchFromApi<T>(request: ApiRequest<T>): Promise<T> {
    if (request.type === 'graphql') {
      return this.#graphqlRequest(request.query, request.variables);
    }
    switch (request.method) {
      case 'GET':
        return this.#fetch(request.path, request.searchParams, 'resource', request.headers);
      case 'POST':
        return this.#postFetch(request.path, 'resource', request.body, request.headers);
      default:
        // the type assertion is necessary because TS doesn't expect any other types
        throw new Error(`Unknown request type ${(request as ApiRequest<unknown>).type}`);
    }
  }

  async connectToCable() {
    const fetchOptions = await this.#getFetchOptions();

    const websocketOptions = {
      headers: { ...fetchOptions.headers, Origin: this.#getOrigin() },
    };

    return connectToCable(this.#instanceUrl, websocketOptions);
  }

  /**
   * @deprecated Use `fetchFromApi` instead. This is public for iteration and legacy reasons.
   */
  fetch<T>(
    apiResourcePath: string,
    query: Record<string, QueryValue> = {},
    resourceName = 'resource',
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.#fetch(apiResourcePath, query, resourceName, headers);
  }

  /**
   * @deprecated Use `fetchFromApi` instead. This is public for iteration and legacy reasons.
   */
  postFetch<T>(
    apiResourcePath: string,
    resourceName = 'resource',
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.#postFetch(apiResourcePath, resourceName, body, headers);
  }

  /**
   * @deprecated Use `fetchFromApi` instead. This is public for iteration and legacy reasons.
   */
  // FIXME: specify correct type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graphqlRequest<T = any, V extends Variables = Variables>(
    document: RequestDocument,
    variables?: V,
  ): Promise<T> {
    return this.#graphqlRequest(document, variables);
  }

  /**
   * @deprecated Use `fetchFromApi` instead. This is public for iteration and legacy reasons.
   */
  crossFetch(input: URL | RequestInfo, init: RequestInit = {}): Promise<Response> {
    return this.#crossFetch(input, init);
  }

  async #fetch<T>(
    apiResourcePath: string,
    query: Record<string, QueryValue> = {},
    resourceName = 'resource',
    headers?: Record<string, string>,
  ): Promise<T> {
    const url = `${this.#instanceUrl}/api/v4${apiResourcePath}${createQueryString(query)}`;

    const result = await this.#crossFetch(url, { headers });
    await handleFetchError(result, resourceName);
    return result.json() as Promise<T>;
  }

  async #postFetch<T>(
    apiResourcePath: string,
    resourceName = 'resource',
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const url = `${this.#instanceUrl}/api/v4${apiResourcePath}`;

    const response = await this.#crossFetch(url, {
      headers: { 'Content-Type': 'application/json', ...headers },
      method: 'POST',
      body: JSON.stringify(body),
    });
    await handleFetchError(response, resourceName);
    return response.json() as Promise<T>;
  }

  async #graphqlRequest<T = unknown, V extends Variables = Variables>(
    document: RequestDocument,
    variables?: V,
  ): Promise<T> {
    const ensureEndsWithSlash = (url: string) => url.replace(/\/?$/, '/');
    const endpoint = new URL('./api/graphql', ensureEndsWithSlash(this.#instanceUrl)).href; // supports GitLab instances that are on a custom path, e.g. "https://example.com/gitlab"
    const client = new GraphQLClient(endpoint, {
      fetch: (input: URL | RequestInfo, init?: RequestInit) => this.#crossFetch(input, init),
    });
    return client.request(document, variables);
  }

  async #crossFetch(input: URL | RequestInfo, init: RequestInit = {}): Promise<Response> {
    const fetchOptions = await this.#getFetchOptions();

    try {
      return await fetch(input, {
        ...fetchOptions,
        ...init,
        headers: { ...fetchOptions.headers, ...init.headers },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new TimeoutError(input);
      }
      throw e;
    }
  }

  async #getFetchOptions() {
    const authorizationHeaders = await this.#authProvider.getAuthHeaders();

    return {
      headers: {
        // Setting this header normally isn't necessary if the HTTP agent has
        // keepAlive: true set, but due to https://github.com/microsoft/vscode/issues/173861
        // something is clobbering this header no matter how `http.proxySupport` is set.
        Connection: 'keep-alive',
        ...authorizationHeaders,
        ...this.#headers,
      },
      agent: this.#agent,
    };
  }

  #getOrigin(): string | undefined {
    try {
      return new URL(this.#instanceUrl).origin;
    } catch (error) {
      log.error(
        `Failed to extract origin from baseURL: "${this.#instanceUrl}". Ensure it is a valid URL.`,
        error,
      );

      return undefined;
    }
  }
}
