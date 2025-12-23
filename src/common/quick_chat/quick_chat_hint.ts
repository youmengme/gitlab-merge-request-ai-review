import vscode from 'vscode';
import { find, range } from 'lodash';
import { CONFIG_NAMESPACE } from '../constants';
import { getEnvInfo } from '../env';

export class QuickChatHint {
  #hintDecoration: vscode.TextEditorDecorationType;

  #isHintEnabled: boolean;

  constructor() {
    this.#hintDecoration = this.#createHintDecoration();
    this.#isHintEnabled =
      vscode.workspace.getConfiguration(CONFIG_NAMESPACE)?.keybindingHints?.enabled || false;
  }

  updateHint(event: vscode.TextEditorSelectionChangeEvent) {
    const editor = event.textEditor;
    const selection = event.selections[0];

    if (
      !this.#isHintEnabled || // if user disabled the hint in settings
      selection.isEmpty || // if there is no selected text
      editor.document.uri.scheme !== 'file' // if we are not in a file
    ) {
      editor.setDecorations(this.#hintDecoration, []);
      return;
    }

    const position = this.#calculateHintPosition(editor, selection);
    if (!position) {
      editor.setDecorations(this.#hintDecoration, []);
      return;
    }

    editor.setDecorations(this.#hintDecoration, [
      {
        range: new vscode.Range(position, position),
      },
    ]);
  }

  #calculateHintPosition(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
  ): vscode.Position | undefined {
    if (selection.isEmpty) return undefined;

    const isLineEmpty = (lineNumber: number): boolean =>
      editor.document.lineAt(lineNumber).text.trim().length === 0;

    const getLineEndChar = (lineNumber: number): number =>
      editor.document.lineAt(lineNumber).text.trimEnd().length;

    // Find first non-empty line in selection
    const firstNonEmptyLine = find(
      range(selection.start.line, selection.end.line + 1),
      i => !isLineEmpty(i),
    );

    if (firstNonEmptyLine === undefined) {
      return undefined;
    }

    return new vscode.Position(firstNonEmptyLine, getLineEndChar(firstNonEmptyLine));
  }

  #createHintDecoration = (): vscode.TextEditorDecorationType =>
    vscode.window.createTextEditorDecorationType({
      after: {
        contentText: getEnvInfo().isMacOS ? '⌥C Duo Quick Chat' : '(Alt+C) Duo Quick Chat',
        margin: '0 0 0 6ch',
        color: new vscode.ThemeColor('editorHint.foreground'),
        fontStyle: 'normal',
        textDecoration: 'none; filter: opacity(0.34);',
      },
    });

  onConfigChange() {
    this.#isHintEnabled =
      vscode.workspace.getConfiguration(CONFIG_NAMESPACE)?.keybindingHints?.enabled;
  }

  dispose() {
    this.#hintDecoration?.dispose();
  }
}
