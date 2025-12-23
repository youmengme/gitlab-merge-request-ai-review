/* eslint-disable max-classes-per-file */
import * as vscode from 'vscode';
import {
  API,
  CredentialsProvider,
  RefType,
  RemoteSourceProvider,
  RemoteSourcePublisher,
  Repository,
} from '../api/git';
import { EventEmitter } from './event_emitter';

const removeFromArray = <T>(array: Array<T>, element: T): Array<T> =>
  array.filter(el => el !== element);

export interface FakeRepositoryOptions {
  rootUriPath: string;
  remotes: [string, string?, string?][];
  headName?: string;
  headRemoteName?: string;
  commit?: string;
}

export const fakeRepositoryOptions: FakeRepositoryOptions = {
  rootUriPath: '/path/to/repo',
  remotes: [['origin', 'git@a.com:gitlab/extension.git']],
};
export const createFakeRepository = (options: Partial<FakeRepositoryOptions> = {}): Repository => {
  const { rootUriPath, remotes, headName, headRemoteName, commit } = {
    ...fakeRepositoryOptions,
    ...options,
  };
  return {
    rootUri: vscode.Uri.file(rootUriPath),
    state: {
      remotes: remotes.map(([name, fetchUrl, pushUrl]) => ({ name, fetchUrl, pushUrl })),
      HEAD: {
        type: RefType.Head,
        remote: headRemoteName,
        name: headName ?? headRemoteName,
        commit,
      },
      refs: [],
    },
    addRemote(name: string, url: string) {
      (this as Repository).state.remotes.push({
        name,
        fetchUrl: url,
        pushUrl: url,
        isReadOnly: false,
      });
    },
    async push(remoteName: string, branchName: string, setUpstream: boolean) {
      if (setUpstream) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const head = (this as any).state.HEAD;
        head.remote = branchName;
      }
    },
    status: async () => undefined,
    getConfig: async () => '',
    log: async () => [],
  } as unknown as Repository;
};

/**
 * This is a simple test double for the native Git extension API
 *
 * It allows us to test our cloning feature without mocking every response
 * and validating arguments of function calls.
 */
class FakeGitApi {
  credentialsProviders: CredentialsProvider[] = [];

  remoteSourceProviders: RemoteSourceProvider[] = [];

  remoteSourcePublishers: RemoteSourcePublisher[] = [];

  repositories: Repository[] = [];

  onDidOpenRepositoryEmitter = new EventEmitter<Repository>();

  onDidOpenRepository = this.onDidOpenRepositoryEmitter.event;

  onDidCloseRepositoryEmitter = new EventEmitter<Repository>();

  onDidCloseRepository = this.onDidCloseRepositoryEmitter.event;

  registerCredentialsProvider(provider: CredentialsProvider) {
    this.credentialsProviders.push(provider);
    return {
      dispose: () => {
        this.credentialsProviders = removeFromArray(this.credentialsProviders, provider);
      },
    };
  }

  getRepository(uri: vscode.Uri) {
    return this.repositories.find(r => r.rootUri.toString() === uri.toString());
  }

  registerRemoteSourceProvider(provider: RemoteSourceProvider) {
    this.remoteSourceProviders.push(provider);
    return {
      dispose: () => {
        this.remoteSourceProviders = removeFromArray(this.remoteSourceProviders, provider);
      },
    };
  }

  registerRemoteSourcePublisher(provider: RemoteSourcePublisher) {
    this.remoteSourcePublishers.push(provider);
    return {
      dispose: () => {
        this.remoteSourcePublishers = removeFromArray(this.remoteSourcePublishers, provider);
      },
    };
  }
}

/**
 * This is a simple test double for the native Git extension
 *
 * We use it to test enabling and disabling the extension.
 */
export class FakeGitExtension {
  enabled = true;

  enablementListeners: (<T>() => T)[] = [];

  gitApi = new FakeGitApi();

  onDidChangeEnablementEmitter = new EventEmitter<boolean>();

  onDidChangeEnablement = this.onDidChangeEnablementEmitter.event;

  getAPI(): API {
    return this.gitApi as unknown as API;
  }
}
