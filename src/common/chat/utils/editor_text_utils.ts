import * as vscode from 'vscode';

export const getActiveEditorText = (): string | null => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return null;

  return editor.document.getText();
};

export const getActiveSelectionRange = (): vscode.Range | null => {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.selection || editor.selection.isEmpty) return null;
  const { selection } = editor;

  return new vscode.Range(
    selection.start.line,
    selection.start.character,
    selection.end.line,
    selection.end.character,
  );
};

export const getSelectedText = (
  document: vscode.TextDocument,
  selectionRange: vscode.Range,
): string => {
  return document.getText(selectionRange);
};

export const getFileName = (document: vscode.TextDocument): string => {
  return vscode.workspace.asRelativePath(document.uri);
};

export const getTextBeforeSelected = (
  document: vscode.TextDocument,
  selectionRange: vscode.Range,
): string => {
  const { line: lineNum, character: charNum } = selectionRange.start;

  const isFirstCharOnLineSelected = charNum === 0;
  const isFirstLine = lineNum === 0;

  const getEndLine = () => {
    if (isFirstCharOnLineSelected) {
      if (isFirstLine) {
        return lineNum;
      }
      return lineNum - 1;
    }
    return lineNum;
  };

  const getEndChar = () => {
    if (isFirstCharOnLineSelected) {
      if (isFirstLine) {
        return 0;
      }
      return document.lineAt(lineNum - 1).range.end.character;
    }
    return charNum - 1;
  };

  const beforeRange = new vscode.Range(0, 0, getEndLine(), getEndChar());

  return document.getText(beforeRange);
};

export const getTextAfterSelected = (
  document: vscode.TextDocument,
  selectionRange: vscode.Range,
): string => {
  const { line: lineNum, character: charNum } = selectionRange.end;

  const lastLine = document.lineCount - 1;
  const isLastCharOnLineSelected = charNum === document.lineAt(lineNum).range.end.character;
  const isLastLine = lineNum === lastLine;

  const getStartLine = () => {
    if (isLastCharOnLineSelected) {
      if (isLastLine) {
        return lineNum;
      }
      return lineNum + 1;
    }
    return lineNum;
  };

  const getStartChar = () => {
    if (isLastCharOnLineSelected) {
      if (isLastLine) {
        return charNum;
      }
      return 0;
    }
    return charNum + 1;
  };

  const startLine = getStartLine();
  const startChar = getStartChar();

  const afterRange = new vscode.Range(
    startLine,
    startChar,
    lastLine,
    document.lineAt(lastLine).range.end.character,
  );

  return document.getText(afterRange);
};
