import * as vscode from 'vscode';
import { CHAT, CHAT_TERMINAL_CONTEXT, DUO_DISABLED_FOR_PROJECT } from '@gitlab-org/gitlab-lsp';
import { LanguageServerFeatureStateProvider } from '../language_server/language_server_feature_state_provider';
import { diffEmitter } from '../utils/diff_emitter';
import { log } from '../log';

export interface ChatState {
  chatAvailable: boolean;
}

const setChatAvailable = (available: boolean) =>
  vscode.commands.executeCommand('setContext', 'gitlab:chatAvailable', available);

const setChatAvailableForProject = (available: boolean) =>
  vscode.commands.executeCommand('setContext', 'gitlab:chatAvailableForProject', available);

const setChatTerminalContextAvailable = (available: boolean) =>
  vscode.commands.executeCommand('setContext', 'gitlab:chatTerminalContextAvailable', available);

export class ChatStateManager implements vscode.Disposable {
  #subscriptions: vscode.Disposable[] = [];

  #languageServerFeatureStateProvider!: LanguageServerFeatureStateProvider;

  #chatState: ChatState = { chatAvailable: false };

  #eventEmitter = diffEmitter(new vscode.EventEmitter<ChatState>());

  onChange = this.#eventEmitter.event;

  constructor(languageServerFeatureStateProvider: LanguageServerFeatureStateProvider) {
    this.#languageServerFeatureStateProvider = languageServerFeatureStateProvider;

    this.#subscriptions.push(
      this.#languageServerFeatureStateProvider.onChange(async states => {
        const chatState = states[CHAT];
        if (!chatState) {
          log.warn(
            `Feature state manager can't find the Duo Chat state. We will disable chat. Please report this as a bug.`,
          );
          await setChatAvailable(false);
          return;
        }

        const chatAvailable = chatState.engagedChecks.length === 0;
        const duoEnabledForProject = !chatState.engagedChecks.find(({ checkId }) => {
          return checkId === DUO_DISABLED_FOR_PROJECT;
        });

        await setChatAvailable(chatAvailable);
        await setChatAvailableForProject(duoEnabledForProject);
        this.#chatState.chatAvailable = chatAvailable;

        const terminalContextState = states[CHAT_TERMINAL_CONTEXT];
        const chatTerminalContextAvailable = terminalContextState?.engagedChecks.length === 0;
        await setChatTerminalContextAvailable(chatTerminalContextAvailable);

        this.#eventEmitter.fire(this.state);
      }),
    );
  }

  get state(): ChatState {
    return this.#chatState;
  }

  dispose() {
    this.#subscriptions.forEach(s => s.dispose());
  }
}
