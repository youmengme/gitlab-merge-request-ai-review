import vscode from 'vscode';
import { diffEmitter } from '../../utils/diff_emitter';
import { StatePolicy, VisibleState } from './state_policy';

export const DISABLED_BY_USER: VisibleState = 'code-suggestions-disabled-by-user';

export class DisabledForSessionPolicy implements StatePolicy {
  #subscriptions: vscode.Disposable[] = [];

  #eventEmitter = diffEmitter(new vscode.EventEmitter<boolean>());

  #isDisabled = false;

  get engaged() {
    return this.#isDisabled;
  }

  state = DISABLED_BY_USER;

  onEngagedChange = this.#eventEmitter.event;

  dispose() {
    this.#subscriptions.forEach(s => s.dispose());
  }

  setTemporaryDisabled = (isDisabled: boolean) => {
    this.#isDisabled = isDisabled;
    this.#eventEmitter.fire(isDisabled);
  };
}

/** This policy is a singleton because a VS Code command needs to be able to update it. */
export const disabledForSessionPolicy = new DisabledForSessionPolicy();
