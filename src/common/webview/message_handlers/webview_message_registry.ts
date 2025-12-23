import { createInterfaceId } from '@gitlab/needle';
import { log } from '../../log';
import { Notifier, NotifyFn } from '../../language_server/notifier';
import { Requester, RequestFn } from '../../language_server/requester';

type NotificationHandler = (payload: unknown) => Promise<void> | void;
type RequestHandler = (payload: unknown) => Promise<unknown> | unknown;

export interface WebviewMessageRegistry extends Notifier<unknown>, Requester<unknown> {
  onRequest(webviewId: string, messageId: string, handler: RequestHandler): void;
  onNotification(webviewId: string, messageId: string, handler: NotificationHandler): void;
  getRequestHandler(webviewId: string, messageId: string): RequestHandler | undefined;
  getNotificationHandler(webviewId: string, messageId: string): NotificationHandler | undefined;
  handleRequest(webviewId: string, message: { type: string; payload: unknown }): Promise<unknown>;
  handleNotification(webviewId: string, message: { type: string; payload: unknown }): Promise<void>;
  sendNotification(webviewId: string, type: string, payload: unknown): Promise<void>;
  sendRequest(webviewId: string, type: string, payload: unknown): Promise<unknown>;
}

export const WebviewMessageRegistry =
  createInterfaceId<WebviewMessageRegistry>('WebviewMessageRegistry');

export class WebviewMessageRegistryImpl implements WebviewMessageRegistry {
  #requestHandlers: Map<string, Map<string, RequestHandler>> = new Map();

  #notificationHandlers: Map<string, Map<string, NotificationHandler>> = new Map();

  #notify: NotifyFn<unknown> | undefined;

  #request: RequestFn<unknown> | undefined;

  initNotifier(notify: NotifyFn<unknown>) {
    this.#notify = notify;
  }

  initRequester(request: RequestFn<unknown>) {
    this.#request = request;
  }

  onRequest(webviewId: string, messageId: string, handler: RequestHandler) {
    if (!this.#requestHandlers.has(webviewId)) {
      this.#requestHandlers.set(webviewId, new Map());
    }
    const webviewHandlers = this.#requestHandlers.get(webviewId);
    if (webviewHandlers) {
      webviewHandlers.set(messageId, handler);
    }
  }

  onNotification(webviewId: string, messageId: string, handler: NotificationHandler) {
    if (!this.#notificationHandlers.has(webviewId)) {
      this.#notificationHandlers.set(webviewId, new Map());
    }
    const webviewHandlers = this.#notificationHandlers.get(webviewId);
    if (webviewHandlers) {
      webviewHandlers.set(messageId, handler);
    }
  }

  getRequestHandler(webviewId: string, messageId: string): RequestHandler | undefined {
    return this.#requestHandlers.get(webviewId)?.get(messageId);
  }

  getNotificationHandler(webviewId: string, messageId: string): NotificationHandler | undefined {
    return this.#notificationHandlers.get(webviewId)?.get(messageId);
  }

  async handleRequest(
    webviewId: string,
    message: { type: string; payload: unknown },
  ): Promise<unknown> {
    const { type, payload } = message;
    const handler = this.getRequestHandler(webviewId, type);

    if (!handler) {
      log.error(`No request handler found for webview '${webviewId}' and message '${type}'`);
      return undefined;
    }

    try {
      const result = await handler(payload);
      return result;
    } catch (error) {
      log.error(`Error handling request '${type}' for webview '${webviewId}':`, error);
      return undefined;
    }
  }

  async handleNotification(
    webviewId: string,
    message: { type: string; payload: unknown },
  ): Promise<void> {
    const { type, payload } = message;
    const handler = this.getNotificationHandler(webviewId, type);

    if (!handler) {
      log.warn(`No notification handler found for webview '${webviewId}' and message '${type}'`);
      return;
    }

    try {
      await handler(payload);
    } catch (error) {
      log.error(`Error handling notification '${type}' for webview '${webviewId}':`, error);
    }
  }

  async sendNotification(webviewId: string, type: string, payload: unknown): Promise<void> {
    if (!this.#notify) {
      log.error(
        `No notifier function was registered. Message '${type}' won't be sent to  webview '${webviewId}'`,
      );
      return;
    }

    try {
      await this.#notify({
        pluginId: webviewId,
        type,
        payload,
      });
    } catch (error) {
      log.error(`Error sending notification '${type}' for webview '${webviewId}':`, error);
    }
  }

  async sendRequest(webviewId: string, type: string, payload: unknown): Promise<unknown> {
    if (!this.#request) {
      log.error(
        `No request function was registered. Message '${type}' won't be sent to  webview '${webviewId}'`,
      );
      return undefined;
    }

    return this.#request({
      pluginId: webviewId,
      type,
      payload,
    });
  }
}
