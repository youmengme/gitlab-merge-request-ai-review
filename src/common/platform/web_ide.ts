/*
 * ------------------------------------
 * This file contains types WebIDE shares with this (and other) projects.
 * If you change this file, you MUST change it also in:
 *   - https://gitlab.com/gitlab-org/gitlab-web-ide/-/blob/main/packages/web-ide-interop/src/index.ts
 * ------------------------------------
 */

// why: `TReturnType` helps encapsulate the full request type when used with `fetchFromApi`
/* eslint @typescript-eslint/no-unused-vars: ["error", { "varsIgnorePattern": "TReturnType" }] */

// region: Shared constants --------------------------------------------
export const WEB_IDE_EXTENSION_ID = 'gitlab.gitlab-web-ide';
export const WEB_IDE_AUTH_PROVIDER_ID = 'gitlab-web-ide';
export const WEB_IDE_AUTH_SCOPE = 'api';

// region: Mediator commands -------------------------------------------
export const COMMAND_FETCH_FROM_API = `gitlab-web-ide.mediator.fetch-from-api`;
export const COMMAND_FETCH_BUFFER_FROM_API = `gitlab-web-ide.mediator.fetch-buffer-from-api`;
export const COMMAND_MEDIATOR_TOKEN = `gitlab-web-ide.mediator.mediator-token`;
export const COMMAND_GET_CONFIG = `gitlab-web-ide.mediator.get-config`;

// Return type from `COMMAND_FETCH_BUFFER_FROM_API`
export interface VSCodeBuffer {
  readonly buffer: Uint8Array;
}

// region: Shared configuration ----------------------------------------
export interface InteropConfig {
  projectPath: string;
  gitlabUrl: string;
}

// region: API types ---------------------------------------------------
/**
 * The response body is parsed as JSON and it's up to the client to ensure it
 * matches the TReturnType
 */
export interface PostRequest<TReturnType> {
  type: 'rest';
  method: 'POST';
  /**
   * The request path without `/api/v4`
   * If you want to make request to `https://gitlab.example/api/v4/projects`
   * set the path to `/projects`
   */
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * The response body is parsed as JSON and it's up to the client to ensure it
 * matches the TReturnType
 */
interface GetRequestBase<TReturnType> {
  method: 'GET';
  /**
   * The request path without `/api/v4`
   * If you want to make request to `https://gitlab.example/api/v4/projects`
   * set the path to `/projects`
   */
  path: string;
  searchParams?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface GetRequest<TReturnType> extends GetRequestBase<TReturnType> {
  type: 'rest';
}

export interface GetBufferRequest extends GetRequestBase<Uint8Array> {
  type: 'rest-buffer';
}

export interface GraphQLRequest<TReturnType> {
  type: 'graphql';
  query: string;
  /** Options passed to the GraphQL query */
  variables: Record<string, unknown>;
}

export type ApiRequest<TReturnType> =
  | GetRequest<TReturnType>
  | PostRequest<TReturnType>
  | GraphQLRequest<TReturnType>;

// The interface of the VSCode mediator command COMMAND_FETCH_FROM_API
// Will throw ResponseError if HTTP response status isn't 200
export type fetchFromApi = <TReturnType>(request: ApiRequest<TReturnType>) => Promise<TReturnType>;

// The interface of the VSCode mediator command COMMAND_FETCH_BUFFER_FROM_API
// Will throw ResponseError if HTTP response status isn't 200
export type fetchBufferFromApi = (request: GetBufferRequest) => Promise<VSCodeBuffer>;

/* API exposed by the Web IDE extension
 * See https://code.visualstudio.com/api/references/vscode-api#extensions
 */
export interface WebIDEExtension {
  isTelemetryEnabled: () => boolean;
  projectPath: string;
  currentRef?: string;
  gitlabUrl: string;
}

export interface ResponseError extends Error {
  status: number;
  body?: unknown;
}
