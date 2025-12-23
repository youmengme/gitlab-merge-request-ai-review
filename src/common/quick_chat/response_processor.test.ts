import vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { AiCompletionResponseMessageType } from '../api/graphql/ai_completion_response_channel';
import { QuickChatResponseProcessor } from './response_processor';
import { MarkdownProcessorPipeline } from './utils';

describe('QuickChatResponseProcessor', () => {
  let responseProcessor: QuickChatResponseProcessor;
  let markdownPipeline: MarkdownProcessorPipeline;
  beforeEach(() => {
    markdownPipeline = createFakePartial<MarkdownProcessorPipeline>({
      addProcessor: jest.fn(),
      process: jest.fn(),
    });
    responseProcessor = new QuickChatResponseProcessor(markdownPipeline);
  });

  it('handles full response', async () => {
    responseProcessor.init();
    const fullAiCompletionResponse = createFakePartial<AiCompletionResponseMessageType>({
      content: 'Full response',
    });

    responseProcessor.processUpdate(fullAiCompletionResponse);
    expect(markdownPipeline.process).toHaveBeenCalledWith('Full response');
  });

  it('handles chunked responses', async () => {
    const chunkedAiCompletionResponse = createFakePartial<AiCompletionResponseMessageType>({
      chunkId: 1,
      content: 'Chunk 1',
    });
    const mockAppendMarkdown = jest.fn();
    const mockMarkdown = {
      appendMarkdown: mockAppendMarkdown,
      value: '',
    };
    (vscode.MarkdownString as jest.Mock) = jest.fn(() => mockMarkdown);

    responseProcessor.init();

    responseProcessor.processUpdate(chunkedAiCompletionResponse);
    expect(mockAppendMarkdown).toHaveBeenCalledWith('Chunk 1');
  });
});
