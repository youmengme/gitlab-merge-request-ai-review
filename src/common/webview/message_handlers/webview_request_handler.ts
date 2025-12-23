import { log } from '../../log';
import { WebviewMessageRegistry } from './webview_message_registry';
import { isWebviewMessage } from './webview_message';

export const handleWebviewRequest =
  (handlerRegistry: WebviewMessageRegistry) =>
  async (message: unknown): Promise<unknown> => {
    if (!isWebviewMessage(message)) {
      log.debug(`Received invalid request message: ${JSON.stringify(message)}`);
      return { error: 'Invalid request message' };
    }

    const { pluginId, type, payload } = message;
    try {
      const result = await handlerRegistry.handleRequest(pluginId, { type, payload });
      return result;
    } catch (error) {
      log.error(
        `Failed to handle request for pluginId: ${pluginId}, type: ${type}, payload: ${JSON.stringify(payload)}`,
        error as Error,
      );
      return { error };
    }
  };
