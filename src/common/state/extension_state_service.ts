import * as vscode from 'vscode';

export type StateKey<T> = string & { __brand: 'StateKey'; __type: T };

export interface ExtensionStateProvider<T> {
  state: T;
  onChange: vscode.Event<T>;
}

export interface ExtensionStateService {
  onChange: vscode.Event<void>;

  addStateProvider<T>(key: StateKey<T>, provider: ExtensionStateProvider<T>): void;

  get<T>(key: StateKey<T>): ExtensionStateProvider<T>;
}

export class DefaultExtensionStateService implements ExtensionStateService {
  #subscriptions: vscode.Disposable[] = [];

  #eventEmitter = new vscode.EventEmitter<void>();

  onChange = this.#eventEmitter.event;

  #providers: Record<StateKey<unknown>, ExtensionStateProvider<unknown>> = {};

  addStateProvider<T>(key: StateKey<T>, provider: ExtensionStateProvider<T>) {
    this.#providers[key] = provider;
    this.#subscriptions.push(provider.onChange(() => this.#eventEmitter.fire()));
    this.#eventEmitter.fire();
  }

  get<T>(key: StateKey<T>): ExtensionStateProvider<T> {
    const provider = this.#providers[key];
    if (!provider) {
      throw new Error(`No state provider registered for key: ${key}`);
    }
    return provider as ExtensionStateProvider<T>;
  }
}
