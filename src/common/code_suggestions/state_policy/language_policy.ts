import * as vscode from 'vscode';
import {
  DUO_CODE_SUGGESTIONS_SUPPORTED_LANGUAGES,
  DUO_CODE_SUGGESTIONS_USER_LANGUAGES,
  getDuoCodeSuggestionsLanguages,
} from '../../utils/extension_configuration';
import { DUO_CODE_SUGGESTIONS_LANGUAGES } from '../constants';
import { StatePolicy, VisibleState } from './state_policy';

export const UNSUPPORTED_LANGUAGE: VisibleState = 'code-suggestions-document-unsupported-language';
export const DISABLED_LANGUAGE_VIA_SETTINGS: VisibleState =
  'code-suggestions-document-disabled-language';

export class LanguagePolicy implements StatePolicy {
  #subscriptions: vscode.Disposable[] = [];

  #eventEmitter = new vscode.EventEmitter<boolean>();

  #isLanguageSupported = false;

  #isLanguageEnabled = false;

  #enabledLanguages: string[] = DUO_CODE_SUGGESTIONS_LANGUAGES;

  constructor() {
    this.#setEnabledLanguages();
    this.#subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (
          e.affectsConfiguration(DUO_CODE_SUGGESTIONS_USER_LANGUAGES) ||
          e.affectsConfiguration(DUO_CODE_SUGGESTIONS_SUPPORTED_LANGUAGES)
        ) {
          this.#setEnabledLanguages();
          this.#updateAndFireEventIfChanged(vscode.window.activeTextEditor);
        }
      }),
      vscode.window.onDidChangeActiveTextEditor(te => this.#updateAndFireEventIfChanged(te)),
    );
  }

  async init() {
    this.#updateAndFireEventIfChanged(vscode.window.activeTextEditor);
  }

  get engaged() {
    return !this.#isLanguageEnabled;
  }

  get state() {
    if (this.#isLanguageSupported && !this.#isLanguageEnabled)
      return DISABLED_LANGUAGE_VIA_SETTINGS;

    return UNSUPPORTED_LANGUAGE;
  }

  onEngagedChange = this.#eventEmitter.event;

  dispose() {
    this.#subscriptions.forEach(s => s.dispose());
  }

  #updateAndFireEventIfChanged(textEditor?: vscode.TextEditor): void {
    const { engaged, state } = this;

    this.#update(textEditor);

    if (engaged !== this.engaged || state !== this.state) {
      this.#eventEmitter.fire(this.engaged);
    }
  }

  #update(textEditor?: vscode.TextEditor): void {
    if (!textEditor) {
      this.#isLanguageSupported = false;
      this.#isLanguageEnabled = false;
      return;
    }

    const { languageId } = textEditor.document;

    this.#isLanguageSupported = DUO_CODE_SUGGESTIONS_LANGUAGES.includes(languageId);
    this.#isLanguageEnabled = this.#enabledLanguages.includes(languageId);
  }

  #setEnabledLanguages() {
    this.#enabledLanguages = getDuoCodeSuggestionsLanguages();
  }
}
