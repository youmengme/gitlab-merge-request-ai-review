import * as vscode from 'vscode';

export interface UserMessageAction {
  title: string;
  callback: () => Promise<void> | void;
}

export class UserMessage {
  readonly #storageKey: string;

  readonly #message: string;

  readonly #globalState: vscode.Memento;

  readonly #actions: UserMessageAction[];

  // we only show the message once per VS Code window even if the user only dismisses the message
  #hasBeenShownInSession = false;

  /**
   * @param storageKey - the string should be date prefixed to ensure we avoid conflicts in the local storage e.g. `2025-01-15-message-singleAccount`
   */
  constructor(
    globalState: vscode.Memento,
    storageKey: string,
    message: string,
    actions: UserMessageAction[] = [],
  ) {
    this.#globalState = globalState;
    this.#storageKey = storageKey;
    this.#message = message;
    this.#actions = actions;
  }

  async trigger() {
    if (this.#globalState.get(this.#storageKey)) return;

    if (this.#hasBeenShownInSession) return;

    this.#hasBeenShownInSession = true;

    const actionTitles = this.#actions.map(a => a.title);
    const allOptions = [...actionTitles, "Don't show again"];

    const selection = await vscode.window.showInformationMessage(this.#message, ...allOptions);

    if (selection === "Don't show again") {
      await this.#globalState.update(this.#storageKey, true);
      return;
    }

    const selectedAction = this.#actions.find(a => a.title === selection);
    if (selectedAction) {
      await selectedAction.callback();
    }
  }
}
