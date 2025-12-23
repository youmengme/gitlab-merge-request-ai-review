import * as vscode from 'vscode';
import {
  GetRepositoriesResponse,
  RepositoryState,
  RepositoryEndpoints,
  SelectProjectParams,
  ClearProjectParams,
} from '@gitlab-org/gitlab-lsp';
import { createInterfaceId } from '@gitlab/needle';
import { log } from '../log';
import { diffEmitter } from '../utils/diff_emitter';

export type RepositoryRequestFunction = <TParams = unknown, TResponse = unknown>(
  method: string,
  params?: TParams,
) => Promise<TResponse>;

export interface RepositoryClient {
  getRepositories(): Promise<RepositoryState[]>;
  selectProject(params: SelectProjectParams): Promise<void>;
  clearSelectedProjects(params: ClearProjectParams): Promise<void>;
  onRepositoriesChanged: vscode.Event<RepositoryState[]>;
  handleRepositoriesChanged(change: GetRepositoriesResponse): void;
  setRequestFunction(requestFn: RepositoryRequestFunction): void;
}

export const RepositoryClient = createInterfaceId<RepositoryClient>('RepositoryClient');

export class RepositoryClientImpl implements RepositoryClient {
  #emitter = diffEmitter(new vscode.EventEmitter<RepositoryState[]>());

  #cachedRepositories: RepositoryState[] = [];

  #sendRequest?: RepositoryRequestFunction;

  readonly onRepositoriesChanged = this.#emitter.event;

  setRequestFunction(requestFn: RepositoryRequestFunction) {
    this.#sendRequest = requestFn;
  }

  async selectProject(params: SelectProjectParams): Promise<void> {
    if (!this.#sendRequest) {
      log.warn('Repository client not initialized with request function');
      return;
    }

    try {
      await this.#sendRequest<SelectProjectParams, undefined>(
        RepositoryEndpoints.SELECT_PROJECT,
        params,
      );
      log.info(
        `Selected project ${params.project.namespaceWithPath} for repository ${params.pointer.repository.rootFsPath}`,
      );
    } catch (error) {
      log.error('Failed to select project:', error);
      throw error;
    }
  }

  async clearSelectedProjects(params: ClearProjectParams): Promise<void> {
    if (!this.#sendRequest) {
      log.warn('Repository client not initialized with request function');
      return;
    }

    try {
      await this.#sendRequest<ClearProjectParams, undefined>(
        RepositoryEndpoints.CLEAR_PROJECT,
        params,
      );
      log.info(`Cleared selected projects for repository ${params.rootFsPath}`);
    } catch (error) {
      log.error('Failed to clear selected projects:', error);
      throw error;
    }
  }

  handleRepositoriesChanged(change: GetRepositoriesResponse) {
    const repositories = change.repositories ?? [];
    this.#cachedRepositories = repositories;
    this.#emitter.fire(repositories);
  }

  async getRepositories(): Promise<RepositoryState[]> {
    if (this.#cachedRepositories.length > 0) {
      return this.#cachedRepositories;
    }

    if (!this.#sendRequest) {
      log.warn('Repository client not initialized with request function');
      return [];
    }

    try {
      const result = await this.#sendRequest<undefined, GetRepositoriesResponse>(
        RepositoryEndpoints.GET_REPOSITORIES,
      );
      const repositories = result.repositories ?? [];
      this.#cachedRepositories = repositories;
      return repositories;
    } catch (error) {
      log.error('Failed to get repositories:', error);
      return [];
    }
  }
}
