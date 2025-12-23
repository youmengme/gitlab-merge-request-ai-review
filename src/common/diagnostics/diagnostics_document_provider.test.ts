import * as vscode from 'vscode';
import { log } from '../log';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { DiagnosticsDocumentProvider, DIAGNOSTICS_URI } from './diagnostics_document_provider';
import { DiagnosticsService } from './diagnostics_service';

jest.mock('../log');

describe('DiagnosticsDocumentProvider', () => {
  let documentProvider: DiagnosticsDocumentProvider;
  let service: DiagnosticsService;
  let diagnosticProviderRegistryEventEmitter: vscode.EventEmitter<void>;

  beforeEach(() => {
    diagnosticProviderRegistryEventEmitter = new vscode.EventEmitter<void>();
    service = createFakePartial<DiagnosticsService>({
      onChange: diagnosticProviderRegistryEventEmitter.event,
      getSections: jest.fn().mockReturnValue([
        { title: 'Test Section 1', content: 'Content 1' },
        { title: 'Test Section 2', content: 'Content 2' },
      ]),
    });

    documentProvider = new DiagnosticsDocumentProvider(service);
  });

  it('fires change event when registry changes', () => {
    const listener = jest.fn();
    documentProvider.onDidChange(listener);

    diagnosticProviderRegistryEventEmitter.fire();

    expect(listener).toHaveBeenCalledWith(DIAGNOSTICS_URI);
  });

  describe('provideTextDocumentContent', () => {
    it('returns formatted content for valid URI', () => {
      const content = documentProvider.provideTextDocumentContent(DIAGNOSTICS_URI);
      const expectedContent =
        '# GitLab Workflow Diagnostics\n\n' +
        '## Test Section 1\n\nContent 1\n\n' +
        '## Test Section 2\n\nContent 2';

      expect(content).toBe(expectedContent);
    });

    it('logs warning for invalid URI but still returns content', () => {
      const invalidUri = vscode.Uri.parse('invalid-uri:/test');
      const content = documentProvider.provideTextDocumentContent(invalidUri);

      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid URI'));
      expect(content).toBeDefined();
    });

    it('handles errors during content generation', () => {
      jest.mocked(service.getSections).mockImplementation(() => {
        throw new Error('Test error');
      });

      const content = documentProvider.provideTextDocumentContent(DIAGNOSTICS_URI);

      expect(log.error).toHaveBeenCalled();
      expect(content).toBe('Error when rendering diagnostics: Test error');
    });
  });
});
