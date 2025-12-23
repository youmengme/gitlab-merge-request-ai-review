import * as vscode from 'vscode';
import { waitForWebview } from './wait_for_webview';

const APP_READY_MESSAGE = { command: 'appReady' };

describe('waitForWebview', () => {
  let mockWebview: vscode.Webview;
  let disposable: vscode.Disposable;
  let callback: (message: unknown) => void;

  beforeEach(() => {
    jest.useFakeTimers();
    mockWebview = {
      onDidReceiveMessage: jest.fn().mockImplementation(cb => {
        callback = cb;
        return disposable;
      }),
    } as Partial<vscode.Webview> as vscode.Webview;
    disposable = {
      dispose: jest.fn(),
    };
  });

  it('waits until webView sends appReady message', async () => {
    const waitForWebviewPromise = waitForWebview(mockWebview);

    callback(APP_READY_MESSAGE); // simulates the webview starting

    await waitForWebviewPromise;

    expect(disposable.dispose).toHaveBeenCalled();
  });

  it('rejects when the webview initialization times out', async () => {
    mockWebview = {
      onDidReceiveMessage: jest.fn().mockImplementation(() => disposable),
    } as Partial<vscode.Webview> as vscode.Webview;

    const waitForWebviewPromise = waitForWebview(mockWebview);

    jest.runAllTimers(); // simulates the timeout

    await expect(waitForWebviewPromise).rejects.toThrowError(/webview didn't initialize/);
    expect(disposable.dispose).toHaveBeenCalled();
  });
});
