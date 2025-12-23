import * as vscode from 'vscode';

export function isInlineCompletionList(
  list: vscode.InlineCompletionList | vscode.InlineCompletionItem[] | never | null | undefined,
): list is vscode.InlineCompletionList {
  return (list as vscode.InlineCompletionList)?.items !== undefined;
}
