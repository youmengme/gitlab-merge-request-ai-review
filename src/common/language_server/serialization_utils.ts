import * as vscode from 'vscode';

export const serializePosition = (position: vscode.Position): vscode.Position =>
  ({
    line: position.line,
    character: position.character,
  }) as vscode.Position;

export const serializeRange = (range: vscode.Range): vscode.Range =>
  ({
    start: serializePosition(range.start),
    end: serializePosition(range.end),
  }) as vscode.Range;

const serializeSelectedCompletionInfo = (
  selectedCompletionInfo?: vscode.SelectedCompletionInfo,
): vscode.SelectedCompletionInfo | undefined => {
  if (!selectedCompletionInfo) {
    return undefined;
  }

  return {
    text: selectedCompletionInfo.text,
    range: serializeRange(selectedCompletionInfo.range),
  } as unknown as vscode.SelectedCompletionInfo;
};

export const serializeInlineCompletionContext = (
  inlineCompletionContext: vscode.InlineCompletionContext,
): vscode.InlineCompletionContext => ({
  triggerKind: inlineCompletionContext.triggerKind,
  selectedCompletionInfo: serializeSelectedCompletionInfo(
    inlineCompletionContext.selectedCompletionInfo,
  ),
});
