import vscode from 'vscode';
import { AiCompletionResponseMessageType } from '../api/graphql/ai_completion_response_channel';
import {
  COMMAND_COPY_CODE_SNIPPET_FROM_QUICK_CHAT,
  COMMAND_INSERT_CODE_SNIPPET_FROM_QUICK_CHAT,
} from './constants';
import { MarkdownProcessorPipeline } from './utils';

export class QuickChatResponseProcessor {
  #response: vscode.MarkdownString = new vscode.MarkdownString('');

  #nextExpectedChunkId: number = 1;

  #chunkBuffer: { [id: number]: string | undefined } = {};

  #markdownPipeline: MarkdownProcessorPipeline;

  constructor(markdownPipeline: MarkdownProcessorPipeline) {
    this.#markdownPipeline = markdownPipeline;
  }

  init() {
    this.#nextExpectedChunkId = 1;
    this.#chunkBuffer = {};
    this.#response = new vscode.MarkdownString('');
  }

  getResponse(): vscode.MarkdownString {
    return this.#response;
  }

  processUpdate(data: AiCompletionResponseMessageType, completeCallback?: () => void) {
    if (data.chunkId) {
      this.#processChunk(data.chunkId, data.content);
    } else {
      this.#processFull(data.content);
      completeCallback?.();
    }
  }

  #processChunk(chunkId: number, content: string) {
    // Chunks may arrive out of order, so we buffer them and process in sequence
    this.#chunkBuffer[chunkId] = content;
    const chunkContent = this.#chunkBuffer[this.#nextExpectedChunkId];
    if (!this.#response || !chunkContent) return;

    this.#response.appendMarkdown(chunkContent);
    this.#chunkBuffer[this.#nextExpectedChunkId] = undefined;
    this.#nextExpectedChunkId++;
  }

  #processFull(content: string) {
    if (!this.#response) return;

    this.#response.isTrusted = {
      enabledCommands: [
        COMMAND_COPY_CODE_SNIPPET_FROM_QUICK_CHAT,
        COMMAND_INSERT_CODE_SNIPPET_FROM_QUICK_CHAT,
      ],
    };
    this.#response.value = this.#markdownPipeline.process(content);
  }
}
