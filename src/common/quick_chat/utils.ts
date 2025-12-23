import vscode from 'vscode';
import { Actor, UnknownActorLogic } from 'xstate';
import { insertCodeSnippet } from '../chat/insert_code_snippet';
import { log } from '../log';
import {
  COMMAND_COPY_CODE_SNIPPET_FROM_QUICK_CHAT,
  COMMAND_INSERT_CODE_SNIPPET_FROM_QUICK_CHAT,
} from './constants';

export const COMMENT_CONTROLLER_ID = 'duo-quick-chat';

export const openAndShowDocument = async (uri: vscode.Uri) =>
  vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));

export const generateThreadLabel = (range: vscode.Range) => {
  const startLine = range.start.line + 1;
  const endLine = range.end.line + 1;
  const prefix = 'Duo Quick Chat';

  if (range.isEmpty) return `${prefix} (select some code to add context)`;
  if (startLine === endLine) return `${prefix} (include line ${startLine})`;
  return `${prefix} (include lines ${startLine}-${endLine})`;
};

export const provideCompletionItems = (
  document: vscode.TextDocument,
  position: vscode.Position,
) => {
  const linePrefix = document.lineAt(position).text.substring(0, position.character);
  if (linePrefix.trim() !== '/') return undefined;

  const actions = [
    ['tests', 'Write tests for the selected snippet.'],
    ['refactor', 'Refactor the selected snippet.'],
    ['explain', 'Explain the selected snippet.'],
    ['fix', 'Fix the selected code snippet.'],
    ['clear', 'Delete all messages in this conversation.'],
    ['reset', 'Reset conversation and ignore the previous messages.'],
  ];

  return actions.map(([label, detail]) => {
    const item = new vscode.CompletionItem(`/${label}`, vscode.CompletionItemKind.Text);
    item.detail = detail;
    item.insertText = label;
    return item;
  });
};

type MarkdownProcessor = (markdown: string) => string;

/**
 * class that wil hold a pipeline of markdown processors.
 * Each processor will be a function that takes a markdown string
 * and returns a modified markdown string.
 */
export class MarkdownProcessorPipeline {
  #processors: MarkdownProcessor[];

  constructor(processors: MarkdownProcessor[]) {
    this.#processors = processors ?? [];
  }

  addProcessor(processor: (markdown: string) => string): void {
    this.#processors.push(processor);
  }

  process(markdown: string): string {
    return this.#processors.reduce((result, processor) => processor(result), markdown);
  }
}

/**
 * Function to parse the markdown and add "Copy" buttons to code blocks.
 */
export const addCopyAndInsertButtonsToCodeBlocks: MarkdownProcessor = markdown => {
  // Regular expression to match code blocks in markdown (` ```language \n code... \n``` `)
  const codeBlockRegex = /^\s*```(\w+)?\s*$\n([\s\S]*?)\n^\s*```\s*$/gm;

  // Replace each code block with an appended copy button link
  const updatedMarkdown = markdown.replace(
    codeBlockRegex,
    (originalCode: string, language: string | undefined, codeContent: string) => {
      if (!codeContent) {
        return originalCode;
      }

      const languageIdentifier = language ?? '';

      const commandArgs = {
        code: codeContent,
      };

      const copyLink = `[**Copy Snippet**](command:${COMMAND_COPY_CODE_SNIPPET_FROM_QUICK_CHAT}?${encodeURIComponent(JSON.stringify(commandArgs))} "Click to copy this code snippet!")`;
      const insertLink = `[**Insert Snippet**](command:${COMMAND_INSERT_CODE_SNIPPET_FROM_QUICK_CHAT}?${encodeURIComponent(JSON.stringify(commandArgs))} "Click to insert this code snippet!")`;

      // Reconstruct the original code block and prepend the copy and insert links
      return `\n${copyLink} | ${insertLink}\n\`\`\`${languageIdentifier}\n${codeContent}\n\`\`\``;
    },
  );

  return updatedMarkdown;
};

export const insertQuickChatSnippetCommand: ({ code }: { code: string }) => void = async ({
  code,
}) => {
  if (code) {
    await insertCodeSnippet(code);
  }
};

/**
 * Creates a subscription to the state machine that only triggers when the state value changes
 * @param actorTitle name of the actor for logging
 * @param actor xState actor to subscribe to
 * @param callback optional callback to execute when state changes
 * @returns A function to unsubscribe
 */
export function subscribeToStateChanges({
  actorTitle,
  actor,
  callback,
}: {
  actorTitle: string;
  actor: Actor<UnknownActorLogic>;
  callback?: (snapshot: { value: unknown }) => void;
}) {
  let previousState = actor.getSnapshot().value;

  const subscription = actor.subscribe(snapshot => {
    if (previousState !== snapshot.value) {
      if (typeof previousState === 'string') {
        log.debug(`[${actorTitle}]: state changed from "${previousState}" to "${snapshot.value}"`);
      } else {
        // if actor is a parallel state machine, state is returned as an object
        const stateChangeLines: string[] = [];
        const allKeys = [
          ...new Set([...Object.keys(previousState), ...Object.keys(snapshot.value)]),
        ];
        allKeys.forEach(key => {
          const prevValue = previousState[key];
          const currentValue = snapshot.value[key];

          // Only show properties that changed
          if (prevValue !== currentValue) {
            stateChangeLines.push(`[${key}]: "${prevValue}" to "${currentValue}"`);
          }
        });
        if (stateChangeLines.length > 0) {
          const formattedChanges = stateChangeLines.join(',\n');
          log.debug(`[${actorTitle}]: State changes: ${formattedChanges}`);
        }
      }

      previousState = snapshot.value;

      callback?.(snapshot);
    }
  });

  // return a function to unsubscribe
  return () => {
    subscription.unsubscribe();
  };
}
