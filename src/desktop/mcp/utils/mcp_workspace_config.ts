import * as path from 'path';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import { DEFAULT_CONFIG_TEMPLATE } from './mcp_config';

/**
 * Gets the path to the workspace MCP config file
 * @returns The absolute path to the workspace MCP config file
 */
export function getMcpWorkspaceConfigPath(): string {
  const { workspaceFolders } = vscode.workspace;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error(
      'No workspace folder is open. Please open a workspace to use workspace-level MCP configuration.',
    );
  }

  // Use first workspace folder
  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  return path.join(workspaceRoot, '.gitlab', 'duo', 'mcp.json');
}

/**
 * Creates a default workspace MCP config file if it doesn't exist
 * @returns Promise that resolves when config file is created or already exists
 */
export async function ensureMcpWorkspaceConfigFile(): Promise<void> {
  const configPath = getMcpWorkspaceConfigPath();
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
 * Opens the workspace MCP config file in VS Code
 * @returns Promise that resolves when the file is opened
 */
export async function openMcpWorkspaceConfigFile(): Promise<void> {
  await ensureMcpWorkspaceConfigFile();
  const configPath = getMcpWorkspaceConfigPath();
  const uri = vscode.Uri.file(configPath);

  await vscode.commands.executeCommand('vscode.open', uri);
}
