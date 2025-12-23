import * as vscode from 'vscode';
import {
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResult,
  TextDocumentEdit,
} from 'vscode-languageclient';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { SaveFileMiddleware } from './save_file_middleware';

jest.mock('../log');

describe('SaveFileMiddleware', () => {
  let mockDocument: vscode.TextDocument;

  beforeEach(() => {
    mockDocument = createFakePartial<vscode.TextDocument>({
      uri: vscode.Uri.parse('file:///test.ts'),
      isDirty: true,
      save: jest.fn().mockResolvedValue(true),
    });

    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [mockDocument],
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [],
      configurable: true,
    });
  });
  it('should save dirty files after successful workspace edit', async () => {
    const mockNext = jest.fn().mockResolvedValue(
      createFakePartial<ApplyWorkspaceEditResult>({
        applied: true,
      }),
    );

    const params = createFakePartial<ApplyWorkspaceEditParams>({
      edit: {
        documentChanges: [
          createFakePartial<TextDocumentEdit>({
            textDocument: { uri: 'file:///test.ts' },
            edits: [{ range: {}, newText: 'new content' }],
          }),
        ],
      },
    });

    const middleware = new SaveFileMiddleware();
    const result = await middleware.process(params, mockNext);

    expect(mockNext).toHaveBeenCalledWith(params);
    expect(mockDocument.save).toHaveBeenCalled();
    expect(result).toEqual({ applied: true });
  });
});
