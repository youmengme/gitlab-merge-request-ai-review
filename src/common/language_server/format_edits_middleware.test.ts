import * as vscode from 'vscode';
import { ApplyWorkspaceEditParams, ApplyWorkspaceEditResult } from 'vscode-languageclient';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { getLocalFeatureFlagService } from '../feature_flags/local_feature_flag_service';
import { FormatEditsMiddleware } from './format_edits_middleware';

jest.mock('../log');
jest.mock('../feature_flags/local_feature_flag_service');

describe('FormatEditsMiddleware', () => {
  let middleware: FormatEditsMiddleware;
  let mockNext: jest.Mock;
  let mockEditor: vscode.TextEditor;
  let mockDocument: vscode.TextDocument;
  let defaultParams: ApplyWorkspaceEditParams;

  const mockUri = vscode.Uri.parse('file:///test/file.ts');
  const mockSelection = new vscode.Selection(5, 10, 5, 10);

  beforeEach(() => {
    mockDocument = createFakePartial<vscode.TextDocument>({
      uri: mockUri,
    });

    let currentSelection = mockSelection;
    mockEditor = createFakePartial<vscode.TextEditor>({
      document: mockDocument,
      get selection() {
        return currentSelection;
      },
      set selection(value) {
        currentSelection = value;
      },
    });

    vscode.workspace.openTextDocument = jest.fn().mockResolvedValue(mockDocument);
    vscode.window.showTextDocument = jest.fn().mockResolvedValue(mockEditor);
    vscode.commands.executeCommand = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(vscode.window, 'visibleTextEditors', {
      value: [],
      configurable: true,
    });

    middleware = new FormatEditsMiddleware();

    mockNext = jest.fn().mockResolvedValue(
      createFakePartial<ApplyWorkspaceEditResult>({
        applied: true,
      }),
    );

    defaultParams = createFakePartial<ApplyWorkspaceEditParams>({
      edit: {
        documentChanges: [
          {
            textDocument: { uri: mockUri.toString(), version: 1 },
            edits: [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 3, character: 5 } },
                newText: 'formatted content',
              },
            ],
          },
        ],
      },
    });
  });

  describe('when the feature flag is disabled', () => {
    beforeEach(() => {
      jest.mocked(getLocalFeatureFlagService).mockReturnValue(
        createFakePartial({
          isEnabled: jest.fn().mockReturnValue(false),
        }),
      );
    });

    it('should not format edits', async () => {
      const result = await middleware.process(defaultParams, mockNext);

      expect(mockNext).toHaveBeenCalledWith(defaultParams);
      expect(result).toEqual({ applied: true });

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('when the feature flag is enabled', () => {
    beforeEach(() => {
      jest.mocked(getLocalFeatureFlagService).mockReturnValue(
        createFakePartial({
          isEnabled: jest.fn().mockReturnValue(true),
        }),
      );
    });

    describe('when edit is successfully applied', () => {
      let selectionBeforeFormat: vscode.Selection | null = null;

      beforeEach(() => {
        const originalExecuteCommand = vscode.commands.executeCommand;
        vscode.commands.executeCommand = jest.fn().mockImplementation(command => {
          if (command === 'editor.action.formatSelection') {
            selectionBeforeFormat = mockEditor.selection;
          }
          return originalExecuteCommand(command);
        });
      });

      it('should format edited ranges', async () => {
        const result = await middleware.process(defaultParams, mockNext);

        expect(mockNext).toHaveBeenCalledWith(defaultParams);

        expect(result).toEqual({ applied: true });

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
          'editor.action.formatSelection',
        );
      });

      it('should handle multiple edits in the same document', async () => {
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: {
            documentChanges: [
              {
                textDocument: { uri: mockUri.toString(), version: 1 },
                edits: [
                  {
                    range: { start: { line: 0, character: 0 }, end: { line: 3, character: 5 } },
                    newText: 'formatted content',
                  },
                ],
              },
            ],
          },
        });

        const result = await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);

        expect(result).toEqual({ applied: true });

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
          'editor.action.formatSelection',
        );
      });

      it('should format inserted text with zero-width range (insertion)', async () => {
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: {
            documentChanges: [
              {
                textDocument: { uri: mockUri.toString(), version: 1 },
                edits: [
                  {
                    // Zero-width range - this is an insertion, not a replacement
                    range: { start: { line: 0, character: 5 }, end: { line: 0, character: 5 } },
                    newText: ' Beautiful',
                  },
                ],
              },
            ],
          },
        });

        await middleware.process(params, mockNext);

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
          'editor.action.formatSelection',
        );

        expect(selectionBeforeFormat).not.toBeNull();
        expect(selectionBeforeFormat!.start.line).toBe(0);
        expect(selectionBeforeFormat!.start.character).toBe(5);
        expect(selectionBeforeFormat!.end.line).toBe(0);
        expect(selectionBeforeFormat!.end.character).toBe(15); // 5 + 10 characters in " Beautiful"
      });

      it('should format multi-line inserted text with zero-width range', async () => {
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: {
            documentChanges: [
              {
                textDocument: { uri: mockUri.toString(), version: 1 },
                edits: [
                  {
                    // Zero-width range - this is an insertion, not a replacement
                    range: { start: { line: 2, character: 10 }, end: { line: 2, character: 10 } },
                    newText: 'function hello() {\n  console.log("world");\n}',
                  },
                ],
              },
            ],
          },
        });

        await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
          'editor.action.formatSelection',
        );

        // Verify the selection covered the inserted multi-line text before formatting
        expect(selectionBeforeFormat).not.toBeNull();
        expect(selectionBeforeFormat!.start.line).toBe(2);
        expect(selectionBeforeFormat!.start.character).toBe(10);
        expect(selectionBeforeFormat!.end.line).toBe(4); // 2 + 2 newlines
        expect(selectionBeforeFormat!.end.character).toBe(1); // Length of final "}"
      });

      it('should handle edits across multiple documents', async () => {
        const mockUri2 = vscode.Uri.parse('file:///test/file2.ts');
        const mockDocument2 = createFakePartial<vscode.TextDocument>({
          uri: mockUri2,
        });
        const currentSelection2 = new vscode.Selection(0, 0, 0, 0);
        const mockEditor2 = createFakePartial<vscode.TextEditor>({
          document: mockDocument2,
          selection: currentSelection2,
        });

        vscode.workspace.openTextDocument = jest
          .fn()
          .mockResolvedValueOnce(mockDocument)
          .mockResolvedValueOnce(mockDocument2);
        vscode.window.showTextDocument = jest
          .fn()
          .mockResolvedValueOnce(mockEditor)
          .mockResolvedValueOnce(mockEditor2);

        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: {
            documentChanges: [
              {
                textDocument: { uri: mockUri.toString(), version: 1 },
                edits: [
                  {
                    range: { start: { line: 0, character: 0 }, end: { line: 3, character: 5 } },
                    newText: 'edit1',
                  },
                ],
              },
              {
                textDocument: { uri: mockUri2.toString(), version: 1 },
                edits: [
                  {
                    range: { start: { line: 5, character: 0 }, end: { line: 7, character: 0 } },
                    newText: 'edit2',
                  },
                ],
              },
            ],
          },
        });

        await middleware.process(params, mockNext);

        expect(vscode.workspace.openTextDocument).toHaveBeenCalledTimes(2);
        expect(vscode.window.showTextDocument).toHaveBeenCalledTimes(2);
        expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(2);
      });

      it('should preserve existing user selection when document was already open', async () => {
        const existingSelection = new vscode.Selection(10, 5, 10, 15);
        const existingEditor = createFakePartial<vscode.TextEditor>({
          document: createFakePartial<vscode.TextDocument>({
            uri: mockUri,
          }),
          selection: existingSelection,
        });

        Object.defineProperty(vscode.window, 'visibleTextEditors', {
          value: [existingEditor],
          configurable: true,
        });

        await middleware.process(defaultParams, mockNext);

        expect(mockEditor.selection.start.line).toBe(10);
        expect(mockEditor.selection.start.character).toBe(5);
        expect(mockEditor.selection.end.line).toBe(10);
        expect(mockEditor.selection.end.character).toBe(15);
      });

      it('should continue processing even if formatting one range fails', async () => {
        vscode.commands.executeCommand = jest
          .fn()
          .mockRejectedValueOnce(new Error('Format failed'))
          .mockResolvedValueOnce(undefined);

        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: {
            documentChanges: [
              {
                textDocument: { uri: mockUri.toString(), version: 1 },
                edits: [
                  {
                    range: { start: { line: 0, character: 0 }, end: { line: 3, character: 5 } },
                    newText: 'edit1',
                  },
                  {
                    range: { start: { line: 10, character: 0 }, end: { line: 12, character: 0 } },
                    newText: 'edit2',
                  },
                ],
              },
            ],
          },
        });

        await middleware.process(params, mockNext);

        expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(2);
      });

      it('should process edits in reverse document order', async () => {
        const formatSelectionCalls: vscode.Selection[] = [];
        vscode.commands.executeCommand = jest.fn().mockImplementation(command => {
          if (command === 'editor.action.formatSelection') {
            formatSelectionCalls.push(mockEditor.selection);
          }
        });

        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: {
            documentChanges: [
              {
                textDocument: { uri: mockUri.toString(), version: 1 },
                edits: [
                  {
                    range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } },
                    newText: 'first edit',
                  },
                  {
                    range: { start: { line: 10, character: 5 }, end: { line: 10, character: 15 } },
                    newText: 'second edit',
                  },
                  {
                    range: { start: { line: 10, character: 0 }, end: { line: 10, character: 5 } },
                    newText: 'third edit',
                  },
                ],
              },
            ],
          },
        });

        await middleware.process(params, mockNext);

        expect(formatSelectionCalls).toHaveLength(3);
        // Should process in reverse order: line 10 char 5, then line 10 char 0, then line 5 char 0
        expect(formatSelectionCalls[0].start.line).toBe(10);
        expect(formatSelectionCalls[0].start.character).toBe(5);
        expect(formatSelectionCalls[1].start.line).toBe(10);
        expect(formatSelectionCalls[1].start.character).toBe(0);
        expect(formatSelectionCalls[2].start.line).toBe(5);
        expect(formatSelectionCalls[2].start.character).toBe(0);
      });
    });

    describe('when edit is not applied', () => {
      it('should not format anything', async () => {
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: {
            documentChanges: [
              {
                textDocument: { uri: mockUri.toString(), version: 1 },
                edits: [
                  {
                    range: { start: { line: 0, character: 0 }, end: { line: 3, character: 5 } },
                    newText: 'formatted content',
                  },
                ],
              },
            ],
          },
        });
        mockNext.mockResolvedValue(
          createFakePartial<ApplyWorkspaceEditResult>({
            applied: false,
          }),
        );

        await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);

        expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
        expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should handle workspace edit without documentChanges', async () => {
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: {},
        });

        await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
      });

      it('should handle empty edits array', async () => {
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: {
            documentChanges: [
              {
                textDocument: { uri: mockUri.toString(), version: 1 },
                edits: [],
              },
            ],
          },
        });

        await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
      });
    });
  });
});
