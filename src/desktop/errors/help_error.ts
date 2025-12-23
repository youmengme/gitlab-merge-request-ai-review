import * as vscode from 'vscode';
import { VS_COMMANDS } from '../../common/command_names';
import { contextUtils } from '../utils/context_utils';
import { UiError } from '../../common/errors/ui_error';

/** The values are slugs used in the README.md URL fragment (#slug) to identify headings */
export const README_SECTIONS = {
  SETUP: 'setup',
  REMOTEFS: 'browse-a-repository-without-cloning',
  MINIMUM_VERSION: 'minimum-supported-version',
} as const;

export type ReadmeSection = (typeof README_SECTIONS)[keyof typeof README_SECTIONS];
export type HelpOptions = { section?: ReadmeSection };

const showMarkdownPreview = async (section?: string) => {
  const help = contextUtils.getEmbededFileUri('README.md').with({ fragment: section });
  await vscode.commands.executeCommand(VS_COMMANDS.MARKDOWN_SHOW_PREVIEW, help);
};

type maybeStatus = number | undefined;

export class HelpError extends Error implements UiError {
  readonly options: HelpOptions;

  readonly status: maybeStatus;

  constructor(message: string, options: HelpOptions = {}, status: maybeStatus = undefined) {
    super(message);
    this.options = options;
    this.status = status;
  }

  static isHelpError(object: unknown): object is HelpError {
    return object instanceof HelpError;
  }

  async showUi(): Promise<void> {
    const shouldShow = Boolean(await vscode.window.showErrorMessage(this.message, 'Show Help'));

    if (shouldShow) {
      await showMarkdownPreview(this.options.section);
    }
  }
}
