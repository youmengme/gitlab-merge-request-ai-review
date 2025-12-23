import * as vscode from 'vscode';

export interface StatusBarItemUI {
  iconName: string;
  tooltip: string;
  backgroundColor?: vscode.ThemeColor;
}

export const createStatusBarItem = ({
  priority,
  id,
  name,
  initialText,
  command,
  alignment,
}: {
  priority: number;
  id: string;
  name: string;
  initialText: string;
  alignment: vscode.StatusBarAlignment;
  command?: string | vscode.Command;
}) => {
  const statusBarItem = vscode.window.createStatusBarItem(id, alignment, priority);
  statusBarItem.name = name;
  statusBarItem.text = initialText;
  statusBarItem.show();

  if (command) {
    statusBarItem.command = command;
  }

  return statusBarItem;
};
