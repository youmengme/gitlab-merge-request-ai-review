import * as vscode from 'vscode';
import { CONFIG_NAMESPACE } from '../../constants';

const WAIT_TIMEOUT_MS = 10000;

/**
 * waitForWebview is a function that should be used before you start communicating with the webview, it ensures that the webview app is initialized.
 * Your webview **must** send the `{command: 'appReady'}` message to let the controller know it's ready.
 *
 * Use this function even if the controller doesn't plan on sending initial data to the webview,
 * otherwise you'll risk [that posting message to the webview will hang indefinitely](https://github.com/microsoft/vscode/issues/159431).
 *
 * waitForWebview needs to be called in the controller before we start any async work otherwise we risk that the webview app sends the `appReady` message before we called `waitForWebview`.
 *
 * Good:
 *
 * ```
 * const waitPromise = waitForWebview(webview);
 * await getInitialDataForTheVueApp() // this might take  long time
 * await waitPromise; // ensure we proceed only when the app is ready
 * ```
 *
 * Bad:
 *
 * ```
 * await getInitialDataForTheVueApp() // this took a long time an in the meantime the app sent the `appReady` message.
 * await waitForWebview(webview); // this will wait for `appReady` that's already been called
 * ```
 *
 */
export const waitForWebview = async (webview: vscode.Webview, timeoutMs?: number) => {
  let sub: vscode.Disposable;
  return new Promise<void>((resolve, reject) => {
    sub = webview.onDidReceiveMessage(message => {
      if (message.command === 'appReady') {
        sub.dispose();
        resolve();
      }
    });

    // reject after waiting WAIT_TIMEOUT_MS, otherwise we would be waiting indefinitely without error
    setTimeout(() => {
      sub.dispose();
      reject(new Error(`The webview didn't initialize in ${WAIT_TIMEOUT_MS}ms`));
    }, timeoutMs ?? WAIT_TIMEOUT_MS);
  });
};
