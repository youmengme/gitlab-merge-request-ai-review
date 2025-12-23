import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { DocumentQualityHandler } from './document_quality_handler';
import { waitForDiagnosticsUpdate } from './wait_for_diagnostics';

jest.mock('./wait_for_diagnostics');

describe('DocumentQualityHandler', () => {
  let documentQualityHandler: DocumentQualityHandler;
  let mockDidChangeDiagnosticsDisposable: vscode.Disposable;
  let mockDocumentCloseDisposable: vscode.Disposable;
  let mockOnDidChangeDiagnosticsCallbacks: Array<(event: vscode.DiagnosticChangeEvent) => void>;
  let mockOnDidCloseTextDocumentCallback: (document: vscode.TextDocument) => void;
  let mockWaitForDiagnosticsUpdate: jest.MockedFunction<typeof waitForDiagnosticsUpdate>;
  let mockGetDiagnostics: jest.Mock;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const fireDiagnosticsChangeEvent = (event: vscode.DiagnosticChangeEvent) => {
    mockOnDidChangeDiagnosticsCallbacks.forEach(callback => callback(event));
  };

  beforeEach(() => {
    mockDidChangeDiagnosticsDisposable = { dispose: jest.fn() };
    mockDocumentCloseDisposable = { dispose: jest.fn() };
    mockOnDidChangeDiagnosticsCallbacks = [];
    mockWaitForDiagnosticsUpdate = jest.mocked(waitForDiagnosticsUpdate);
    mockWaitForDiagnosticsUpdate.mockResolvedValue();

    mockGetDiagnostics = jest.fn();
    vscode.languages.getDiagnostics = mockGetDiagnostics;

    jest.mocked(vscode.languages.onDidChangeDiagnostics).mockImplementation(callback => {
      mockOnDidChangeDiagnosticsCallbacks.push(callback);
      return mockDidChangeDiagnosticsDisposable;
    });

    jest.mocked(vscode.workspace.onDidCloseTextDocument).mockImplementation(callback => {
      mockOnDidCloseTextDocumentCallback = callback;
      return mockDocumentCloseDisposable;
    });

    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [],
      writable: true,
    });

    vscode.Uri.parse = jest
      .fn()
      .mockImplementation(uri => createFakePartial<vscode.Uri>({ toString: () => uri }));
    jest.mocked(vscode.workspace.openTextDocument).mockResolvedValue(
      createFakePartial<vscode.TextDocument>({
        uri: createFakePartial<vscode.Uri>({ toString: () => 'file:///test.ts' }),
      }),
    );
    jest
      .mocked(vscode.window.showTextDocument)
      .mockResolvedValue(createFakePartial<vscode.TextEditor>({}));
    vscode.window.activeTextEditor = undefined;
  });

  afterEach(() => {
    documentQualityHandler?.dispose();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with empty cache', () => {
      documentQualityHandler = new DocumentQualityHandler();

      expect(vscode.languages.onDidChangeDiagnostics).toHaveBeenCalledWith(expect.any(Function));
      expect(vscode.workspace.onDidCloseTextDocument).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should set up event listeners correctly', () => {
      documentQualityHandler = new DocumentQualityHandler();

      expect(vscode.languages.onDidChangeDiagnostics).toHaveBeenCalledTimes(1);
      expect(vscode.workspace.onDidCloseTextDocument).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDiagnostics', () => {
    const fileUri = 'file:///path/to/file.ts';
    const mockDiagnostics = [
      createFakePartial<vscode.Diagnostic>({
        message: 'Test diagnostic',
        range: new vscode.Range(0, 0, 0, 10),
        severity: vscode.DiagnosticSeverity.Error,
      }),
    ];

    beforeEach(() => {
      documentQualityHandler = new DocumentQualityHandler();
    });

    describe('when diagnostics are cached', () => {
      beforeEach(() => {
        mockGetDiagnostics.mockReturnValue(mockDiagnostics);

        fireDiagnosticsChangeEvent({
          uris: [vscode.Uri.file('/path/to/file.ts')],
        });
      });

      it('should return cached diagnostics', async () => {
        const result = await documentQualityHandler.getDiagnostics({ fileUri });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          message: 'Test diagnostic',
          severity: 1,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
        });
      });
    });

    describe('when diagnostics are not cached', () => {
      const mockUri = vscode.Uri.file('/path/to/file.ts');
      const mockDocument = createFakePartial<vscode.TextDocument>({
        uri: mockUri,
      });

      beforeEach(() => {
        jest.mocked(vscode.Uri.parse).mockReturnValue(mockUri);
        jest.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument);
      });

      describe('when document is not open', () => {
        beforeEach(() => {
          Object.defineProperty(vscode.workspace, 'textDocuments', {
            value: [],
            writable: true,
          });
        });

        it('should open document and trigger diagnostics calculation', async () => {
          mockWaitForDiagnosticsUpdate.mockImplementation(async () => {
            // Simulate the cache being populated during the wait
            mockGetDiagnostics.mockReturnValue(mockDiagnostics);
            fireDiagnosticsChangeEvent({ uris: [mockUri] });
          });

          const result = await documentQualityHandler.getDiagnostics({ fileUri });

          expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(mockUri);
          expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockDocument, {
            preview: true,
            preserveFocus: true,
          });
          expect(result).toHaveLength(1);
          expect(result[0]).toMatchObject({
            message: 'Test diagnostic',
            severity: 1,
          });
        });

        describe('when there is an active editor', () => {
          let activeUri: vscode.Uri;
          let activeDocument: vscode.TextDocument;

          beforeEach(() => {
            activeUri = vscode.Uri.file('/active.ts');
            activeDocument = createFakePartial<vscode.TextDocument>({ uri: activeUri });
            vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
              document: activeDocument,
            });
          });

          it('should preserve focus', async () => {
            const diagnosticsPromise = documentQualityHandler.getDiagnostics({ fileUri });

            jest.advanceTimersByTime(10);
            mockGetDiagnostics.mockReturnValue(mockDiagnostics);
            fireDiagnosticsChangeEvent({
              uris: [mockUri],
            });

            await diagnosticsPromise;

            expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockDocument, {
              preview: true,
              preserveFocus: true,
            });
            expect(vscode.window.showTextDocument).toHaveBeenCalledWith(activeUri);
          });
        });
      });

      describe('when document is already open', () => {
        beforeEach(() => {
          Object.defineProperty(vscode.workspace, 'textDocuments', {
            value: [mockDocument],
            writable: true,
          });
        });

        it('should not open document again', async () => {
          const diagnosticsPromise = documentQualityHandler.getDiagnostics({ fileUri });

          jest.advanceTimersByTime(10);
          mockGetDiagnostics.mockReturnValue(mockDiagnostics);
          fireDiagnosticsChangeEvent({
            uris: [mockUri],
          });

          await diagnosticsPromise;

          expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
          expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
        });
      });

      describe('diagnostics waiting', () => {
        it('should call waitForDiagnosticsUpdate with correct URI', async () => {
          await documentQualityHandler.getDiagnostics({ fileUri });

          expect(mockWaitForDiagnosticsUpdate).toHaveBeenCalledWith([fileUri]);
        });

        it('should return cached diagnostics when available', async () => {
          // First populate the cache by firing a diagnostics change event
          const testUri = vscode.Uri.file('/path/to/file.ts');
          mockGetDiagnostics.mockReturnValue(mockDiagnostics);
          fireDiagnosticsChangeEvent({ uris: [testUri] });

          const result = await documentQualityHandler.getDiagnostics({ fileUri });

          expect(result).toHaveLength(1);
          expect(result[0]).toMatchObject({
            message: 'Test diagnostic',
            severity: 1,
          });

          // Should not call waitForDiagnosticsUpdate when cache is available
          expect(mockWaitForDiagnosticsUpdate).not.toHaveBeenCalled();
        });

        it('should return empty diagnostics if none found after waiting', async () => {
          jest.mocked(vscode.languages.getDiagnostics).mockReturnValue([]);

          const result = await documentQualityHandler.getDiagnostics({ fileUri });

          expect(result).toHaveLength(0);
          expect(mockWaitForDiagnosticsUpdate).toHaveBeenCalledWith([fileUri]);
        });
      });
    });
  });

  describe('event listeners', () => {
    beforeEach(() => {
      documentQualityHandler = new DocumentQualityHandler();
    });

    describe('onDidChangeDiagnostics', () => {
      it('should update cache when diagnostics change', () => {
        const uri1 = vscode.Uri.file('/file1.ts');
        const uri2 = vscode.Uri.file('/file2.ts');
        const diagnostics1 = [createFakePartial<vscode.Diagnostic>({ message: 'Error 1' })];
        const diagnostics2 = [createFakePartial<vscode.Diagnostic>({ message: 'Error 2' })];

        mockGetDiagnostics.mockReturnValueOnce(diagnostics1).mockReturnValueOnce(diagnostics2);

        fireDiagnosticsChangeEvent({
          uris: [uri1, uri2],
        });

        expect(vscode.languages.getDiagnostics).toHaveBeenCalledWith(uri1);
        expect(vscode.languages.getDiagnostics).toHaveBeenCalledWith(uri2);
      });

      it('should handle empty diagnostics', () => {
        const uri = vscode.Uri.file('/file.ts');
        jest.mocked(vscode.languages.getDiagnostics).mockReturnValue([]);

        fireDiagnosticsChangeEvent({
          uris: [uri],
        });

        expect(vscode.languages.getDiagnostics).toHaveBeenCalledWith(uri);
      });

      it('should handle multiple URIs in single event', () => {
        const uris = [
          vscode.Uri.file('/file1.ts'),
          vscode.Uri.file('/file2.ts'),
          vscode.Uri.file('/file3.ts'),
        ];

        fireDiagnosticsChangeEvent({ uris });

        expect(vscode.languages.getDiagnostics).toHaveBeenCalledTimes(3);
        uris.forEach(uri => {
          expect(vscode.languages.getDiagnostics).toHaveBeenCalledWith(uri);
        });
      });
    });

    describe('onDidCloseTextDocument', () => {
      it('should remove cache entry when document is closed', async () => {
        const fileUri = 'file:///file.ts';
        const uri = vscode.Uri.file('/file.ts');
        const document = createFakePartial<vscode.TextDocument>({ uri });

        mockGetDiagnostics.mockReturnValue([
          createFakePartial<vscode.Diagnostic>({ message: 'Error' }),
        ]);
        fireDiagnosticsChangeEvent({ uris: [uri] });

        const result1 = await documentQualityHandler.getDiagnostics({ fileUri });
        expect(result1).toHaveLength(1);

        mockOnDidCloseTextDocumentCallback(document);

        jest.mocked(vscode.Uri.parse).mockReturnValue(uri);
        Object.defineProperty(vscode.workspace, 'textDocuments', {
          value: [document],
          writable: true,
        });

        const diagnosticsPromise = documentQualityHandler.getDiagnostics({ fileUri });

        jest.advanceTimersByTime(10);
        fireDiagnosticsChangeEvent({ uris: [uri] });

        await diagnosticsPromise;
        expect(vscode.Uri.parse).toHaveBeenCalledWith(fileUri);
      });

      it('should handle closing document that was not cached', () => {
        const uri = vscode.Uri.file('/uncached.ts');
        const document = createFakePartial<vscode.TextDocument>({ uri });

        expect(() => mockOnDidCloseTextDocumentCallback(document)).not.toThrow();
      });
    });
  });
});
