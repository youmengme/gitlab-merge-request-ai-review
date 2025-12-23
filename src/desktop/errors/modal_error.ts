import * as vscode from 'vscode';
import { UiError } from '../../common/errors/ui_error';
import { DetailedError, isDetailedError, stackToArray } from '../../common/errors/common';

export class ModalError extends Error implements UiError, DetailedError {
  originalError?: Error;

  title: string;

  detail?: string;

  constructor(title: string, detail?: string, originalError?: Error) {
    super(originalError?.message ?? title, { cause: originalError });
    this.title = title;
    this.detail = detail;
    this.originalError = originalError;
  }

  get details() {
    return {
      title: this.title,
      detail: this.detail,
      errorMessage: this.originalError?.message,
      stack: stackToArray(this.originalError?.stack),
      details: isDetailedError(this.originalError) ? this.originalError.details : undefined,
    };
  }

  async showUi(): Promise<void> {
    await vscode.window.showErrorMessage(this.title, { modal: true, detail: this.detail });
  }
}
