import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  getMcpUserConfigPath,
  ensureMcpUserConfigFile,
  openMcpUserConfigFile,
  DEFAULT_CONFIG_TEMPLATE,
} from './mcp_config';

jest.mock('fs/promises');
jest.mock('os');
jest.mock('vscode', () => ({
  commands: {
    executeCommand: jest.fn(),
  },
  Uri: {
    file: jest.fn(),
  },
}));

describe('MCP Config Utils', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(os.homedir).mockReturnValue('/home/user');
    jest.mocked(fs.mkdir).mockResolvedValue(undefined);
    jest.mocked(fs.writeFile).mockResolvedValue(undefined);
    jest.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as Stats);
    jest.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
    (vscode.Uri.file as jest.Mock).mockReturnValue({ scheme: 'file' } as vscode.Uri);
  });

  describe('getMcpUserConfigPath', () => {
    describe('returns correct path for various home directories', () => {
      it.each([
        ['/home/user', '/home/user/.gitlab/duo/mcp.json'],
        ['/Users/user', '/Users/user/.gitlab/duo/mcp.json'],
        ['C:\\Users\\User', path.join('C:\\Users\\User', '.gitlab', 'duo', 'mcp.json')],
      ])('returns correct path for home=%p', (homeDir, expected) => {
        jest.mocked(os.homedir).mockReturnValue(homeDir);
        const result = getMcpUserConfigPath();
        expect(result).toBe(expected);
      });
    });

    describe('throws when home directory is invalid', () => {
      beforeEach(() => {
        jest.resetAllMocks();
      });

      it('throws error when home directory is empty', () => {
        jest.mocked(os.homedir).mockReturnValue('');
        expect(() => getMcpUserConfigPath()).toThrow('Unable to determine home directory');
      });

      it('throws error when home directory is undefined', () => {
        jest.mocked(os.homedir).mockReturnValue(undefined as unknown as string);
        expect(() => getMcpUserConfigPath()).toThrow('Unable to determine home directory');
      });
    });
  });

  describe('ensureMcpUserConfigFile', () => {
    const configPath = '/home/user/.gitlab/duo/mcp.json';
    const configDir = '/home/user/.gitlab/duo';

    it('creates directory and file on first run', async () => {
      await ensureMcpUserConfigFile();
      expect(fs.mkdir).toHaveBeenCalledWith(configDir, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(configPath, DEFAULT_CONFIG_TEMPLATE, {
        flag: 'wx',
        encoding: 'utf8',
      });
    });

    describe('when file already exists', () => {
      beforeEach(() => {
        jest
          .mocked(fs.writeFile)
          .mockRejectedValue(Object.assign(new Error('File exists'), { code: 'EEXIST' }));
      });

      it('handles EEXIST gracefully when it is a file', async () => {
        await ensureMcpUserConfigFile();
        expect(fs.mkdir).toHaveBeenCalled();
        expect(fs.stat).toHaveBeenCalledWith(configPath);
        expect(fs.stat).toHaveBeenCalledTimes(1);
      });

      it('throws if path is a directory', async () => {
        jest.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as Stats);
        await expect(ensureMcpUserConfigFile()).rejects.toThrow(
          'Config path exists but is a directory',
        );
      });
    });

    describe('when other errors occur', () => {
      it('propagates writeFile errors other than EEXIST', async () => {
        jest
          .mocked(fs.writeFile)
          .mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));
        await expect(ensureMcpUserConfigFile()).rejects.toThrow('Permission denied');
        expect(fs.stat).not.toHaveBeenCalled();
      });

      it('propagates mkdir errors', async () => {
        jest
          .mocked(fs.mkdir)
          .mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));
        await expect(ensureMcpUserConfigFile()).rejects.toThrow('Permission denied');
      });

      it('handles disk full error', async () => {
        jest
          .mocked(fs.writeFile)
          .mockRejectedValue(
            Object.assign(new Error('No space left on device'), { code: 'ENOSPC' }),
          );
        await expect(ensureMcpUserConfigFile()).rejects.toThrow('No space left on device');
      });
    });

    it('handles concurrent calls without race condition', async () => {
      const eexistError = Object.assign(new Error('File exists'), { code: 'EEXIST' });
      jest.mocked(fs.writeFile).mockRejectedValue(eexistError);

      const [result1, result2] = await Promise.all([
        ensureMcpUserConfigFile(),
        ensureMcpUserConfigFile(),
      ]);

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      expect(fs.stat).toHaveBeenCalledTimes(2);
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
        jest.mocked(fs.writeFile).mockRejectedValue(error);

        if (shouldThrow) {
          await expect(ensureMcpUserConfigFile()).rejects.toThrow(`Test error: ${code}`);
        } else {
          await expect(ensureMcpUserConfigFile()).resolves.toBeUndefined();
        }
      });
    });
  });

  describe('openMcpUserConfigFile', () => {
    it('ensures config exists and opens file', async () => {
      const expectedUri = { scheme: 'file', path: '/home/user/.gitlab/duo/mcp.json' };
      (vscode.Uri.file as jest.Mock).mockReturnValue(expectedUri);

      await openMcpUserConfigFile();

      expect(fs.mkdir).toHaveBeenCalled();
      expect(vscode.Uri.file).toHaveBeenCalledWith('/home/user/.gitlab/duo/mcp.json');
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', expectedUri);
    });

    it('propagates VS Code command errors', async () => {
      jest.mocked(vscode.commands.executeCommand).mockRejectedValue(new Error('Command failed'));
      await expect(openMcpUserConfigFile()).rejects.toThrow('Command failed');
    });

    it('handles config creation failure', async () => {
      jest
        .mocked(fs.mkdir)
        .mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));
      await expect(openMcpUserConfigFile()).rejects.toThrow('Permission denied');
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });
});
