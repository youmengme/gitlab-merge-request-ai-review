import * as vscode from 'vscode';
import { prepareWebviewSource } from './prepare_webview_source';

jest.mock('../generate_secret', () => ({
  generateSecret: jest.fn().mockReturnValue('123'),
}));

describe('prepareWebViewSource', () => {
  const inputSource = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="img-src vscode-resource: data: https:{{httpProtocol}}; script-src 'nonce-{{nonce}}';">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>GitLab Workflow</title>
      <script crossorigin type="module" src="/gitlab_duo_chat/assets/app.js"></script>
      <link rel="stylesheet" href="/gitlab_duo_chat/assets/index.css">
    </head>
    <body>
      <div id="app" data-initial-state='{{initialState}}'></div>
    </body>
  </html>
  `;

  const expectedHTML = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="img-src vscode-resource: data: https:; script-src 'nonce-123';">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>GitLab Workflow</title>
      <script nonce="123" crossorigin type="module" src="file:///foo/bar/webviews/gitlab_duo_chat/assets/app.js"></script>
      <link rel="stylesheet" href="file:///foo/bar/webviews/gitlab_duo_chat/assets/index.css">
    </head>
    <body>
      <div id="app" data-initial-state=''></div>
    </body>
  </html>
  `;
  let context: vscode.ExtensionContext;
  let webview: vscode.Webview;

  beforeEach(() => {
    context = {
      extensionUri: vscode.Uri.file('/foo/bar'),
    } as Partial<vscode.ExtensionContext> as vscode.ExtensionContext;
    webview = {
      asWebviewUri: jest.fn().mockImplementation(url => url),
    } as Partial<vscode.Webview> as vscode.Webview;

    (vscode.workspace.fs.readFile as jest.Mock).mockImplementation(file => {
      if (file.toString() === `${context.extensionUri}/webviews/gitlab_duo_chat/index.html`) {
        return Promise.resolve(new TextEncoder().encode(inputSource));
      }
    });
  });

  it('returns WebView source with inserted nonce and assets', async () => {
    const result = await prepareWebviewSource(
      webview,
      context,
      'gitlab_duo_chat',
      'https://gitlab.example.com',
    );
    expect(result).toStrictEqual(expectedHTML);
  });

  it('returns WebView source with HTTP and HTTPS CSP for HTTP GitLab instance', async () => {
    const result = await prepareWebviewSource(
      webview,
      context,
      'gitlab_duo_chat',
      'http://gitlab.example.com',
    );
    const expectedHtmlWithHttp = expectedHTML.replace(
      'img-src vscode-resource: data: https:;',
      'img-src vscode-resource: data: https: http:;',
    );
    expect(result).toStrictEqual(expectedHtmlWithHttp);
  });

  it('returns WebView source with initial app state set', async () => {
    const initState = {
      foo: 'bar',
    };
    const result = await prepareWebviewSource(
      webview,
      context,
      'gitlab_duo_chat',
      'https://gitlab.example.com',
      initState,
    );
    const expectedHtmlString = expectedHTML.replace(
      "data-initial-state=''",
      `data-initial-state='${JSON.stringify(initState)}'`,
    );
    expect(result).toStrictEqual(expectedHtmlString);
  });
});
