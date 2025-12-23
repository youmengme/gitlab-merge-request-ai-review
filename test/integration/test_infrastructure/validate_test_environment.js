const vscode = require('vscode');

const validateTestEnvironment = () => {
  if (!vscode.workspace.workspaceFolders) {
    throw new Error(
      `Your test workspace is not properly setup! When the integration tests started, there wasn't any open workspace in the VS Code.`,
    );
  }
};

module.exports = { validateTestEnvironment };
