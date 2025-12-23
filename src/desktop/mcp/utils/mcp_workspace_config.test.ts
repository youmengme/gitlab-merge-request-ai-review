import * as path from 'path';
import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as vscode from 'vscode';
import {
  getMcpWorkspaceConfigPath,
  ensureMcpWorkspaceConfigFile,
  openMcpWorkspaceConfigFile,
} from './mcp_workspace_config';
import { DEFAULT_CONFIG_TEMPLATE } from './mcp_config';

jest.mock('fs/promises');
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: undefined,
  },
  Uri: {
    file: jest.fn(),
  },
  commands: {
    executeCommand: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockVscode = vscode as jest.Mocked<typeof vscode>;

describe('mcp_workspace_config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ isDirectory: () => false } as Stats);
    jest.mocked(mockVscode.commands.executeCommand).mockResolvedValue(undefined);
    (mockVscode.Uri.file as jest.Mock).mockReturnValue({ scheme: 'file' } as vscode.Uri);
  });

  describe('getMcpWorkspaceConfigPath', () => {
    it('should return correct path when workspace folder exists', () => {
      const mockWorkspaceFolder = {
        uri: { fsPath: '/path/to/workspace' },
        name: 'test-workspace',
        index: 0,
      };
      Object.defineProperty(mockVscode.workspace, 'workspaceFolders', {
        value: [mockWorkspaceFolder],
        writable: true,
      });

      const result = getMcpWorkspaceConfigPath();

      expect(result).toBe(path.join('/path/to/workspace', '.gitlab', 'duo', 'mcp.json'));
    });

    it('should throw error when no workspace folders exist', () => {
      Object.defineProperty(mockVscode.workspace, 'workspaceFolders', {
        value: undefined,
        writable: true,
      });

      expect(() => getMcpWorkspaceConfigPath()).toThrow(
        'No workspace folder is open. Please open a workspace to use workspace-level MCP configuration.',
      );
    });

    it('should throw error when workspace folders array is empty', () => {
      Object.defineProperty(mockVscode.workspace, 'workspaceFolders', {
        value: [],
        writable: true,
      });

      expect(() => getMcpWorkspaceConfigPath()).toThrow(
        'No workspace folder is open. Please open a workspace to use workspace-level MCP configuration.',
      );
    });

    it('should use first workspace folder when multiple exist', () => {
      const mockWorkspaceFolders = [
        { uri: { fsPath: '/path/to/first' }, name: 'first', index: 0 },
        { uri: { fsPath: '/path/to/second' }, name: 'second', index: 1 },
      ];
      Object.defineProperty(mockVscode.workspace, 'workspaceFolders', {
        value: mockWorkspaceFolders,
        writable: true,
      });

      const result = getMcpWorkspaceConfigPath();

      expect(result).toBe(path.join('/path/to/first', '.gitlab', 'duo', 'mcp.json'));
    });
  });

  describe('ensureMcpWorkspaceConfigFile', () => {
    const configPath = '/path/to/workspace/.gitlab/duo/mcp.json';
    const configDir = '/path/to/workspace/.gitlab/duo';

    beforeEach(() => {
      const mockWorkspaceFolder = {
        uri: { fsPath: '/path/to/workspace' },
        name: 'test-workspace',
        index: 0,
      };
      Object.defineProperty(mockVscode.workspace, 'workspaceFolders', {
        value: [mockWorkspaceFolder],
        writable: true,
      });
    });

    it('creates directory and file on first run', async () => {
      await ensureMcpWorkspaceConfigFile();

      expect(mockFs.mkdir).toHaveBeenCalledWith(configDir, { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(configPath, DEFAULT_CONFIG_TEMPLATE, {
        flag: 'wx',
        encoding: 'utf8',
      });
    });

    describe('when file already exists', () => {
      beforeEach(() => {
        jest
          .mocked(mockFs.writeFile)
          .mockRejectedValue(Object.assign(new Error('File exists'), { code: 'EEXIST' }));
      });

      it('handles EEXIST gracefully when it is a file', async () => {
        await ensureMcpWorkspaceConfigFile();
        expect(mockFs.mkdir).toHaveBeenCalled();
        expect(mockFs.stat).toHaveBeenCalledWith(configPath);
        expect(mockFs.stat).toHaveBeenCalledTimes(1);
      });

      it('throws if path is a directory', async () => {
        mockFs.stat.mockResolvedValue({ isDirectory: () => true } as Stats);
        await expect(ensureMcpWorkspaceConfigFile()).rejects.toThrow(
          'Config path exists but is a directory',
        );
      });
    });

    describe('when other errors occur', () => {
      it('propagates writeFile errors other than EEXIST', async () => {
        jest
          .mocked(mockFs.writeFile)
          .mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));
        await expect(ensureMcpWorkspaceConfigFile()).rejects.toThrow('Permission denied');
        expect(mockFs.stat).not.toHaveBeenCalled();
      });

      it('propagates mkdir errors', async () => {
        jest
          .mocked(mockFs.mkdir)
          .mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));
        await expect(ensureMcpWorkspaceConfigFile()).rejects.toThrow('Permission denied');
      });

      it('handles disk full error', async () => {
        jest
          .mocked(mockFs.writeFile)
          .mockRejectedValue(
            Object.assign(new Error('No space left on device'), { code: 'ENOSPC' }),
          );
        await expect(ensureMcpWorkspaceConfigFile()).rejects.toThrow('No space left on device');
      });
    });

    it('handles concurrent calls without race condition', async () => {
      const eexistError = Object.assign(new Error('File exists'), { code: 'EEXIST' });
      mockFs.writeFile.mockRejectedValue(eexistError);

      const [result1, result2] = await Promise.all([
        ensureMcpWorkspaceConfigFile(),
        ensureMcpWorkspaceConfigFile(),
      ]);

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      expect(mockFs.stat).toHaveBeenCalledTimes(2);
    });

    describe('error code validation', () => {
      it.each([
        { code: 'EEXIST', shouldThrow: false },
        { code: 'EACCES', shouldThrow: true },
        { code: 'ENOSPC', shouldThrow: true },
        { code: 'EMFILE', shouldThrow: true },
        { code: 'EISDIR', shouldThrow: true },
      ])('handles $code correctly', async ({ code, shouldThrow }) => {
        const error = Object.assign(new Error(`Test error: ${code}`), { code });
        mockFs.writeFile.mockRejectedValue(error);

        if (shouldThrow) {
          await expect(ensureMcpWorkspaceConfigFile()).rejects.toThrow(`Test error: ${code}`);
        } else {
          await expect(ensureMcpWorkspaceConfigFile()).resolves.toBeUndefined();
        }
      });
    });
  });

  describe('openMcpWorkspaceConfigFile', () => {
    beforeEach(() => {
      const mockWorkspaceFolder = {
        uri: { fsPath: '/path/to/workspace' },
        name: 'test-workspace',
        index: 0,
      };
      Object.defineProperty(mockVscode.workspace, 'workspaceFolders', {
        value: [mockWorkspaceFolder],
        writable: true,
      });
    });

    it('ensures config exists and opens file', async () => {
      const expectedUri = { scheme: 'file', path: '/path/to/workspace/.gitlab/duo/mcp.json' };
      (mockVscode.Uri.file as jest.Mock).mockReturnValue(expectedUri);

      await openMcpWorkspaceConfigFile();

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockVscode.Uri.file).toHaveBeenCalledWith('/path/to/workspace/.gitlab/duo/mcp.json');
      expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', expectedUri);
    });

    it('propagates VS Code command errors', async () => {
      jest
        .mocked(mockVscode.commands.executeCommand)
        .mockRejectedValue(new Error('Command failed'));
      await expect(openMcpWorkspaceConfigFile()).rejects.toThrow('Command failed');
    });

    it('handles config creation failure', async () => {
      jest
        .mocked(mockFs.mkdir)
        .mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));
      await expect(openMcpWorkspaceConfigFile()).rejects.toThrow('Permission denied');
      expect(mockVscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });
});
