import * as vscode from 'vscode';
import { VS_COMMANDS } from '../command_names';
import { openDiffWithBehavior } from './diff_utils';

describe('diff_utils', () => {
  const leftUri = vscode.Uri.parse('file:///test/original.ts');
  const rightUri = vscode.Uri.parse('file:///test/modified.ts');
  const title = 'Test Diff';

  beforeEach(() => {
    vscode.commands.executeCommand = jest.fn().mockResolvedValue(undefined);
  });

  describe('openDiffWithBehavior', () => {
    it('should not open diff when behavior is "none"', async () => {
      await openDiffWithBehavior(leftUri, rightUri, title, 'none');

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should open diff in foreground when behavior is "foreground"', async () => {
      await openDiffWithBehavior(leftUri, rightUri, title, 'foreground');

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        VS_COMMANDS.DIFF,
        leftUri,
        rightUri,
        title,
        undefined,
      );
    });

    it('should open diff in background when behavior is "background"', async () => {
      await openDiffWithBehavior(leftUri, rightUri, title, 'background');

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        VS_COMMANDS.DIFF,
        leftUri,
        rightUri,
        title,
        { preview: false, preserveFocus: true, background: true },
      );
    });
  });
});
