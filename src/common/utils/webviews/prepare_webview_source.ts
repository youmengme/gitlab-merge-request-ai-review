import * as vscode from 'vscode';
import { generateSecret } from '../generate_secret';
import { mapValues } from 'lodash';

const webviewResourcePaths = {
  appScriptUri: 'assets/app.js',
  styleUri: 'assets/index.css',
} as const;

const getWebviewUri = (
  path: string,
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  webviewKey: string,
): vscode.Uri => {
  const segments = path.split('/');
  const uri = vscode.Uri.joinPath(context.extensionUri, 'webviews', webviewKey, ...segments);

  return webview.asWebviewUri(uri);
};

const getWebviewResources = (
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  webviewKey: string,
) => {
  return mapValues(webviewResourcePaths, path => getWebviewUri(path, webview, context, webviewKey));
};

/**
 * Generates HTTP protocol part for CSP based on GitLab instance protocol
 * @param gitlabInstanceUrl The GitLab instance URL to check protocol for
 * @returns ' http:' if HTTP instance, empty string otherwise
 */
const generateHttpProtocol = (gitlabInstanceUrl?: string): string => {
  try {
    const url = new URL(gitlabInstanceUrl || '');
    return url.protocol === 'http:' ? ' http:' : '';
  } catch {
    return '';
  }
};

export const prepareWebviewSource = async (
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  webviewKey: string,
  instanceUrl: string | undefined,
  initialState?: object,
): Promise<string> => {
  const nonce = generateSecret();
  const httpProtocol = generateHttpProtocol(instanceUrl);

  const { appScriptUri, styleUri } = getWebviewResources(webview, context, webviewKey);
  const fileUri = vscode.Uri.joinPath(context.extensionUri, 'webviews', webviewKey, 'index.html');
  const contentArray = await vscode.workspace.fs.readFile(fileUri);
  const fileContent = new TextDecoder().decode(contentArray);
  const initialStateString = initialState ? JSON.stringify(initialState) : '';

  return fileContent
    .replace(/{{nonce}}/gm, nonce)
    .replace(/{{httpProtocol}}/gm, httpProtocol)
    .replace(/<script /g, `<script nonce="${nonce}" `)
    .replace(`/${webviewKey}/${webviewResourcePaths.styleUri}`, styleUri.toString())
    .replace(`/${webviewKey}/${webviewResourcePaths.appScriptUri}`, appScriptUri.toString())
    .replace(/{{initialState}}/gm, initialStateString);
};
