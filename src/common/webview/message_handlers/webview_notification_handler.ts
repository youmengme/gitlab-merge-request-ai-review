import { log } from '../../log';
import { WebviewMessageRegistry } from './webview_message_registry';
import { isWebviewMessage } from './webview_message';

export const handleWebviewNotification =
  (handlerRegistry: WebviewMessageRegistry) => async (message: unknown) => {
    if (!isWebviewMessage(message)) {
      log.debug(`Received invalid notification: ${JSON.stringify(message)}`);
      return;
    }

    const { pluginId, type, payload } = message;
    try {
      await handlerRegistry.handleNotification(pluginId, { type, payload });
    } catch (error) {
      log.error(
        `Failed to handle notification for pluginId: ${pluginId}, type: ${type}, payload: ${JSON.stringify(payload)}`,
        error as Error,
      );
    }
  };
