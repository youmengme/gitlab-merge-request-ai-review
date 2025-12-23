import * as vscode from 'vscode';
import { VS_COMMANDS } from '../command_names';

export type EditFileDiffBehavior = 'foreground' | 'background' | 'none';

/**
 * Opens a diff view in VS Code with the specified behavior.
 *
 * @param leftUri - The URI of the left side (original) of the diff
 * @param rightUri - The URI of the right side (modified) of the diff
 * @param title - The title to display for the diff tab
 * @param behavior - How to open the diff:
 *   - 'foreground': Open diff and focus it
 *   - 'background': Open diff but keep focus on current editor
 *   - 'none': Do not open diff at all
 */
export async function openDiffWithBehavior(
  leftUri: vscode.Uri,
  rightUri: vscode.Uri,
  title: string,
  behavior: EditFileDiffBehavior,
): Promise<void> {
  if (behavior === 'none') {
    return;
  }

  const options =
    behavior === 'background'
      ? { preview: false, preserveFocus: true, background: true }
      : undefined;

  await vscode.commands.executeCommand(VS_COMMANDS.DIFF, leftUri, rightUri, title, options);
}
