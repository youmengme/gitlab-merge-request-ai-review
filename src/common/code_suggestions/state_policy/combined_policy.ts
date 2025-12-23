import vscode from 'vscode';
import { diffEmitter } from '../../utils/diff_emitter';
import { StatePolicy } from './state_policy';

export class CombinedPolicy implements StatePolicy {
  #subscriptions: vscode.Disposable[] = [];

  #eventEmitter = diffEmitter(new vscode.EventEmitter<boolean>());

  #policies: StatePolicy[];

  constructor(...policies: StatePolicy[]) {
    // at least one policy is necessary so we can return the required state attribute
    if (policies.length === 0) {
      throw new Error("policies can't be empty");
    }
    this.#policies = policies;
    this.#subscriptions.push(
      ...this.#policies.map(d => d.onEngagedChange(() => this.#eventEmitter.fire(this.engaged))),
    );
  }

  get engaged() {
    return this.#policies.some(p => p.engaged);
  }

  get state() {
    const policy = this.#policies.find(p => p.engaged) || this.#policies[0];
    return policy.state;
  }

  onEngagedChange = this.#eventEmitter.event;

  dispose(): void {
    this.#subscriptions.forEach(s => s.dispose());
  }
}
