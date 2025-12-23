import * as vscode from 'vscode';
import { getEnvInfo } from '../env';
import { escapeHtml } from './escape_html';
import html from './templates/webview.template.html';
import osxKeyboardEventScript from './templates/osx_keyboard_event_fix.template.html';

export const getWebviewContent = async (url: URL, title: string) => {
  const externalUri = await vscode.env.asExternalUri(vscode.Uri.parse(url.toString()));
  // toString takes a parameter to skip percentage-encoding the URI, we want to use this
  // to ensure any query params are left as is.
  // https://github.com/microsoft/vscode/issues/248416#issuecomment-2863512926
  const externalUrl = new URL(externalUri.toString(true));
  const envInfo = getEnvInfo();

  const safeTitle = escapeHtml(title);
  const safeOrigin = escapeHtml(externalUrl.origin);
  const safeUrl = encodeURI(externalUrl.toString());

  let webviewHtml = html
    .replace(/{{origin}}/g, safeOrigin)
    .replace(/{{title}}/g, safeTitle)
    .replace(/{{url}}/g, safeUrl);

  if (envInfo.isMacOS || envInfo.isRemote) {
    webviewHtml = webviewHtml.replace('</head>', `${osxKeyboardEventScript}</head>`);
  }

  return webviewHtml;
};
