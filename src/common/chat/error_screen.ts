import { escapeHtml } from '../webview/escape_html';

export const getErrorScreenHtml = (errorMessage: string): string => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error</title>
    <style>
      body {
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
      }
      .error-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      .error-message {
        text-align: center;
        max-width: 300px;
      }
    </style>
  </head>
  <body>
    <div class="error-icon">⚠️</div>
    <div class="error-message">Error initializing Duo Chat.</div>
    <br><br>
    <div class="error-message">${escapeHtml(errorMessage)}</div>
  </body>
  </html>
`;
