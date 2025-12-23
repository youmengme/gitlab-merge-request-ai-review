import { ExtensionContext, Uri } from 'vscode';

class ContextUtils {
  #context: ExtensionContext | undefined;

  init(context: ExtensionContext) {
    this.#context = context;
  }

  getEmbededFileUri(...path: string[]) {
    if (!this.#context) {
      throw new Error('Context Utils is not initialized');
    }
    return Uri.joinPath(this.#context.extensionUri, ...path);
  }
}

export const contextUtils = new ContextUtils();
