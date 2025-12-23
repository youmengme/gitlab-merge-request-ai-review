import vscode from 'vscode';
import { COMMENT_CONTROLLER_ID } from './utils';

export class QuickChatGutterIcon {
  #gutterIconDecoration: vscode.TextEditorDecorationType;

  #extensionContext: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.#extensionContext = context;
    this.#gutterIconDecoration = this.#createGutterIconDecoration(
      this.#extensionContext.extensionUri,
    );
  }

  #createGutterIconDecoration = (extensionUri: vscode.Uri): vscode.TextEditorDecorationType =>
    vscode.window.createTextEditorDecorationType({
      gutterIconPath: vscode.Uri.joinPath(extensionUri, 'assets/icons/gitlab-duo-quick-chat.svg'),
    });

  toggleGutterIcon(thread: vscode.CommentThread | null) {
    const threadUri = thread?.uri;
    const editor = vscode.window.activeTextEditor;
    const isInLogOutput = editor?.document.languageId === 'Log';

    const isInCommentInput = editor?.document.uri.authority === COMMENT_CONTROLLER_ID;
    const isCollapsed = thread?.collapsibleState === vscode.CommentThreadCollapsibleState.Collapsed;

    // If we're in comment input or output panel, find the editor for the thread's document
    const targetEditor =
      isInCommentInput || isInLogOutput
        ? vscode.window.visibleTextEditors.find(e => e.document.uri === threadUri)
        : editor;

    this.resetGutterIcon(targetEditor);

    const shouldShowIcon = targetEditor && !isCollapsed && targetEditor.document.uri === threadUri;

    if (!shouldShowIcon || !thread) return;

    targetEditor.setDecorations(this.#gutterIconDecoration, [
      {
        range: new vscode.Range(thread.range.end, thread.range.end),
      },
    ]);
  }

  resetGutterIcon(editor?: vscode.TextEditor) {
    const targetEditor = editor ?? vscode.window.activeTextEditor;
    targetEditor?.setDecorations(this.#gutterIconDecoration, []);
  }

  dispose() {
    this.#gutterIconDecoration?.dispose();
  }
}
