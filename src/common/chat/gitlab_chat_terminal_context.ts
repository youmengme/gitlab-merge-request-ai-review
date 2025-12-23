import { v4 as uuidv4 } from 'uuid';
import type { AIContextItem, AIContextItemMetadata } from '@gitlab-org/gitlab-lsp';
import vscode from 'vscode';
import { log } from '../log';

export const CLIPBOARD_RESET_PLACEHOLDER =
  'GitLab VSCode Workflow extension has temporarily reset the clipboard to read terminal selection';

export interface TerminalAIContextItem extends AIContextItem {
  category: 'terminal';
  id: string;
  content: string;
  metadata: AIContextItemMetadata;
}
interface TerminalContentResult {
  readonly content: string;
  readonly source: 'selection' | 'lastCommand';
}

/**
 * Creates a standardized terminal AI context item from terminal content.
 */
function createTerminalContextItem(result: TerminalContentResult): TerminalAIContextItem {
  const metadata = getContextMetadata(result);

  return {
    id: uuidv4(),
    category: 'terminal',
    content: result.content,
    metadata: {
      enabled: true,
      subType: 'snippet',
      icon: 'terminal',
      ...metadata,
    },
  } satisfies TerminalAIContextItem;
}

/**
 * Generates appropriate metadata based on the content source and type.
 */
function getContextMetadata(result: TerminalContentResult) {
  switch (result.source) {
    case 'selection':
      return {
        subTypeLabel: 'Selected terminal output',
        title: `Selected command:`,
        secondaryText: ``,
      };
    case 'lastCommand':
      return {
        subTypeLabel: 'Last terminal command',
        title: `Last command:`,
        secondaryText: ``,
      };
    default:
      // This should never be reached due to TypeScript exhaustiveness checking
      throw new Error(
        `Terminal selection failed to grab selected terminal or default to last command`,
      );
  }
}

export async function getTerminalAIContext(): Promise<TerminalAIContextItem | undefined> {
  const originalContent = await vscode.env.clipboard.readText();
  const result = await extractTerminalContent();
  await restoreClipboard(originalContent);
  return result ? createTerminalContextItem(result) : undefined;
}

async function extractTerminalContent(): Promise<TerminalContentResult | undefined> {
  await vscode.env.clipboard.writeText(CLIPBOARD_RESET_PLACEHOLDER);

  await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
  let content = await vscode.env.clipboard.readText();

  if (isValidClipboardResult(content)) {
    return { content, source: 'selection' };
  }

  await vscode.commands.executeCommand(
    'workbench.action.terminal.copyLastCommandAndLastCommandOutput',
  );
  content = await vscode.env.clipboard.readText();
  // Checks if the last command is `clear` to avoid providing useless results.
  if (isValidClipboardResult(content) && !content.startsWith('clear')) {
    return { content, source: 'lastCommand' };
  }

  return undefined;
}

/**
 * Restores the original clipboard content with error handling.
 */
async function restoreClipboard(originalContent: string): Promise<void> {
  try {
    await vscode.env.clipboard.writeText(originalContent);
  } catch (error) {
    log.debug('Failed to restore clipboard content:', error);
  }
}

/**
 * Validates clipboard result to ensure it contains actual terminal content.
 */
function isValidClipboardResult(content: string): boolean {
  return Boolean(content && content !== CLIPBOARD_RESET_PLACEHOLDER);
}
