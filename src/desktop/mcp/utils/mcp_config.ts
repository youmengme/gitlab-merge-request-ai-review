import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as vscode from 'vscode';

export const DEFAULT_CONFIG_TEMPLATE = `{
  // GitLab Duo MCP (Model Context Protocol) Configuration
  // This file configures MCP servers that extend GitLab Duo's capabilities.
  // MCP servers provide additional tools and resources that can be used during conversations.
  //
  // GitLab MCP Documentation: https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/mcp_clients/
  // MCP Prerequisites: https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/mcp_clients/#prerequisites

  // Uncomment and modify the example below to add your first MCP server:

  "mcpServers": {
    // Example: Local server
    // "enterprise-data-v2": {
    //       "type": "stdio",
    //       "command": "node",
    //       "args": ["src/server.js"],
    //       "cwd": "</path/to/your-mcp-server>"
    // }
    //
    // Example: Remote server
    // "aws-knowledge": {
    //   "type": sse,
    //   "command": "npx",
    //   "args": [
    //     "mcp-remote",
    //     "https://knowledge-mcp.global.api.aws"
    //   ]
    // }
    //

    // Add your MCP server configurations here
  }
}`;

/**
 * Gets the cross-platform path to the MCP config file
 * @returns The absolute path to the MCP config file
 */
export function getMcpUserConfigPath(): string {
  const homeDir = os.homedir();
  if (!homeDir || homeDir.trim() === '') {
    throw new Error('Unable to determine home directory. Please set HOME environment variable.');
  }
  const configDir = path.join(homeDir, '.gitlab', 'duo');

  return path.join(configDir, 'mcp.json');
}

/**
 * Creates a default MCP config file if it doesn't exist
 * @returns Promise that resolves when config file is created or already exists
 */
export async function ensureMcpUserConfigFile(): Promise<void> {
  const configPath = getMcpUserConfigPath();
  const configDir = path.dirname(configPath);
  const defaultConfigJson = DEFAULT_CONFIG_TEMPLATE;

  await fs.mkdir(configDir, { recursive: true });

  try {
    await fs.writeFile(configPath, defaultConfigJson, { flag: 'wx', encoding: 'utf8' });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EEXIST') {
      const stats = await fs.stat(configPath);
      if (stats.isDirectory()) {
        throw new Error(
          `Config path exists but is a directory: ${configPath}. Please remove or rename it.`,
        );
      }

      return;
    }

    // Other errors (EACCES, ENOSPC, etc.) should be propagated
    throw err;
  }
}

/**
 * Opens the MCP config file in VS Code
 * @returns Promise that resolves when the file is opened
 */
export async function openMcpUserConfigFile(): Promise<void> {
  await ensureMcpUserConfigFile();
  const configPath = getMcpUserConfigPath();
  const uri = vscode.Uri.file(configPath);

  await vscode.commands.executeCommand('vscode.open', uri);
}
