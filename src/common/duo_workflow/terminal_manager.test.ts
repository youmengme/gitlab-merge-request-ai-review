import {
  Terminal,
  TerminalShellExecution,
  TerminalShellExecutionEndEvent,
  TerminalShellIntegration,
  TerminalShellIntegrationChangeEvent,
  window,
} from 'vscode';
import { BaseLanguageClient, GenericRequestHandler } from 'vscode-languageclient';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { TerminalManager, TerminalManagerImpl } from './terminal_manager';

type RunCommandResult = {
  output: string;
  exitCode: number | undefined;
};
type RunCommandEventHandler = GenericRequestHandler<RunCommandResult, Error>;

describe('Terminal Manager', () => {
  let mockClient: BaseLanguageClient;
  let terminalManager: TerminalManager;
  let mockShellIntegrationGetter: jest.Mock;
  let mockShellIntegration: TerminalShellIntegration;
  let mockExecution: TerminalShellExecution;
  let mockTerminal: Terminal;

  beforeEach(() => {
    mockClient = createFakePartial<BaseLanguageClient>({
      onRequest: jest.fn(),
    });
    mockShellIntegrationGetter = jest.fn();
    mockExecution = createFakePartial<TerminalShellExecution>({
      read: jest.fn(),
    });
    mockShellIntegration = createFakePartial<TerminalShellIntegration>({
      executeCommand: jest.fn(),
    });
    mockTerminal = createFakePartial<Terminal>({
      get shellIntegration() {
        return mockShellIntegrationGetter();
      },
      show: jest.fn(),
      dispose: jest.fn(),
    });

    jest.mocked(window.createTerminal).mockReturnValue(mockTerminal);

    terminalManager = new TerminalManagerImpl();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('setup requests', () => {
    it('listens to `$/gitlab/runCommand` events', () => {
      terminalManager.setupRequests(mockClient);

      expect(mockClient.onRequest).toHaveBeenCalledWith(
        '$/gitlab/runCommand',
        expect.any(Function),
      );
    });

    it('listens to onDidCloseTerminal event', () => {
      terminalManager.setupRequests(mockClient);

      expect(window.onDidCloseTerminal).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('dispose', () => {
    let eventFn: RunCommandEventHandler;
    let shellExecutionFn: (e: TerminalShellExecutionEndEvent) => Disposable;
    let listenerDispose: jest.Mock;
    let closeTerminalDispose: jest.Mock;

    beforeEach(async () => {
      listenerDispose = jest.fn();
      closeTerminalDispose = jest.fn();
      jest.mocked(mockClient.onRequest).mockImplementation((event: string, fn) => {
        if (event === '$/gitlab/runCommand') {
          eventFn = fn as RunCommandEventHandler;
        }
        return { dispose: listenerDispose };
      });
      jest.mocked(window.onDidEndTerminalShellExecution).mockImplementation(fn => {
        shellExecutionFn = fn;
        return { dispose() {} };
      });
      jest.mocked(window.onDidCloseTerminal).mockImplementationOnce(() => {
        return { dispose: closeTerminalDispose };
      });
      jest.mocked(mockShellIntegration.executeCommand).mockReturnValue(mockExecution);

      terminalManager.setupRequests(mockClient);

      const workflowId = '1234';
      const command = 'npm';
      const args = ['run', 'test:unit'];
      mockShellIntegrationGetter.mockReturnValue(mockShellIntegration);

      jest.mocked(mockExecution.read).mockImplementation(async function* read() {
        yield '';
      });

      const result = eventFn({ workflowId, command, args, silent: false });

      await jest.advanceTimersByTimeAsync(3000); // Shell integration timer

      shellExecutionFn({
        execution: mockExecution,
        exitCode: 0,
        terminal: mockTerminal,
        shellIntegration: mockShellIntegration,
      });

      await result;
      jest.clearAllTimers();
    });

    it('disposes all terminals and request listener', async () => {
      terminalManager.dispose();

      expect(listenerDispose).toHaveBeenCalled();
      expect(closeTerminalDispose).toHaveBeenCalled();
      expect(mockTerminal.dispose).toHaveBeenCalled();
    });
  });

  describe('$/gitlab/runCommand', () => {
    const workflowId = '1234';
    const command = 'npm';
    const silent = false;
    const args = ['run', 'test:unit'];
    let eventFn: RunCommandEventHandler;
    let shellIntegrationFn: (e: TerminalShellIntegrationChangeEvent) => Disposable;
    let shellExecutionFn: (e: TerminalShellExecutionEndEvent) => Disposable;
    let onDidCloseTerminalListener: (terminal: Terminal) => void;
    let shellExecDispose: jest.Mock;
    let shellIntDispose: jest.Mock;

    beforeEach(() => {
      shellExecDispose = jest.fn();
      shellIntDispose = jest.fn();
      onDidCloseTerminalListener = jest.fn();

      jest.mocked(mockClient.onRequest).mockImplementation((event: string, fn) => {
        if (event === '$/gitlab/runCommand') {
          eventFn = fn as RunCommandEventHandler;
        }
        return { dispose() {} };
      });
      jest.mocked(window.onDidChangeTerminalShellIntegration).mockImplementation(fn => {
        shellIntegrationFn = fn;
        return { dispose: shellIntDispose };
      });
      jest.mocked(window.onDidEndTerminalShellExecution).mockImplementation(fn => {
        shellExecutionFn = fn;
        return { dispose: shellExecDispose };
      });
      jest.mocked(mockShellIntegration.executeCommand).mockReturnValue(mockExecution);
      jest.mocked(window.onDidCloseTerminal).mockImplementationOnce(listener => {
        onDidCloseTerminalListener = listener;

        return { dispose() {} };
      });

      terminalManager.setupRequests(mockClient);
    });

    it('executes a command when the shell integration is available', async () => {
      const processOutput = ['running tests...\n', 'all tests passed!'];
      mockShellIntegrationGetter.mockReturnValue(undefined);

      jest.mocked(mockExecution.read).mockImplementation(async function* read() {
        for (const line of processOutput) {
          yield line;
        }
      });

      const result = eventFn({ workflowId, command, args, silent });

      // Trigger shell integration becoming available
      shellIntegrationFn({ terminal: mockTerminal, shellIntegration: mockShellIntegration });
      mockShellIntegrationGetter.mockReturnValue(mockShellIntegration);

      // Advance only the shell integration timeout (3 seconds)
      await jest.advanceTimersByTimeAsync(3000);

      // Complete the execution
      shellExecutionFn({
        execution: mockExecution,
        exitCode: 0,
        terminal: mockTerminal,
        shellIntegration: mockShellIntegration,
      });

      expect(window.createTerminal).toHaveBeenCalledWith({
        name: `GitLab Duo Agent Platform ${workflowId}`,
        isTransient: true,
        hideFromUser: silent,
      });

      expect(window.onDidChangeTerminalShellIntegration).toHaveBeenCalled();

      expect(mockTerminal.show).toHaveBeenCalled();
      expect(mockShellIntegration.executeCommand).toHaveBeenCalledWith(command, args);
      expect(mockExecution.read).toHaveBeenCalled();
      expect(window.onDidEndTerminalShellExecution).toHaveBeenCalled();
      expect(shellExecDispose).toHaveBeenCalled();
      expect(shellIntDispose).toHaveBeenCalled();

      const { output, exitCode } = (await result) as unknown as RunCommandResult;
      expect(output).toBe(processOutput.join(''));
      expect(exitCode).toBe(0);
    });

    it('reuses a terminal when the same workflow ID and silent flag are used', async () => {
      mockShellIntegrationGetter.mockReturnValue(mockShellIntegration);

      jest.mocked(mockExecution.read).mockImplementation(async function* read() {
        yield '';
      });

      const firstResult = eventFn({ workflowId, command, args, silent });

      // Advance shell integration timer for initial terminal creation
      await jest.advanceTimersByTimeAsync(3000);

      shellExecutionFn({
        execution: mockExecution,
        exitCode: 0,
        terminal: mockTerminal,
        shellIntegration: mockShellIntegration,
      });

      await firstResult;

      // Reset execution mock for second call
      const mockExecution2 = createFakePartial<TerminalShellExecution>({
        read: jest.fn(),
      });

      jest.mocked(mockExecution2.read).mockImplementation(async function* read() {
        yield '';
      });

      jest.mocked(mockShellIntegration.executeCommand).mockReturnValue(mockExecution2);

      // Second call should reuse the terminal
      const secondResult = eventFn({ workflowId, command, args, silent });

      // Let microtasks run
      await Promise.resolve();

      // Complete the second execution
      shellExecutionFn({
        execution: mockExecution2,
        exitCode: 0,
        terminal: mockTerminal,
        shellIntegration: mockShellIntegration,
      });

      await secondResult;

      expect(window.createTerminal).toHaveBeenCalledTimes(1);
    });

    it('creates separate terminals for same workflow ID but different silent flags', async () => {
      const mockTerminalSilent = createFakePartial<Terminal>({
        get shellIntegration() {
          return mockShellIntegrationGetter();
        },
        show: jest.fn(),
        dispose: jest.fn(),
      });

      jest
        .mocked(window.createTerminal)
        .mockReturnValueOnce(mockTerminal)
        .mockReturnValueOnce(mockTerminalSilent);

      mockShellIntegrationGetter.mockReturnValue(mockShellIntegration);

      jest.mocked(mockExecution.read).mockImplementation(async function* read() {
        yield '';
      });

      const firstResult = eventFn({ workflowId, command, args, silent: false });

      // Advance shell integration timer
      await jest.advanceTimersByTimeAsync(3000);

      shellExecutionFn({
        execution: mockExecution,
        exitCode: 0,
        terminal: mockTerminal,
        shellIntegration: mockShellIntegration,
      });

      await firstResult;

      const secondResult = eventFn({ workflowId, command, args, silent: true });

      // Advance shell integration timer for second terminal
      await jest.advanceTimersByTimeAsync(3000);

      shellExecutionFn({
        execution: mockExecution,
        exitCode: 0,
        terminal: mockTerminalSilent,
        shellIntegration: mockShellIntegration,
      });

      await secondResult;

      expect(window.createTerminal).toHaveBeenCalledTimes(2);
      expect(window.createTerminal).toHaveBeenNthCalledWith(1, {
        name: `GitLab Duo Agent Platform ${workflowId}`,
        isTransient: true,
        hideFromUser: false,
      });
      expect(window.createTerminal).toHaveBeenNthCalledWith(2, {
        name: `GitLab Duo Agent Platform ${workflowId}`,
        isTransient: true,
        hideFromUser: true,
      });

      expect(mockTerminal.show).toHaveBeenCalled();
      expect(mockTerminalSilent.show).not.toHaveBeenCalled();
    });

    it('re-creates terminal if the terminal is closed', async () => {
      mockShellIntegrationGetter.mockReturnValue(mockShellIntegration);

      jest.mocked(mockExecution.read).mockImplementation(async function* read() {
        yield '';
      });

      let result = eventFn({ workflowId, command, args, silent });

      await jest.advanceTimersByTimeAsync(3000); // Shell integration timer

      shellExecutionFn({
        execution: mockExecution,
        exitCode: 0,
        terminal: mockTerminal,
        shellIntegration: mockShellIntegration,
      });

      await result;
      jest.clearAllTimers(); // Clear any remaining timers after first execution

      expect(window.createTerminal).toHaveBeenCalledTimes(1);

      onDidCloseTerminalListener(mockTerminal);

      result = eventFn({ workflowId, command, args, silent });

      await jest.advanceTimersByTimeAsync(3000); // Shell integration timer for second terminal

      shellExecutionFn({
        execution: mockExecution,
        exitCode: 0,
        terminal: mockTerminal,
        shellIntegration: mockShellIntegration,
      });

      await result;
      jest.clearAllTimers(); // Clear any remaining timers after second execution

      expect(window.createTerminal).toHaveBeenCalledTimes(2);
    });

    it('throws when shell integration is not available after timeout', async () => {
      mockShellIntegrationGetter.mockReturnValue(undefined);

      const result = eventFn({ workflowId, command, args, silent });

      // Prevent unhandled rejection warning
      Promise.resolve(result).catch(() => {});

      await jest.advanceTimersByTimeAsync(3000);

      await expect(result).rejects.toThrow(
        new Error('User does not have shell integration configured'),
      );
    });

    it('recreates terminal when shell integration is lost during execution', async () => {
      const mockTerminal2 = createFakePartial<Terminal>({
        get shellIntegration() {
          return mockShellIntegration;
        },
        show: jest.fn(),
        dispose: jest.fn(),
      });

      jest
        .mocked(window.createTerminal)
        .mockReturnValueOnce(mockTerminal)
        .mockReturnValueOnce(mockTerminal2);

      // First call returns shell integration, second call returns undefined (lost integration)
      mockShellIntegrationGetter
        .mockReturnValueOnce(mockShellIntegration)
        .mockReturnValueOnce(undefined);

      jest.mocked(mockExecution.read).mockImplementation(async function* read() {
        yield 'test output';
      });

      const result = eventFn({ workflowId, command, args, silent });

      // Advance shell integration timer for first terminal
      await jest.advanceTimersByTimeAsync(3000);

      // Now when executeCommand checks shellIntegration, it will be undefined
      // This triggers the recreation logic

      // Advance shell integration timer for second terminal
      await jest.advanceTimersByTimeAsync(3000);

      // Complete the execution on the new terminal
      shellExecutionFn({
        execution: mockExecution,
        exitCode: 0,
        terminal: mockTerminal2,
        shellIntegration: mockShellIntegration,
      });

      await result;

      expect(mockTerminal.dispose).toHaveBeenCalled();
      expect(window.createTerminal).toHaveBeenCalledTimes(2);
    });

    it('handles stream reading errors gracefully', async () => {
      mockShellIntegrationGetter.mockReturnValue(mockShellIntegration);

      const streamError = new Error('Stream read failed');
      // eslint-disable-next-line require-yield
      jest.mocked(mockExecution.read).mockImplementation(async function* read() {
        throw streamError;
      });

      const result = eventFn({ workflowId, command, args, silent });

      // Advance shell integration timer
      await jest.advanceTimersByTimeAsync(3000);

      shellExecutionFn({
        execution: mockExecution,
        exitCode: 1,
        terminal: mockTerminal,
        shellIntegration: mockShellIntegration,
      });

      const { output, exitCode } = (await result) as unknown as RunCommandResult;

      // Should complete with empty output despite stream error
      expect(output).toBe('');
      expect(exitCode).toBe(1);
    });

    it('clears disposables on successful execution', async () => {
      mockShellIntegrationGetter.mockReturnValue(mockShellIntegration);

      jest.mocked(mockExecution.read).mockImplementation(async function* read() {
        yield 'output';
      });

      const result = eventFn({ workflowId, command, args, silent });

      // Advance shell integration timer
      await jest.advanceTimersByTimeAsync(3000);

      shellExecutionFn({
        execution: mockExecution,
        exitCode: 0,
        terminal: mockTerminal,
        shellIntegration: mockShellIntegration,
      });

      await result;

      expect(shellExecDispose).toHaveBeenCalled();

      // Verify no pending timers (they were cleared)
      expect(jest.getTimerCount()).toBe(0);
    });

    it('handles exitCode being undefined', async () => {
      mockShellIntegrationGetter.mockReturnValue(mockShellIntegration);

      jest.mocked(mockExecution.read).mockImplementation(async function* read() {
        yield 'output';
      });

      const result = eventFn({ workflowId, command, args, silent });

      // Advance shell integration timer
      await jest.advanceTimersByTimeAsync(3000);

      shellExecutionFn({
        execution: mockExecution,
        exitCode: undefined,
        terminal: mockTerminal,
        shellIntegration: mockShellIntegration,
      });

      const { exitCode } = (await result) as unknown as RunCommandResult;

      // Should default to 0 when exitCode is undefined
      expect(exitCode).toBe(0);
    });

    it('does not show terminal when silent flag is true', async () => {
      mockShellIntegrationGetter.mockReturnValue(mockShellIntegration);

      jest.mocked(mockExecution.read).mockImplementation(async function* read() {
        yield '';
      });

      const result = eventFn({ workflowId, command, args, silent: true });

      // Advance shell integration timer
      await jest.advanceTimersByTimeAsync(3000);

      shellExecutionFn({
        execution: mockExecution,
        exitCode: 0,
        terminal: mockTerminal,
        shellIntegration: mockShellIntegration,
      });

      await result;

      expect(mockTerminal.show).not.toHaveBeenCalled();
    });

    describe('when `args` is undefined', () => {
      let result: Promise<unknown>;
      const preBuildShellCommand = 'npm run test:unit | grep FAILED';

      beforeEach(async () => {
        mockShellIntegrationGetter.mockReturnValue(mockShellIntegration);

        jest.mocked(mockExecution.read).mockImplementation(async function* read() {
          yield 'output';
        });

        result = eventFn({
          workflowId,
          command: preBuildShellCommand,
          args: undefined,
          silent,
        }) as Promise<unknown>;

        await jest.advanceTimersByTimeAsync(3000);
      });

      it('executes full pre-built shell command', async () => {
        shellExecutionFn({
          execution: mockExecution,
          exitCode: 0,
          terminal: mockTerminal,
          shellIntegration: mockShellIntegration,
        });

        await result;

        expect(mockShellIntegration.executeCommand).toHaveBeenCalledWith(preBuildShellCommand);
      });
    });
  });
});
