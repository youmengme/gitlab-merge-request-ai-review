import * as vscode from 'vscode';
import { CLIPBOARD_RESET_PLACEHOLDER, getTerminalAIContext } from './gitlab_chat_terminal_context';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid'),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getTerminalAIContext', () => {
  describe('clipboard management', () => {
    beforeEach(() => {
      jest
        .mocked(vscode.env.clipboard.readText)
        .mockResolvedValueOnce('existing clipboard content')
        .mockResolvedValueOnce('selected terminal text');
    });

    it('executes the terminal copy selection command', async () => {
      await getTerminalAIContext();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.terminal.copySelection',
      );
    });

    it('restores original clipboard content after reading selection', async () => {
      await getTerminalAIContext();
      expect(vscode.env.clipboard.writeText).toHaveBeenCalledTimes(2);
      expect(jest.mocked(vscode.env.clipboard.writeText).mock.calls.at(1)).toEqual([
        'existing clipboard content',
      ]);
    });
  });

  describe('when the terminal has a selection', () => {
    describe('with a single line of text', () => {
      beforeEach(() => {
        jest
          .mocked(vscode.env.clipboard.readText)
          .mockResolvedValueOnce('existing clipboard content')
          .mockResolvedValueOnce('single line');
      });

      it('returns a context item with the selected text', async () => {
        const result = await getTerminalAIContext();
        expect(result?.content).toEqual('single line');
      });

      it('uses "Selected command:" as the title', async () => {
        const result = await getTerminalAIContext();
        expect(result?.metadata.title).toBe('Selected command:');
      });
    });

    describe('with multiple lines of text', () => {
      beforeEach(() => {
        jest
          .mocked(vscode.env.clipboard.readText)
          .mockResolvedValueOnce('existing clipboard content')
          .mockResolvedValueOnce('first line\nsecond line\nthird line');
      });

      it('returns a context item with all selected text', async () => {
        const result = await getTerminalAIContext();
        expect(result?.content).toEqual('first line\nsecond line\nthird line');
      });

      it('uses "Selected command:" as the title', async () => {
        const result = await getTerminalAIContext();
        expect(result?.metadata.title).toBe('Selected command:');
      });
    });

    describe('when the first line of text is empty', () => {
      beforeEach(() => {
        jest
          .mocked(vscode.env.clipboard.readText)
          .mockResolvedValueOnce('existing clipboard content')
          .mockResolvedValueOnce('\nsecond line\nthird line');
      });

      it('uses "Selected command:" as the title', async () => {
        const result = await getTerminalAIContext();
        expect(result?.metadata.title).toBe('Selected command:');
      });
    });

    describe('context item structure', () => {
      beforeEach(() => {
        jest
          .mocked(vscode.env.clipboard.readText)
          .mockResolvedValueOnce('existing clipboard content')
          .mockResolvedValueOnce('sample text');
      });

      it('creates an AIContextItem with expected static properties', async () => {
        const result = await getTerminalAIContext();

        expect(result).toMatchObject({
          id: 'mocked-uuid',
          category: 'terminal',
          metadata: {
            enabled: true,
            subType: 'snippet',
            subTypeLabel: 'Selected terminal output',
            icon: 'terminal',
          },
        });
      });
    });
  });

  describe('when the terminal has no selection', () => {
    describe('when the clipboard is empty after copy command', () => {
      beforeEach(() => {
        jest
          .mocked(vscode.env.clipboard.readText)
          .mockResolvedValueOnce('existing clipboard content')
          .mockResolvedValueOnce('');
      });

      it('returns undefined', async () => {
        const result = await getTerminalAIContext();
        expect(result).toBeUndefined();
      });

      it('still restores the original clipboard content', async () => {
        await getTerminalAIContext();
        expect(vscode.env.clipboard.writeText).toHaveBeenCalledTimes(2);
        expect(jest.mocked(vscode.env.clipboard.writeText).mock.calls.at(1)).toEqual([
          'existing clipboard content',
        ]);
      });
    });

    describe('when the clipboard contains the reset placeholder after copy command', () => {
      beforeEach(() => {
        jest
          .mocked(vscode.env.clipboard.readText)
          .mockResolvedValueOnce('existing clipboard content')
          .mockResolvedValueOnce(CLIPBOARD_RESET_PLACEHOLDER);
      });

      it('returns undefined', async () => {
        const result = await getTerminalAIContext();
        expect(result).toBeUndefined();
      });

      it('still restores the original clipboard content', async () => {
        await getTerminalAIContext();
        expect(vscode.env.clipboard.writeText).toHaveBeenCalledTimes(2);
        expect(jest.mocked(vscode.env.clipboard.writeText).mock.calls.at(1)).toEqual([
          'existing clipboard content',
        ]);
      });
    });
  });
});

describe('when terminal falls back to last command', () => {
  beforeEach(() => {
    jest
      .mocked(vscode.env.clipboard.readText)
      .mockResolvedValueOnce('existing clipboard content') // original clipboard
      .mockResolvedValueOnce(CLIPBOARD_RESET_PLACEHOLDER) // after selection attempt
      .mockResolvedValueOnce('npm test\nPassed: 5 tests'); // after last command
  });

  it('executes both terminal commands', async () => {
    await getTerminalAIContext();

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'workbench.action.terminal.copySelection',
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'workbench.action.terminal.copyLastCommandAndLastCommandOutput',
    );
  });

  it('returns context with lastCommand source', async () => {
    const result = await getTerminalAIContext();

    expect(result?.content).toBe('npm test\nPassed: 5 tests');
    expect(result?.metadata.subTypeLabel).toBe('Last terminal command');
    expect(result?.metadata.title).toBe('Last command:');
  });
});

describe('when last command starts with clear', () => {
  beforeEach(() => {
    jest
      .mocked(vscode.env.clipboard.readText)
      .mockResolvedValueOnce('existing clipboard content') // original clipboard
      .mockResolvedValueOnce(CLIPBOARD_RESET_PLACEHOLDER) // after selection attempt
      .mockResolvedValueOnce('clear\n'); // after last command
  });

  it('returns undefined when last command is clear', async () => {
    const result = await getTerminalAIContext();
    expect(result).toBeUndefined();
  });

  it('still restores the original clipboard content', async () => {
    await getTerminalAIContext();
    expect(vscode.env.clipboard.writeText).toHaveBeenCalledTimes(2);
    expect(jest.mocked(vscode.env.clipboard.writeText).mock.calls.at(1)).toEqual([
      'existing clipboard content',
    ]);
  });
});
