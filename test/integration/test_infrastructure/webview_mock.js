const EventEmitter = require('events');
const vscode = require('vscode');

/*
  This class replaces the mechanism that the webviews use for sending messages between
  the extension and the webview. This is necessary since we can't control the webview and so
  we need to be able to simulate events triggered by the webview and see that the extension
  handles them well.
  */
class WebviewMock {
  #eventEmitter;

  #sandbox;

  constructor(sandbox) {
    this.#eventEmitter = new EventEmitter();
    this.#sandbox = sandbox;
    this.webview = this.#createWebview();
  }

  mockNextWebView() {
    const stub = this.#sandbox.stub(vscode.window, 'createWebviewPanel').callsFake(() => {
      stub.restore();
      return this.webview;
    });
  }

  async emulateViewMessage(message) {
    await this.#eventEmitter.emit('', message);
  }

  async waitForMessage(matchFunc, times = 1) {
    return new Promise(resolve => {
      const result = [];
      const sub = this.webview.webview.onDidReceiveMessage(message => {
        if (!matchFunc(message)) return;

        result.push(message);

        if (result.length >= times) {
          sub.dispose();
          resolve(times === 1 ? result[0] : result);
        }
      });
    });
  }

  postMessage(message) {
    this.webview.webview.postMessage(message);
  }

  #createWebview() {
    const webview = vscode.window.createWebviewPanel(
      'webviewMock',
      'WebView Mock',
      vscode.ViewColumn.One,
    );
    webview.show = () => {};
    webview.onDidChangeVisibility = () => {};

    this.#sandbox.stub(webview.webview, 'postMessage').callsFake(message => {
      this.#eventEmitter.emit('', message);
    });
    this.#sandbox.stub(webview.webview, 'onDidReceiveMessage').callsFake(listener => {
      this.#eventEmitter.on('', listener);

      setTimeout(async () => this.emulateViewMessage({ command: 'appReady' }), 1);

      return { dispose: () => {} };
    });

    return webview;
  }
}

module.exports = {
  WebviewMock,
};
