/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE https://github.com/microsoft/vscode-languageserver-node/blob/60d4ecb5d6034d628bcc3a70b3c9359232360f07/License.txt
 *  Original code in https://github.com/microsoft/vscode-languageserver-node/blob/60d4ecb5d6034d628bcc3a70b3c9359232360f07/client/src/common/utils/async.ts#L92
 *--------------------------------------------------------------------------------------------*/
import { RAL } from 'vscode-languageclient';

type Thunk<T> = () => T;

type Waiting<T> = {
  thunk: Thunk<T | PromiseLike<T>>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

// disabling eslint so we can copy the original code verbatim
/* eslint-disable */
export class Semaphore<T = void> {
  private _capacity: number;
  private _active: number;
  private _waiting: Waiting<T>[];

  public constructor(capacity: number = 1) {
    if (capacity <= 0) {
      throw new Error('Capacity must be greater than 0');
    }
    this._capacity = capacity;
    this._active = 0;
    this._waiting = [];
  }

  public lock(thunk: () => T | PromiseLike<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this._waiting.push({ thunk, resolve, reject });
      this.runNext();
    });
  }

  public get active(): number {
    return this._active;
  }

  private runNext(): void {
    if (this._waiting.length === 0 || this._active === this._capacity) {
      return;
    }
    RAL().timer.setImmediate(() => this.doRunNext());
  }

  private doRunNext(): void {
    if (this._waiting.length === 0 || this._active === this._capacity) {
      return;
    }
    const next = this._waiting.shift()!;
    this._active++;
    if (this._active > this._capacity) {
      throw new Error(`To many thunks active`);
    }
    try {
      const result = next.thunk();
      if (result instanceof Promise) {
        result.then(
          value => {
            this._active--;
            next.resolve(value);
            this.runNext();
          },
          err => {
            this._active--;
            next.reject(err);
            this.runNext();
          },
        );
      } else {
        this._active--;
        next.resolve(result);
        this.runNext();
      }
    } catch (err) {
      this._active--;
      next.reject(err);
      this.runNext();
    }
  }
}
