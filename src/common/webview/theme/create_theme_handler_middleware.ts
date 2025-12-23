import * as vscode from 'vscode';
import { WebviewContainerMiddleware } from '../middleware';
import scriptContent from './with_theme_handler.template.html';
import { WebviewThemePublisher } from './types';
import { adaptTheme } from './theme_adapter';

export const WEBVIEW_THEME_CHANGED_MESSAGE_TYPE = '__gl_theme-changed';

type WebviewThemeResponseMessage = {
  type: typeof WEBVIEW_THEME_CHANGED_MESSAGE_TYPE;
  cssVariables: Record<string, string>;
};

const isWebviewThemeResponseMessage = (message: unknown): message is WebviewThemeResponseMessage =>
  typeof message === 'object' &&
  message !== null &&
  'type' in message &&
  message.type === WEBVIEW_THEME_CHANGED_MESSAGE_TYPE;

export const createThemeHandlerMiddleware =
  (themePublisher: WebviewThemePublisher): WebviewContainerMiddleware =>
  container => {
    const subscriptions = new Set<vscode.Disposable>();

    subscriptions.add(
      container.webview.onDidReceiveMessage(async (message: unknown) => {
        if (isWebviewThemeResponseMessage(message)) {
          // TODO: map css variables to gitlab theme schema
          await themePublisher.publishWebviewTheme({
            styles: adaptTheme(message.cssVariables),
          });
        }
      }),
    );

    subscriptions.add(
      vscode.window.onDidChangeActiveColorTheme(async () => {
        await container.webview.postMessage({
          type: WEBVIEW_THEME_CHANGED_MESSAGE_TYPE,
        });
      }),
    );

    // eslint-disable-next-line no-param-reassign
    container.webview.html = container.webview.html.replace('</head>', `${scriptContent}</head>`);

    container.onDidDispose(() => {
      subscriptions.forEach(subscription => subscription.dispose());
      subscriptions.clear();
    });
  };
