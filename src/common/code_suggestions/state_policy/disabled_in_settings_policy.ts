import vscode from 'vscode';
import {
  DUO_CODE_SUGGESTIONS_MODE,
  getDuoCodeSuggestionsConfiguration,
} from '../../utils/extension_configuration';
import { diffEmitter } from '../../utils/diff_emitter';
import { StatePolicy, VisibleState } from './state_policy';

export const DISABLED_VIA_SETTINGS: VisibleState = 'code-suggestions-global-disabled-via-settings';

export class DisabledInSettingsPolicy implements StatePolicy {
  #subscriptions: vscode.Disposable[] = [];

  #eventEmitter = diffEmitter(new vscode.EventEmitter<boolean>());

  #disabledInSettings: boolean;

  constructor() {
    this.#subscriptions.push(this.#eventEmitter);

    this.#disabledInSettings = !getDuoCodeSuggestionsConfiguration().enabled;
    this.#subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(DUO_CODE_SUGGESTIONS_MODE)) {
          this.#disabledInSettings = !getDuoCodeSuggestionsConfiguration().enabled;
          this.#eventEmitter.fire(this.engaged);
        }
      }),
    );
  }

  get engaged() {
    return this.#disabledInSettings;
  }

  state = DISABLED_VIA_SETTINGS;

  onEngagedChange = this.#eventEmitter.event;

  dispose() {
    this.#subscriptions.forEach(s => s.dispose());
  }
}
