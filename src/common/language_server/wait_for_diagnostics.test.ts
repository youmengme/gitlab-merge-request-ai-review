import * as vscode from 'vscode';
import {
  MAX_TIME_TO_WAIT_FOR_DIAGNOSTICS_MS,
  waitForDiagnosticsUpdate,
} from './wait_for_diagnostics';

jest.mock('../log');

describe('waitForDiagnosticsUpdate', () => {
  let mockOnDidChangeDiagnosticsCallbacks: Array<(event: vscode.DiagnosticChangeEvent) => void>;
  let mockDisposables: vscode.Disposable[];

  const fireDiagnosticsChangeEvent = (event: vscode.DiagnosticChangeEvent) => {
    mockOnDidChangeDiagnosticsCallbacks.forEach(callback => callback(event));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockOnDidChangeDiagnosticsCallbacks = [];
    mockDisposables = [];

    jest.mocked(vscode.languages.onDidChangeDiagnostics).mockImplementation(callback => {
      mockOnDidChangeDiagnosticsCallbacks.push(callback);
      const mockDisposable = { dispose: jest.fn() };
      mockDisposables.push(mockDisposable);
      return mockDisposable;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('when uris array is empty', () => {
    it('should resolve immediately', async () => {
      const promise = waitForDiagnosticsUpdate([]);

      await expect(promise).resolves.toBeUndefined();
      expect(vscode.languages.onDidChangeDiagnostics).not.toHaveBeenCalled();
    });
  });

  describe('when uris array has single URI', () => {
    const mockUriString = 'file:///test.ts';
    const mockUri = vscode.Uri.file('/test.ts');

    it('should resolve when diagnostics change for the URI', async () => {
      const promise = waitForDiagnosticsUpdate([mockUriString]);

      fireDiagnosticsChangeEvent({ uris: [mockUri] });

      await expect(promise).resolves.toBeUndefined();
      expect(vscode.languages.onDidChangeDiagnostics).toHaveBeenCalled();
    });

    it('should resolve after timeout', async () => {
      const promise = waitForDiagnosticsUpdate([mockUriString]);

      jest.advanceTimersByTime(MAX_TIME_TO_WAIT_FOR_DIAGNOSTICS_MS + 1);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should resolve before timeout if diagnostics change', async () => {
      const promise = waitForDiagnosticsUpdate([mockUriString]);

      jest.advanceTimersByTime(MAX_TIME_TO_WAIT_FOR_DIAGNOSTICS_MS - 100);

      fireDiagnosticsChangeEvent({ uris: [mockUri] });

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('when uris array has multiple URIs', () => {
    const mockFiles = ['/test1.ts', '/test2.ts', '/test3.ts'];
    const mockUriStrings = mockFiles.map(f => `file://${f}`);
    const mockUris = mockFiles.map(f => vscode.Uri.file(f));

    it('should resolve when diagnostics change for all URIs', async () => {
      const promise = waitForDiagnosticsUpdate(mockUriStrings);

      fireDiagnosticsChangeEvent({ uris: mockUris });

      await expect(promise).resolves.toBeUndefined();
    });

    it('should resolve when diagnostics change for all URIs in separate events', async () => {
      const promise = waitForDiagnosticsUpdate(mockUriStrings);

      // Simulate diagnostics change events one by one
      mockUris.forEach(uri => {
        fireDiagnosticsChangeEvent({ uris: [uri] });
      });

      await expect(promise).resolves.toBeUndefined();
    });

    it('should resolve after timeout even if not all URIs updated', async () => {
      const promise = waitForDiagnosticsUpdate(mockUriStrings);

      fireDiagnosticsChangeEvent({ uris: mockUris.slice(0, 1) });

      jest.advanceTimersByTime(MAX_TIME_TO_WAIT_FOR_DIAGNOSTICS_MS + 1);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should handle duplicate URIs in the input array', async () => {
      const promise = waitForDiagnosticsUpdate([
        mockUriStrings[0],
        mockUriStrings[0],
        mockUriStrings[0],
        mockUriStrings[1],
      ]);

      fireDiagnosticsChangeEvent({ uris: mockUris });

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('event listener cleanup', () => {
    const mockUriString = 'file:///test.ts';
    const mockUri = vscode.Uri.file('/test.ts');

    it('should dispose event listener when resolved by diagnostics change', async () => {
      const promise = waitForDiagnosticsUpdate([mockUriString]);

      fireDiagnosticsChangeEvent({ uris: [mockUri] });

      await promise;

      expect(mockDisposables[0].dispose).toHaveBeenCalled();
    });

    it('should dispose event listener when resolved by timeout', async () => {
      const promise = waitForDiagnosticsUpdate([mockUriString]);

      jest.advanceTimersByTime(MAX_TIME_TO_WAIT_FOR_DIAGNOSTICS_MS + 1);

      await promise;

      expect(mockDisposables[0].dispose).toHaveBeenCalled();
    });

    it('should clear timeout when resolved by diagnostics change', async () => {
      const promise = waitForDiagnosticsUpdate([mockUriString]);

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      fireDiagnosticsChangeEvent({ uris: [mockUri] });

      await promise;

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });
});
