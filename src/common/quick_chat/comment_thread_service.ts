import vscode, { MarkdownString } from 'vscode';
import { log } from '../log';
import { COMMENT_CONTROLLER_ID, generateThreadLabel } from './utils';

export const QUICK_CHAT_EXPANDED_CONTEXT = 'gitlab:quickChatOpen';
const COMMENT_LOADING_CONTEXT = 'duoCommentLoading';

export class QuickChatCommentThreadService {
  #thread: vscode.CommentThread | null = null;

  #commentController: vscode.CommentController;

  constructor() {
    this.#commentController = vscode.comments.createCommentController(
      COMMENT_CONTROLLER_ID,
      'Duo Quick Chat',
    );
  }

  getThread() {
    return this.#thread;
  }

  createCommentThread(documentUri: vscode.Uri, range: vscode.Range, prompt: string) {
    this.#thread?.dispose();

    this.#commentController.options = { prompt };

    // VS Code v1.98.0 and above requires commenting ranges to be provided to enable mouseDown event within the commentsController.
    // https://github.com/microsoft/vscode/commit/a9a797c322bcfdef9f0a9f929feb3b4008c7732b
    this.#commentController.commentingRangeProvider = {
      provideCommentingRanges: () => {
        return [new vscode.Range(range.end, range.end)];
      },
    };

    const thread = this.#commentController.createCommentThread(documentUri, range, []);
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    thread.label = generateThreadLabel(range);
    this.#thread = thread;

    return thread;
  }

  hideThread() {
    if (this.#thread?.collapsibleState === vscode.CommentThreadCollapsibleState.Expanded) {
      this.#thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
    }
  }

  addUserComment(text: string) {
    if (!this.#thread) return;

    this.#thread.comments = [...this.#thread.comments, this.#createComment(text, 'user', 'You')];
  }

  addLoaderComment() {
    if (!this.#thread) return;

    const loadingText = new vscode.MarkdownString('<b>GitLab Duo Chat</b> is finding an answer');
    loadingText.supportHtml = true;
    const loaderComment = this.#createComment(loadingText, 'loader');

    this.#thread.comments = [...this.#thread.comments, loaderComment];
  }

  removeLoaderComment() {
    if (!this.#thread || this.#getLastCommentContextValue(this.#thread) !== 'loader') return;
    this.#thread.comments = this.#thread.comments.slice(0, -1);
  }

  addResponseComment(response: MarkdownString) {
    if (!this.#thread || this.#getLastCommentContextValue(this.#thread) === 'response') return;

    this.#thread.comments = [
      ...this.#thread.comments,
      this.#createComment(response, 'response', 'Duo'),
    ];
  }

  clearComments() {
    if (!this.#thread) return;

    this.#thread.comments = [];
  }

  addResetComment() {
    if (this.#thread?.comments) {
      const newChatText = new vscode.MarkdownString('<hr /><em>New chat</em>');
      newChatText.supportHtml = true;
      const resetComment = this.#createComment(newChatText, 'reset');
      this.#thread.comments = [...this.#thread.comments, resetComment];
    }
  }

  refreshComments() {
    if (!this.#thread) return;

    this.#thread.comments = [...this.#thread.comments];
  }

  /**
   * to update thread when the selection changes on active editor
   * @param documentUri
   * @param editor
   * @returns
   */
  updateThreadSelection(documentUri: vscode.Uri, editor: vscode.TextEditor) {
    if (!this.#thread) return;

    const { scheme, authority } = documentUri;

    const isInCommentInput = scheme === 'comment' && authority === COMMENT_CONTROLLER_ID;

    // we do not want to recalculate the label because when the focus moves to the input
    // the editor selection becomes empty and it is reflected on the label
    if (isInCommentInput) return;

    if (editor) {
      const { selection } = editor;

      const range = new vscode.Range(selection.start, selection.end);

      const newText = generateThreadLabel(range);

      if (this.#thread.label !== newText) {
        log.debug(
          `[QuickChat] Selection changed, updating quick chat label: ${newText}, ${this.#thread.label}`,
        );
        this.#thread.label = newText;
      }
    }
  }

  /**
   * to update thread when the range changes on active editor
   * - triggered by editing the textDocument content adjusting the range
   * @param change
   * @returns
   */
  updateThreadRange(change: vscode.TextDocumentContentChangeEvent | null) {
    if (!this.#thread || !change) return;

    const updatedRange = this.#calculateThreadRange(change);

    if (!updatedRange) return;

    this.#thread.range = updatedRange;
  }

  #createComment = (
    body: vscode.MarkdownString | string,
    contextValue = '',
    authorName = '',
  ): vscode.Comment => ({
    body,
    mode: vscode.CommentMode.Preview,
    author: { name: authorName },
    contextValue,
  });

  #getLastCommentContextValue = (thread: vscode.CommentThread | null) =>
    thread?.comments.at(-1)?.contextValue;

  /**
   * Calculates the new range for a comment thread when text changes in the document.
   * If text is added or removed before the thread's position, the thread's end position
   * is adjusted to maintain its relative position in the document.
   */
  #calculateThreadRange = (change: vscode.TextDocumentContentChangeEvent): vscode.Range | null => {
    if (!this.#thread) return null;

    // Only care about changes before thread end
    if (change.range.start.line > this.#thread.range.end.line) return null;

    const newLines = change.text.split('\n').length - 1;
    const oldLines = change.range.end.line - change.range.start.line;
    const delta = newLines - oldLines;
    const newEnd = new vscode.Position(
      this.#thread.range.end.line + delta,
      this.#thread.range.end.character,
    );

    return new vscode.Range(this.#thread.range.start, newEnd);
  };

  async setOpenInDocContext(documentUri?: vscode.Uri) {
    const isCommentThreadActive = documentUri === this.#thread?.uri;

    const isExpanded =
      this.#thread?.collapsibleState === vscode.CommentThreadCollapsibleState.Expanded;

    const isExpandedInCurrentDoc = isCommentThreadActive && isExpanded;
    await vscode.commands.executeCommand(
      'setContext',
      'gitlab:quickChatOpen',
      isExpandedInCurrentDoc,
    );
    return isExpandedInCurrentDoc;
  }

  async setLoadingContext(isLoading: boolean) {
    await vscode.commands.executeCommand('setContext', COMMENT_LOADING_CONTEXT, isLoading);
  }

  dispose() {
    this.#commentController.dispose();
  }
}
