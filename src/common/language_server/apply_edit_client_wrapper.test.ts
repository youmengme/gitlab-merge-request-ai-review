import * as vscode from 'vscode';
import { ApplyWorkspaceEditParams } from 'vscode-languageclient';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { ApplyEditClientWrapper, ApplyEditMiddleware } from './apply_edit_client_wrapper';

describe('ApplyEditClientWrapper', () => {
  it('should process workspace edit through middleware chain', async () => {
    jest.mocked(vscode.workspace.applyEdit).mockResolvedValue(true);

    const mockMiddleware = createFakePartial<ApplyEditMiddleware>({
      process: jest.fn().mockImplementation(async (params, next) => {
        const result = await next(params);
        return { ...result, modified: true };
      }),
    });

    const wrapper = new ApplyEditClientWrapper();
    wrapper.addApplyEditMiddleware(mockMiddleware);

    const params = createFakePartial<ApplyWorkspaceEditParams>({
      edit: {
        documentChanges: [],
      },
    });

    const result = await wrapper.handleApplyWorkspaceEdit(params);

    expect(mockMiddleware.process).toHaveBeenCalledWith(params, expect.any(Function));
    expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    expect(result).toEqual({ applied: true, modified: true });
  });
});
