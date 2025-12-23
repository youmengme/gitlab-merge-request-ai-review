import { Terminal, window, Disposable } from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import { createInterfaceId } from '@gitlab/needle';
import { log } from '../log';

const SHELL_INTEGRATION_TIMEOUT_MS = 3000;

const lookupKey = (workflowId: string, silent: boolean) => {
  return `${workflowId}-${silent}`;
};

export interface TerminalManager extends Disposable {
  setupRequests(client: BaseLanguageClient): void;
}

export const TerminalManager = createInterfaceId<TerminalManager>('TerminalManager');

export class TerminalManagerImpl implements TerminalManager {
  #terminals: Map<string, Terminal>;

  #disposables: Disposable[] = [];

  constructor() {
    this.#terminals = new Map();
  }

  setupRequests(client: BaseLanguageClient) {
    this.#disposables.push(
      client.onRequest('$/gitlab/runCommand', async ({ workflowId, command, args, silent }) => {
        log.debug(`Running command: ${command} ${args?.join(' ')}`);

        return this.#executeCommand(workflowId, command, args, silent);
      }),
    );

    this.#disposables.push(
      window.onDidCloseTerminal(closedTerminal => {
        for (const [workflowId, terminal] of this.#terminals.entries()) {
          if (terminal === closedTerminal) {
            this.#terminals.delete(workflowId);
            break;
          }
        }
      }),
    );
  }

  async #executeCommand(
    workflowId: string,
    command: string,
    args: string[] | undefined,
    silent: boolean,
  ): Promise<{ exitCode: number; output: string }> {
    const terminal = await this.#getOrCreateTerminal(workflowId, silent);

    if (!terminal.shellIntegration) {
      log.warn('Terminal lost shell integration, recreating...');
      this.#terminals.delete(lookupKey(workflowId, silent));
      terminal.dispose();
      return this.#executeCommand(workflowId, command, args, silent);
    }

    if (!silent) {
      terminal.show(true);
    }

    const exec = args
      ? terminal.shellIntegration.executeCommand(command, args)
      : terminal.shellIntegration.executeCommand(command);

    const executionEndPromise = new Promise<number>(resolve => {
      const disposable = window.onDidEndTerminalShellExecution(({ execution, exitCode }) => {
        if (exec === execution) {
          disposable.dispose();
          resolve(exitCode ?? 0);
        }
      });
    });

    const output: string[] = [];

    try {
      const stream = exec.read();
      for await (const data of stream) {
        output.push(data);
      }
    } catch (error) {
      log.error('Error reading stream:', error);
    }

    const exitCode = await executionEndPromise;

    return { exitCode, output: output.join('') };
  }

  async #getOrCreateTerminal(workflowId: string, silent: boolean) {
    return (
      this.#terminals.get(lookupKey(workflowId, silent)) ?? this.#createTerminal(workflowId, silent)
    );
  }

  async #createTerminal(workflowId: string, silent: boolean) {
    const terminal = window.createTerminal({
      name: `GitLab Duo Agent Platform ${workflowId}`,
      isTransient: true,
      hideFromUser: silent,
    });

    try {
      await this.#listenForShellIntegration(terminal);
      this.#terminals.set(lookupKey(workflowId, silent), terminal);
      return terminal;
    } catch (error) {
      terminal.dispose();
      throw error;
    }
  }

  #listenForShellIntegration(term: Terminal) {
    return new Promise<Terminal>((resolve, reject) => {
      if (term.shellIntegration) {
        resolve(term);
        return;
      }

      let isSettled = false;
      const disposable = window.onDidChangeTerminalShellIntegration(
        ({ terminal, shellIntegration }) => {
          if (term === terminal && shellIntegration) {
            isSettled = true;
            disposable.dispose();
            clearTimeout(timeoutId);
            resolve(terminal);
          }
        },
      );

      const timeoutId = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          disposable.dispose();
          reject(new Error('User does not have shell integration configured'));
        }
      }, SHELL_INTEGRATION_TIMEOUT_MS);
    });
  }

  dispose() {
    this.#terminals.forEach(term => {
      term.dispose();
    });

    this.#disposables.forEach(disposable => {
      disposable.dispose();
    });
  }
}
