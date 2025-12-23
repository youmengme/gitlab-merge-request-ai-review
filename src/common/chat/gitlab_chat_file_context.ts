import vscode from 'vscode';
import {
  getSelectedText,
  getFileName,
  getTextAfterSelected,
  getTextBeforeSelected,
  getActiveSelectionRange,
} from './utils/editor_text_utils';

export type GitLabChatFileContext = {
  fileName: string;
  selectedText: string;
  contentAboveCursor: string | null;
  contentBelowCursor: string | null;
};

export const getFileContext = (document: vscode.TextDocument, selectionRange: vscode.Range) => {
  const selectedText = getSelectedText(document, selectionRange);
  const fileName = getFileName(document);

  if (!selectedText || !fileName) {
    return undefined;
  }

  return {
    selectedText,
    fileName,
    contentAboveCursor: getTextBeforeSelected(document, selectionRange),
    contentBelowCursor: getTextAfterSelected(document, selectionRange),
  };
};

export const getActiveFileContext = (): GitLabChatFileContext | undefined => {
  const editor = vscode.window.activeTextEditor;
  const document = editor?.document;
  const selectionRange = getActiveSelectionRange();

  if (!editor || !document || !selectionRange) {
    return undefined;
  }

  return getFileContext(document, selectionRange);
};
