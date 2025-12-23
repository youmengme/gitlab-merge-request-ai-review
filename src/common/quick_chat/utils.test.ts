import vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import * as InsertCodeSnippetModule from '../chat/insert_code_snippet';
import {
  openAndShowDocument,
  generateThreadLabel,
  provideCompletionItems,
  addCopyAndInsertButtonsToCodeBlocks,
  MarkdownProcessorPipeline,
  insertQuickChatSnippetCommand,
} from './utils';
import {
  COMMAND_COPY_CODE_SNIPPET_FROM_QUICK_CHAT,
  COMMAND_INSERT_CODE_SNIPPET_FROM_QUICK_CHAT,
} from './constants';

jest.mock('../chat/insert_code_snippet');

describe('Quick Chat Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('openAndShowDocument', () => {
    it('opens and show sthe document', async () => {
      const uri = vscode.Uri.file('test/path/to/file.txt');
      const mockEditor = createFakePartial<vscode.TextEditor>({ selection: undefined });

      (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue('mockDocument');
      (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(mockEditor);

      await openAndShowDocument(uri);

      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(uri);
      expect(vscode.window.showTextDocument).toHaveBeenCalledWith('mockDocument');
    });
  });

  describe('generatePlaceholderPrompt', () => {
    it('returns correct prompt for empty range', () => {
      const emptyRange = new vscode.Range(0, 0, 0, 0);

      expect(generateThreadLabel(emptyRange)).toBe(
        'Duo Quick Chat (select some code to add context)',
      );
    });

    it('returns correct prompt for single line range', () => {
      const singleLineRange = new vscode.Range(5, 0, 5, 10);
      expect(generateThreadLabel(singleLineRange)).toBe('Duo Quick Chat (include line 6)');
    });

    it('returns correct prompt for multi-line range', () => {
      const multiLineRange = new vscode.Range(10, 0, 15, 5);
      expect(generateThreadLabel(multiLineRange)).toBe('Duo Quick Chat (include lines 11-16)');
    });
  });

  describe('provideCompletionItems', () => {
    const mockPosition = createFakePartial<vscode.Position>({ character: 1 });
    const mockDocument = (text: string) =>
      createFakePartial<vscode.TextDocument>({
        lineAt: jest.fn().mockReturnValue({ text }),
      });

    it('should return undefined if line does not start with "/"', () => {
      const result = provideCompletionItems(mockDocument('some text'), mockPosition);

      expect(result).toBeUndefined();
    });

    it('should return completion items if line starts with "/"', () => {
      const result = provideCompletionItems(mockDocument('/'), mockPosition);
      const kind = vscode.CompletionItemKind.Text;

      const expectedActions = [
        {
          label: '/tests',
          insertText: 'tests',
          detail: 'Write tests for the selected snippet.',
          kind,
        },
        {
          label: '/refactor',
          insertText: 'refactor',
          detail: 'Refactor the selected snippet.',
          kind,
        },
        {
          label: '/explain',
          insertText: 'explain',
          detail: 'Explain the selected snippet.',
          kind,
        },
        {
          label: '/fix',
          insertText: 'fix',
          detail: 'Fix the selected code snippet.',
          kind,
        },
        {
          label: '/clear',
          insertText: 'clear',
          detail: 'Delete all messages in this conversation.',
          kind,
        },
        {
          label: '/reset',
          insertText: 'reset',
          detail: 'Reset conversation and ignore the previous messages.',
          kind,
        },
      ];

      expect(result).toEqual(expectedActions);
    });
  });

  describe('addCopyAndInsertButtonsToCodeBlocks', () => {
    it(`adds copy and insert buttons to code blocks`, () => {
      const markdown = '```javascript\nconst x = 1;\n```';
      const result = addCopyAndInsertButtonsToCodeBlocks(markdown);
      expect(result).toContain('```javascript\nconst x = 1;\n```');
      expect(result).toContain(
        `[**Copy Snippet**](command:${COMMAND_COPY_CODE_SNIPPET_FROM_QUICK_CHAT}?`,
      );
      expect(result).toContain(
        `[**Insert Snippet**](command:${COMMAND_INSERT_CODE_SNIPPET_FROM_QUICK_CHAT}?`,
      );
    });

    it('handles multiple code blocks', () => {
      const markdown = '```python\nprint("Hello")\n```\nSome text\n```ruby\nputs "World"\n```';
      const result = addCopyAndInsertButtonsToCodeBlocks(markdown);
      expect(result).toContain('```python\nprint("Hello")\n```');
      expect(result).toContain('```ruby\nputs "World"\n```');
      expect(result.match(/\[\*\*Copy Snippet\*\*\]/g)).toHaveLength(2);
      expect(result.match(/\[\*\*Insert Snippet\*\*\]/g)).toHaveLength(2);
    });

    it('preserves non-code block content', () => {
      const markdown = 'Some text\n```css\nbody { color: red; }\n```\nMore text';
      const result = addCopyAndInsertButtonsToCodeBlocks(markdown);
      expect(result).toContain('Some text');
      expect(result).toContain('```css\nbody { color: red; }\n```');
      expect(result).toContain('More text');
      expect(result).toContain(
        `[**Copy Snippet**](command:${COMMAND_COPY_CODE_SNIPPET_FROM_QUICK_CHAT}?`,
      );
      expect(result).toContain(
        `[**Insert Snippet**](command:${COMMAND_INSERT_CODE_SNIPPET_FROM_QUICK_CHAT}?`,
      );
    });

    it('handles code blocks without language specification', () => {
      const markdown = '```\nconst y = 2;\n```';
      const result = addCopyAndInsertButtonsToCodeBlocks(markdown);
      expect(result).toContain('```\nconst y = 2;\n```');
      expect(result).toContain(
        `[**Copy Snippet**](command:${COMMAND_COPY_CODE_SNIPPET_FROM_QUICK_CHAT}?`,
      );
      expect(result).toContain(
        `[**Insert Snippet**](command:${COMMAND_INSERT_CODE_SNIPPET_FROM_QUICK_CHAT}?`,
      );
    });

    it('encodes command arguments correctly', () => {
      const markdown = '```json\n{"key": "value"}\n```';
      const result = addCopyAndInsertButtonsToCodeBlocks(markdown);
      const encodedArgs = encodeURIComponent(JSON.stringify({ code: '{"key": "value"}' }));
      expect(result).toContain(
        `command:${COMMAND_COPY_CODE_SNIPPET_FROM_QUICK_CHAT}?${encodedArgs}`,
      );
      expect(result).toContain(
        `command:${COMMAND_INSERT_CODE_SNIPPET_FROM_QUICK_CHAT}?${encodedArgs}`,
      );
    });
  });

  describe('MarkdownProcessorPipeline', () => {
    let pipeline: MarkdownProcessorPipeline;

    beforeEach(() => {
      pipeline = new MarkdownProcessorPipeline([]);
    });

    it('should process markdown through all processors', () => {
      const processor1 = jest.fn((md: string) => `${md} processed 1`);
      const processor2 = jest.fn((md: string) => `${md} processed 2`);
      pipeline.addProcessor(processor1);
      pipeline.addProcessor(processor2);

      const result = pipeline.process('test');

      expect(processor1).toHaveBeenCalledWith('test');
      expect(processor2).toHaveBeenCalledWith('test processed 1');
      expect(result).toBe('test processed 1 processed 2');
    });

    it('should return the original markdown if no processors are added', () => {
      const result = pipeline.process('test');
      expect(result).toBe('test');
    });

    it('should allow adding processors after initialization', () => {
      const processor = jest.fn((md: string) => `${md} processed 3`);
      pipeline.addProcessor(processor);

      const result = pipeline.process('test');

      expect(processor).toHaveBeenCalledWith('test');
      expect(result).toBe('test processed 3');
    });
  });

  describe('insertQuickChatSnippetCommand', () => {
    const mockEditor = createFakePartial<vscode.TextEditor>({
      insertSnippet: jest.fn(),
    });
    const code = 'const x = 1;';

    beforeEach(() => {
      vscode.window.activeTextEditor = mockEditor;
    });

    it('inserts the code snippet when an active editor is present', async () => {
      await insertQuickChatSnippetCommand({ code });
      expect(InsertCodeSnippetModule.insertCodeSnippet).toHaveBeenCalledWith(code);
    });

    it('does nothing when an invalid code is passed', async () => {
      await insertQuickChatSnippetCommand({ code: '' });

      expect(mockEditor.insertSnippet).not.toHaveBeenCalled();
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });
  });
});
