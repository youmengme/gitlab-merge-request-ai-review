import * as vscode from 'vscode';
import { createInterfaceId } from '@gitlab/needle';
import {
  AGENT_PLATFORM,
  AGENTIC_CHAT,
  AUTHENTICATION,
  CHAT,
  CHAT_TERMINAL_CONTEXT,
  CODE_SUGGESTIONS,
  Feature,
  FeatureState,
  FLOWS,
} from '@gitlab-org/gitlab-lsp';
import { diffEmitter } from '../utils/diff_emitter';
import { StateKey } from '../state/extension_state_service';

export type AllFeaturesState = {
  [key in Feature]: FeatureState;
};

export const LanguageServerFeatureStateKey =
  'LanguageServerFeatureState' as StateKey<AllFeaturesState>;

export interface LanguageServerFeatureStateProvider {
  onChange(
    listener: (e: AllFeaturesState) => void,
    thisArgs?: unknown,
    disposables?: vscode.Disposable[],
  ): vscode.Disposable;
  setStates(states: FeatureState[]): void;
  readonly state: AllFeaturesState;
}

export const LanguageServerFeatureStateProvider =
  createInterfaceId<LanguageServerFeatureStateProvider>('LanguageServerFeatureStateProvider');

export class LanguageServerFeatureStateProviderImpl implements LanguageServerFeatureStateProvider {
  #eventEmitter = diffEmitter(new vscode.EventEmitter<AllFeaturesState>());

  #states: FeatureState[] = [];

  onChange(
    listener: (e: AllFeaturesState) => void,
    thisArgs?: unknown,
    disposables?: vscode.Disposable[],
  ): vscode.Disposable {
    // Emit the current state immediately when this listener is added
    listener(this.state);

    // Subscribe the listener to future state changes
    const disposable = this.#eventEmitter.event(listener, thisArgs, disposables);

    return new vscode.Disposable(() => disposable.dispose());
  }

  setStates = (states: FeatureState[]) => {
    this.#states = states;
    this.#eventEmitter.fire(this.state);
  };

  get state(): AllFeaturesState {
    const allFeaturesState: AllFeaturesState = {
      [AUTHENTICATION]: { featureId: AUTHENTICATION, engagedChecks: [], allChecks: [] },
      [CODE_SUGGESTIONS]: { featureId: CODE_SUGGESTIONS, engagedChecks: [], allChecks: [] },
      [CHAT]: { featureId: CHAT, engagedChecks: [], allChecks: [] },
      [CHAT_TERMINAL_CONTEXT]: {
        featureId: CHAT_TERMINAL_CONTEXT,
        engagedChecks: [],
        allChecks: [],
      },
      [AGENTIC_CHAT]: { featureId: AGENTIC_CHAT, engagedChecks: [], allChecks: [] },
      [FLOWS]: { featureId: FLOWS, engagedChecks: [], allChecks: [] },
      [AGENT_PLATFORM]: { featureId: AGENT_PLATFORM, engagedChecks: [], allChecks: [] },
    } as AllFeaturesState;

    this.#states.forEach(state => {
      allFeaturesState[state.featureId] = {
        featureId: state.featureId,
        engagedChecks: state.engagedChecks,
        allChecks: state.allChecks,
      };
    });

    return allFeaturesState;
  }
}
