import * as vscode from 'vscode';
import { doNotAwait } from '../utils/do_not_await';

type Progress = Parameters<Parameters<typeof vscode.window.withProgress>[1]>[0];

export class GenerationIndicator implements vscode.Disposable {
  #resolveProgressNotification?: (val: unknown) => void;

  #progress?: Progress;

  start() {
    doNotAwait(
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Duo: Generating Code Suggestions',
          cancellable: false,
        },
        progress => {
          this.#progress = progress;
          return new Promise(res => {
            this.#resolveProgressNotification = res;
          });
        },
      ),
    );
  }

  increment() {
    this.#progress?.report({ increment: 2 });
  }

  dispose() {
    this.#resolveProgressNotification?.(undefined);
  }
}
