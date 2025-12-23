import type { Uri, TabInputText as TabInputTextType } from 'vscode';

export class TabInputText implements TabInputTextType {
  constructor(readonly uri: Uri) {}
}
