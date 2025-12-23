import * as vscode from 'vscode';

export type WebviewContainer = {
  webview: vscode.Webview;
  onDidDispose: vscode.Event<void>;
};

export type WebviewContainerMiddleware = (view: WebviewContainer) => void;

export function applyMiddleware(
  webviewContainer: WebviewContainer,
  middlewares: WebviewContainerMiddleware[],
): void {
  middlewares.forEach(middleware => middleware(webviewContainer));
}
