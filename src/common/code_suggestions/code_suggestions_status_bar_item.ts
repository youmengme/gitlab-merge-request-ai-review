import * as vscode from 'vscode';
import { StatusBarItemUI, createStatusBarItem } from '../utils/status_bar_item';
import { SHOW_QUICK_PICK_MENU } from '../duo_quick_pick/commands/show_quick_pick_menu';
import { log } from '../log';
import {
  CodeSuggestionsStateManager,
  VisibleCodeSuggestionsState,
} from './code_suggestions_state_manager';

export const CODE_SUGGESTION_LABEL = 'Duo';
const errorBackgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
export const CODE_SUGGESTIONS_STATUSES: Record<VisibleCodeSuggestionsState, StatusBarItemUI> = {
  [VisibleCodeSuggestionsState.DISABLED_VIA_SETTINGS]: {
    iconName: 'gitlab-code-suggestions-disabled',
    tooltip: 'Code suggestions are disabled',
  },
  [VisibleCodeSuggestionsState.DISABLED_LANGUAGE_VIA_SETTINGS]: {
    iconName: 'gitlab-code-suggestions-disabled',
    tooltip: 'Code suggestions are disabled for this language',
  },
  [VisibleCodeSuggestionsState.READY]: {
    iconName: 'gitlab-code-suggestions-enabled',
    tooltip: 'Code suggestions are enabled',
  },
  [VisibleCodeSuggestionsState.UNSUPPORTED_LANGUAGE]: {
    iconName: 'gitlab-code-suggestions-disabled',
    tooltip: 'Code suggestions are not supported for this language',
  },
  [VisibleCodeSuggestionsState.DISABLED_BY_USER]: {
    iconName: 'gitlab-code-suggestions-disabled',
    tooltip: 'Code suggestions are disabled per user request. Click to enable',
  },
  [VisibleCodeSuggestionsState.NO_ACCOUNT]: {
    iconName: 'gitlab-code-suggestions-disabled',
    tooltip: 'Code suggestions are disabled because there is no user account',
  },
  [VisibleCodeSuggestionsState.SUGGESTIONS_API_ERROR]: {
    iconName: 'gitlab-code-suggestions-error',
    tooltip: 'Code Suggestion requests to API are failing',
    backgroundColor: errorBackgroundColor,
  },
  [VisibleCodeSuggestionsState.ERROR]: {
    iconName: 'gitlab-code-suggestions-error',
    tooltip: 'Code Suggestion requests to API are failing',
    backgroundColor: errorBackgroundColor,
  },
  [VisibleCodeSuggestionsState.NO_LICENSE]: {
    iconName: 'gitlab-code-suggestions-disabled',
    tooltip:
      'A GitLab Duo license is required to use this feature. Contact your GitLab administrator to request access.',
    backgroundColor: errorBackgroundColor,
  },
  [VisibleCodeSuggestionsState.DISABLED_BY_PROJECT]: {
    iconName: 'gitlab-code-suggestions-disabled',
    tooltip: 'Code suggestions are disabled for this project',
  },
  [VisibleCodeSuggestionsState.UNSUPPORTED_GITLAB_VERSION]: {
    iconName: 'gitlab-code-suggestions-disabled',
    tooltip: 'GitLab Duo Code Suggestions requires GitLab version 16.8 or later.',
  },
  [VisibleCodeSuggestionsState.AUTHENTICATION_REQUIRED]: {
    iconName: 'gitlab-code-suggestions-disabled',
    tooltip: 'Authentication required for Code Suggestions',
  },
  [VisibleCodeSuggestionsState.SUGGESTIONS_FILE_EXCLUDED]: {
    iconName: 'gitlab-code-suggestions-disabled',
    tooltip: 'File excluded from GitLab Duo context by project settings',
  },
};

export class CodeSuggestionsStatusBarItem {
  codeSuggestionsStatusBarItem?: vscode.StatusBarItem;

  #codeSuggestionsStateSubscription?: vscode.Disposable;

  updateCodeSuggestionsItem(state: VisibleCodeSuggestionsState) {
    if (!this.codeSuggestionsStatusBarItem) return;
    if (state === VisibleCodeSuggestionsState.LOADING) return;

    const newUiState = CODE_SUGGESTIONS_STATUSES[state];

    if (!newUiState) {
      log.warn(
        `[Duo Status Bar Item] State ${state} doesn't have a UI icon defined, falling back to "gitlab-code-suggestions-disabled"`,
      );
      this.codeSuggestionsStatusBarItem.text = `$(gitlab-code-suggestions-disabled) ${CODE_SUGGESTION_LABEL}`;
      this.codeSuggestionsStatusBarItem.tooltip = `Code suggestions unavailable (unknown state: ${state})`;
      return;
    }

    this.codeSuggestionsStatusBarItem.text = `$(${newUiState.iconName}) ${CODE_SUGGESTION_LABEL}`;
    this.codeSuggestionsStatusBarItem.tooltip = newUiState.tooltip;
    this.codeSuggestionsStatusBarItem.backgroundColor = newUiState.backgroundColor;

    this.#updateItemForDiagnosticStatus(state);
  }

  #updateItemForDiagnosticStatus(state: VisibleCodeSuggestionsState) {
    if (!this.codeSuggestionsStatusBarItem) return;

    if (state === VisibleCodeSuggestionsState.NO_LICENSE) {
      this.codeSuggestionsStatusBarItem.tooltip = 'GitLab Duo failed diagnostic checks.';
    }
  }

  constructor(state: CodeSuggestionsStateManager) {
    this.codeSuggestionsStatusBarItem = createCodeSuggestionStatusBarItem();
    this.updateCodeSuggestionsItem(state.getVisibleState());
    this.#codeSuggestionsStateSubscription = state.onDidChangeVisibleState(e =>
      this.updateCodeSuggestionsItem(e),
    );
  }

  dispose(): void {
    this.#codeSuggestionsStateSubscription?.dispose();
  }
}

function createCodeSuggestionStatusBarItem() {
  return createStatusBarItem({
    priority: Number.MAX_VALUE,
    id: 'gl.status.code_suggestions',
    name: 'GitLab Workflow: Code Suggestions',
    initialText: '$(gitlab-code-suggestions-disabled)',
    command: SHOW_QUICK_PICK_MENU,
    alignment: vscode.StatusBarAlignment.Right,
  });
}
