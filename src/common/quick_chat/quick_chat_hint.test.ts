import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { getEnvInfo } from '../env';
import { QuickChatHint } from './quick_chat_hint';

const mockDecorationType = createFakePartial<vscode.TextEditorDecorationType>({
  dispose: jest.fn(),
});

// Helper function to create a fake document from a multiline string
function createFakeDocument(content: string, uri = 'file:///test/file.ts') {
  const lines = content.split('\n');
  return createFakePartial<vscode.TextDocument>({
    lineAt: jest.fn().mockImplementation((lineNumber: number) => {
      const line = lines[lineNumber] || '';
      return {
        text: line,
        trimEnd: () => line.trimEnd(),
      };
    }),
    uri: uri === 'file:///test/file.ts' ? vscode.Uri.file('test/file.ts') : vscode.Uri.parse(uri),
  });
}

jest.mock('../env');

describe('QuickChatHint', () => {
  let hint: QuickChatHint;
  let mockSelectionChangeEvent: vscode.TextEditorSelectionChangeEvent;
  let mockEditor: vscode.TextEditor;
  let documentContent: string;

  beforeEach(() => {
    documentContent = '';
    jest.mocked(getEnvInfo).mockReturnValueOnce({ isMacOS: false, isRemote: false });

    mockEditor = createFakePartial<vscode.TextEditor>({
      selection: createFakePartial<vscode.Selection>({ active: new vscode.Position(0, 0) }),
      get document() {
        return createFakeDocument(documentContent);
      },
      setDecorations: jest.fn(),
    });
    vscode.window.activeTextEditor = mockEditor;
    vscode.workspace.getConfiguration = jest
      .fn()
      .mockReturnValue({ keybindingHints: { enabled: true } });

    jest.mocked(vscode.window.createTextEditorDecorationType).mockReturnValue(mockDecorationType);
    hint = new QuickChatHint();
    mockSelectionChangeEvent = createFakePartial<vscode.TextEditorSelectionChangeEvent>({
      textEditor: mockEditor,
      selections: [{ isEmpty: true }],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it.each`
      isMacOS  | expectedContentText         | description
      ${false} | ${'(Alt+C) Duo Quick Chat'} | ${'non-macOS'}
      ${true}  | ${'⌥C Duo Quick Chat'}      | ${'macOS'}
    `('should create correct hint for $description', ({ isMacOS, expectedContentText }) => {
      jest.resetModules();
      jest.mocked(getEnvInfo).mockReturnValueOnce({ isMacOS, isRemote: false });
      hint = new QuickChatHint();

      expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalledWith({
        after: {
          contentText: expectedContentText,
          margin: '0 0 0 6ch',
          color: new vscode.ThemeColor('editorHint.foreground'),
          fontStyle: 'normal',
          textDecoration: 'none; filter: opacity(0.34);',
        },
      });
    });
  });

  describe('updateHint', () => {
    it('does not show hint when disabled', () => {
      vscode.workspace.getConfiguration = jest
        .fn()
        .mockReturnValueOnce({ keybindingHints: { enabled: false } });

      hint.onConfigChange();
      hint.updateHint(mockSelectionChangeEvent);

      expect(mockEditor.setDecorations).toHaveBeenCalledWith(mockDecorationType, []);
    });

    it('does not show hint when there is no selection (isEmpty)', () => {
      mockSelectionChangeEvent = createFakePartial<vscode.TextEditorSelectionChangeEvent>({
        textEditor: mockEditor,
        selections: [{ isEmpty: true }],
      });

      hint.updateHint(mockSelectionChangeEvent);

      expect(mockEditor.setDecorations).toHaveBeenCalledWith(mockDecorationType, []);
    });

    it('does not show hint for non-file documents', () => {
      mockEditor = createFakePartial<vscode.TextEditor>({
        document: createFakeDocument('content', 'output:test'), // Non-file URI
        setDecorations: jest.fn(),
      });

      mockSelectionChangeEvent = createFakePartial<vscode.TextEditorSelectionChangeEvent>({
        textEditor: mockEditor,
        selections: [{ isEmpty: false }],
      });

      hint.updateHint(mockSelectionChangeEvent);

      expect(mockEditor.setDecorations).toHaveBeenCalledWith(mockDecorationType, []);
    });

    it('shows hint when there is a text selection in a file document', () => {
      // Create document with content
      documentContent = ['line 0', 'some text content', 'line 2', 'line 3'].join('\n');

      // Create selection from line 1 to line 3
      const textSelection = createFakePartial<vscode.Selection>({
        isEmpty: false,
        start: new vscode.Position(1, 0),
        end: new vscode.Position(3, 10),
      });

      mockSelectionChangeEvent = createFakePartial<vscode.TextEditorSelectionChangeEvent>({
        textEditor: mockEditor,
        selections: [textSelection],
      });

      hint.updateHint(mockSelectionChangeEvent);

      // Expect decoration to be applied at the end of line 1 + offset
      const expectedPosition = new vscode.Position(1, 'some text content'.length);
      const expectedRange = new vscode.Range(expectedPosition, expectedPosition);

      expect(mockEditor.setDecorations).toHaveBeenCalledWith(mockDecorationType, [
        { range: expectedRange },
      ]);
    });

    it('handles empty lines in selection and places hint on first non-empty line', () => {
      // Create document with empty lines and content
      documentContent = ['line 0', '', '', 'content on line 3', 'line 4', 'line 5'].join('\n');

      // Create selection from line 1 to line 5
      const textSelection = createFakePartial<vscode.Selection>({
        isEmpty: false,
        start: new vscode.Position(1, 0),
        end: new vscode.Position(5, 5),
      });

      mockSelectionChangeEvent = createFakePartial<vscode.TextEditorSelectionChangeEvent>({
        textEditor: mockEditor,
        selections: [textSelection],
      });

      hint.updateHint(mockSelectionChangeEvent);

      // Expect decoration to be applied at the end of line 3 + offset
      const expectedPosition = new vscode.Position(3, 'content on line 3'.length);
      const expectedRange = new vscode.Range(expectedPosition, expectedPosition);

      expect(mockEditor.setDecorations).toHaveBeenCalledWith(mockDecorationType, [
        { range: expectedRange },
      ]);
    });

    it('does not show hint when selection contains only empty lines', () => {
      // Create document with only empty lines
      documentContent = ['line 0', '', '', '', 'line 4'].join('\n');

      // Create selection of only empty lines
      const textSelection = createFakePartial<vscode.Selection>({
        isEmpty: false,
        start: new vscode.Position(1, 0),
        end: new vscode.Position(3, 1),
      });

      mockSelectionChangeEvent = createFakePartial<vscode.TextEditorSelectionChangeEvent>({
        textEditor: mockEditor,
        selections: [textSelection],
      });

      hint.updateHint(mockSelectionChangeEvent);

      // Expect no decoration to be applied
      expect(mockEditor.setDecorations).toHaveBeenCalledWith(mockDecorationType, []);
    });
  });

  describe('dispose', () => {
    it('disposes hint decoration', () => {
      hint.dispose();
      expect(mockDecorationType.dispose).toHaveBeenCalled();
    });
  });
});
