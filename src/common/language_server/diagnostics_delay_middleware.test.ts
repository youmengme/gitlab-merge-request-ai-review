import {
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResult,
  TextDocumentEdit,
  WorkspaceEdit,
} from 'vscode-languageclient';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { DiagnosticsDelayMiddleware } from './diagnostics_delay_middleware';
import { waitForDiagnosticsUpdate } from './wait_for_diagnostics';

jest.mock('./wait_for_diagnostics');

describe('DiagnosticsDelayMiddleware', () => {
  let middleware: DiagnosticsDelayMiddleware;
  let mockNext: jest.MockedFunction<
    (params: ApplyWorkspaceEditParams) => Promise<ApplyWorkspaceEditResult>
  >;
  let mockWaitForDiagnosticsUpdate: jest.MockedFunction<typeof waitForDiagnosticsUpdate>;

  const testUri = 'file:///test.ts';

  let successResult: ApplyWorkspaceEditResult;
  let failureResult: ApplyWorkspaceEditResult;

  beforeEach(() => {
    middleware = new DiagnosticsDelayMiddleware();
    mockNext = jest.fn();
    mockWaitForDiagnosticsUpdate = jest.mocked(waitForDiagnosticsUpdate);
    mockWaitForDiagnosticsUpdate.mockResolvedValue();

    successResult = createFakePartial<ApplyWorkspaceEditResult>({ applied: true });
    failureResult = createFakePartial<ApplyWorkspaceEditResult>({ applied: false });
  });

  describe('when workspace edit has no document changes', () => {
    it('should call next without waiting for diagnostics', async () => {
      const params = createFakePartial<ApplyWorkspaceEditParams>({
        edit: createFakePartial<WorkspaceEdit>({}),
      });

      mockNext.mockResolvedValue(successResult);

      const result = await middleware.process(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockWaitForDiagnosticsUpdate).not.toHaveBeenCalled();
      expect(result).toBe(successResult);
    });

    it('should call next without waiting when documentChanges is undefined', async () => {
      const params = createFakePartial<ApplyWorkspaceEditParams>({
        edit: createFakePartial<WorkspaceEdit>({
          documentChanges: undefined,
        }),
      });

      mockNext.mockResolvedValue(successResult);

      const result = await middleware.process(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockWaitForDiagnosticsUpdate).not.toHaveBeenCalled();
      expect(result).toBe(successResult);
    });

    it('should call next without waiting when documentChanges is empty array', async () => {
      const params = createFakePartial<ApplyWorkspaceEditParams>({
        edit: createFakePartial<WorkspaceEdit>({
          documentChanges: [],
        }),
      });

      mockNext.mockResolvedValue(successResult);

      const result = await middleware.process(params, mockNext);

      expect(mockNext).toHaveBeenCalledWith(params);
      expect(mockWaitForDiagnosticsUpdate).not.toHaveBeenCalled();
      expect(result).toBe(successResult);
    });
  });

  describe('when workspace edit has document changes', () => {
    describe('with single text document edit', () => {
      it('should wait for diagnostics when edit is applied successfully', async () => {
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: createFakePartial<WorkspaceEdit>({
            documentChanges: [
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri: testUri },
                edits: [{ range: {}, newText: 'new content' }],
              }),
            ],
          }),
        });

        mockNext.mockResolvedValue(successResult);

        const result = await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);
        expect(mockWaitForDiagnosticsUpdate).toHaveBeenCalledWith([testUri]);
        expect(result).toBe(successResult);
      });

      it('should not wait for diagnostics when edit is not applied', async () => {
        jest.useFakeTimers();

        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: createFakePartial<WorkspaceEdit>({
            documentChanges: [
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri: testUri },
                edits: [{ range: {}, newText: 'new content' }],
              }),
            ],
          }),
        });

        mockNext.mockResolvedValue(failureResult);

        // Create a promise that resolves after a timeout with a flag
        let promiseResolved = false;
        const delayedPromise = new Promise<void>(resolve => {
          setTimeout(() => {
            promiseResolved = true;
            resolve();
          }, 100);
        });
        mockWaitForDiagnosticsUpdate.mockReturnValue(delayedPromise);

        const result = await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);
        expect(mockWaitForDiagnosticsUpdate).toHaveBeenCalledWith([testUri]);
        expect(result).toBe(failureResult);

        expect(promiseResolved).toBe(false);

        jest.useRealTimers();
      });

      it('should not wait for diagnostics when text document edit has no edits', async () => {
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: createFakePartial<WorkspaceEdit>({
            documentChanges: [
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri: testUri },
                edits: [],
              }),
            ],
          }),
        });

        mockNext.mockResolvedValue(successResult);

        const result = await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);
        expect(mockWaitForDiagnosticsUpdate).not.toHaveBeenCalled();
        expect(result).toBe(successResult);
      });

      it('should not wait for diagnostics when text document edit has undefined edits', async () => {
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: createFakePartial<WorkspaceEdit>({
            documentChanges: [
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri: testUri },
                edits: undefined,
              }),
            ],
          }),
        });

        mockNext.mockResolvedValue(successResult);

        const result = await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);
        expect(mockWaitForDiagnosticsUpdate).not.toHaveBeenCalled();
        expect(result).toBe(successResult);
      });
    });

    describe('with multiple text document edits', () => {
      const testUri1 = 'file:///test1.ts';
      const testUri2 = 'file:///test2.ts';
      const testUri3 = 'file:///test3.ts';
      const otherUri = 'file:///other.ts';

      it('should wait for diagnostics for all edited files', async () => {
        const testUris = [testUri1, testUri2, testUri3];
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: createFakePartial<WorkspaceEdit>({
            documentChanges: testUris.map(uri =>
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri },
                edits: [{ range: {}, newText: 'new content' }],
              }),
            ),
          }),
        });

        mockNext.mockResolvedValue(successResult);

        const result = await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);
        expect(mockWaitForDiagnosticsUpdate).toHaveBeenCalledWith(testUris);
        expect(result).toBe(successResult);
      });

      it('should only wait for files that have edits', async () => {
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: createFakePartial<WorkspaceEdit>({
            documentChanges: [
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri: testUri1 },
                edits: [{ range: {}, newText: 'new content' }],
              }),
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri: testUri2 },
                edits: [], // No edits
              }),
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri: testUri3 },
                edits: [{ range: {}, newText: 'another content' }],
              }),
            ],
          }),
        });

        mockNext.mockResolvedValue(successResult);

        const result = await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);
        expect(mockWaitForDiagnosticsUpdate).toHaveBeenCalledWith([testUri1, testUri3]);
        expect(result).toBe(successResult);
      });

      it('should handle duplicate URIs in document changes', async () => {
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: createFakePartial<WorkspaceEdit>({
            documentChanges: [
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri: testUri },
                edits: [{ range: {}, newText: 'content 1' }],
              }),
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri: testUri },
                edits: [{ range: {}, newText: 'content 2' }],
              }),
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri: otherUri },
                edits: [{ range: {}, newText: 'other content' }],
              }),
            ],
          }),
        });

        mockNext.mockResolvedValue(successResult);

        const result = await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);
        expect(mockWaitForDiagnosticsUpdate).toHaveBeenCalledWith([testUri, testUri, otherUri]);
        expect(result).toBe(successResult);
      });
    });

    describe('with mixed document change types', () => {
      const anotherUri = 'file:///another.ts';

      it('should only extract URIs from text document edits', async () => {
        const params = createFakePartial<ApplyWorkspaceEditParams>({
          edit: createFakePartial<WorkspaceEdit>({
            documentChanges: [
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri: testUri },
                edits: [{ range: {}, newText: 'new content' }],
              }),
              // Non-TextDocumentEdit change (e.g., CreateFile, RenameFile, DeleteFile)
              {
                kind: 'create',
                uri: 'file:///new-file.ts',
              },
              createFakePartial<TextDocumentEdit>({
                textDocument: { uri: anotherUri },
                edits: [{ range: {}, newText: 'another content' }],
              }),
            ],
          }),
        });

        mockNext.mockResolvedValue(successResult);

        const result = await middleware.process(params, mockNext);

        expect(mockNext).toHaveBeenCalledWith(params);
        expect(mockWaitForDiagnosticsUpdate).toHaveBeenCalledWith([testUri, anotherUri]);
        expect(result).toBe(successResult);
      });
    });
  });
});
