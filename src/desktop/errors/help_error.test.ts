import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { VS_COMMANDS } from '../../common/command_names';
import { contextUtils } from '../utils/context_utils';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { HelpError, README_SECTIONS } from './help_error';

describe('HelpError', () => {
  describe('show', () => {
    beforeAll(() => {
      contextUtils.init({
        extensionUri: vscode.Uri.parse(`file:///path/to/extension`),
      } as vscode.ExtensionContext);
      jest
        .mocked(vscode.window.showErrorMessage)
        .mockResolvedValue(createFakePartial<vscode.MessageItem>({ title: 'Show Help' }));
    });

    it('opens the file', async () => {
      const error = new HelpError('message');

      await error.showUi();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        VS_COMMANDS.MARKDOWN_SHOW_PREVIEW,
        vscode.Uri.parse(`file:///path/to/extension/README.md`),
      );
    });

    it('opens the file to the correct section', async () => {
      const error = new HelpError('message', { section: README_SECTIONS.SETUP }); // any section can be used here

      await error.showUi();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        VS_COMMANDS.MARKDOWN_SHOW_PREVIEW,
        vscode.Uri.parse(`file:///path/to/extension/README.md#setup`),
      );
    });
  });

  describe('readme sections', () => {
    let headings: string[] = [];

    const README_PATH = path.join(__dirname, '..', '..', '..', 'README.md');

    beforeAll(async () => {
      const readme = await fs.readFile(README_PATH, 'utf-8');
      const matches = readme.match(/^#+(.*)$/gm);
      if (!matches) {
        return;
      }
      headings = matches.map(match => {
        const heading = match.replace(/^#+\s*/, '');
        return heading.trim().toLowerCase().replace(/\W/g, '-');
      });
    });

    it.each(Object.values(README_SECTIONS))('Readme contains "%s" section', (section: string) => {
      expect(headings).toContain(section);
    });
  });
});
