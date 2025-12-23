import * as vscode from 'vscode';
import { copyContent } from './copy_content';

describe('copyContent', () => {
  it('should copy content to clipboard and show success message', async () => {
    const snippet = 'const test = "hello";';
    const writeTextSpy = jest.spyOn(vscode.env.clipboard, 'writeText').mockResolvedValue();
    const showInfoMessageSpy = jest
      .spyOn(vscode.window, 'showInformationMessage')
      .mockResolvedValue(undefined);

    await copyContent(snippet);

    expect(writeTextSpy).toHaveBeenCalledWith(snippet);
    expect(showInfoMessageSpy).toHaveBeenCalledWith('Copied to clipboard.');
  });

  it('should show error message when copying fails', async () => {
    const snippet = 'const test = "hello";';
    const error = new Error('Failed to copy');
    jest.spyOn(vscode.env.clipboard, 'writeText').mockRejectedValue(error);
    const showErrorMessageSpy = jest
      .spyOn(vscode.window, 'showErrorMessage')
      .mockResolvedValue(undefined);

    await copyContent(snippet);

    expect(showErrorMessageSpy).toHaveBeenCalledWith('Error copying: Failed to copy');
  });
});
