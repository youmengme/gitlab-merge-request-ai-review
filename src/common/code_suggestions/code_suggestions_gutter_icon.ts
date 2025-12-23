import * as vscode from 'vscode';
import { mapValues } from 'lodash';
import {
  CodeSuggestionsStateManager,
  VisibleCodeSuggestionsState,
} from './code_suggestions_state_manager';

interface GutterIconStatus {
  readonly path: string;
}
type GutterIconStatuses = Partial<Record<VisibleCodeSuggestionsState, GutterIconStatus>>;
type GutterIconDecorations = Partial<
  Record<VisibleCodeSuggestionsState, vscode.TextEditorDecorationType>
>;

const GUTTER_ICON_STATUSES: GutterIconStatuses = {
  [VisibleCodeSuggestionsState.LOADING]: {
    path: 'assets/icons/gitlab-code-suggestions-loading.svg',
  },
  [VisibleCodeSuggestionsState.ERROR]: {
    path: 'assets/icons/gitlab-code-suggestions-error.svg',
  },
};

const createGutterIconDecorations = (context: vscode.ExtensionContext): GutterIconDecorations =>
  mapValues(
    GUTTER_ICON_STATUSES,
    status =>
      status &&
      vscode.window.createTextEditorDecorationType({
        gutterIconPath: vscode.Uri.joinPath(context.extensionUri, status.path),
      }),
  );

export class CodeSuggestionsGutterIcon {
  readonly #decorations: GutterIconDecorations;

  readonly #subscriptions: vscode.Disposable[];

  #currentDecoration?: vscode.TextEditorDecorationType;

  #lastState: VisibleCodeSuggestionsState;

  constructor(context: vscode.ExtensionContext, state: CodeSuggestionsStateManager) {
    this.#decorations = createGutterIconDecorations(context);
    this.#lastState = VisibleCodeSuggestionsState.READY;
    this.#subscriptions = [
      // We might actually not need to listen to this change since the stateSubscription likely changes after the text selection changes
      vscode.window.onDidChangeTextEditorSelection(() => {
        this.#update(this.#lastState);
      }),

      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          this.#update(VisibleCodeSuggestionsState.READY);
        }
      }),

      state.onDidChangeVisibleState(currentState => {
        this.#update(currentState);
      }),
    ];
  }

  dispose() {
    this.#subscriptions.forEach(x => x.dispose());
  }

  #update(state: VisibleCodeSuggestionsState) {
    this.#lastState = state;
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return;
    }

    if (this.#currentDecoration) {
      editor.setDecorations(this.#currentDecoration, []);
    }

    const decoration = this.#decorations[state];

    if (decoration) {
      this.#currentDecoration = decoration;
      editor.setDecorations(decoration, [
        {
          // note: If selecting a block, just show the icon at the top
          range: new vscode.Range(editor.selection.start, editor.selection.start),
        },
      ]);
    }
  }
}
