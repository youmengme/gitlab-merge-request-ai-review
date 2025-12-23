import { log } from '../../log';
import { WebviewMessageRegistryImpl } from './webview_message_registry';

jest.mock('../../log');

describe('WebviewMessageRegistry', () => {
  let registry: WebviewMessageRegistryImpl;

  beforeEach(() => {
    registry = new WebviewMessageRegistryImpl();
    jest.clearAllMocks();
  });

  describe('registerRequestHandler', () => {
    it('registers a request handler for a specific webview and message type', () => {
      const handler = jest.fn();
      registry.onRequest('webview1', 'message1', handler);

      const retrievedHandler = registry.getRequestHandler('webview1', 'message1');
      expect(retrievedHandler).toBe(handler);
    });
  });

  describe('registerNotificationHandler', () => {
    it('registers a notification handler for a specific webview and message type', () => {
      const handler = jest.fn();
      registry.onNotification('webview1', 'message1', handler);

      const retrievedHandler = registry.getNotificationHandler('webview1', 'message1');
      expect(retrievedHandler).toBe(handler);
    });
  });

  describe('getRequestHandler', () => {
    it('returns undefined if no handler is registered', () => {
      const handler = registry.getRequestHandler('webview1', 'message1');
      expect(handler).toBeUndefined();
    });
  });

  describe('getNotificationHandler', () => {
    it('returns undefined if no handler is registered', () => {
      const handler = registry.getNotificationHandler('webview1', 'message1');
      expect(handler).toBeUndefined();
    });
  });

  describe('handleRequest', () => {
    it('calls the registered request handler and returns its result', async () => {
      const handler = jest.fn().mockResolvedValue('response');
      registry.onRequest('webview1', 'message1', handler);

      const result = await registry.handleRequest('webview1', {
        type: 'message1',
        payload: 'test',
      });

      expect(handler).toHaveBeenCalledWith('test');
      expect(result).toBe('response');
    });

    it('logs an error and returns undefined if no handler is found', async () => {
      const result = await registry.handleRequest('webview1', {
        type: 'message1',
        payload: 'test',
      });

      expect(log.error).toHaveBeenCalledWith(
        "No request handler found for webview 'webview1' and message 'message1'",
      );
      expect(result).toBeUndefined();
    });

    it('logs an error and returns undefined if the handler throws an error', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      registry.onRequest('webview1', 'message1', handler);

      const result = await registry.handleRequest('webview1', {
        type: 'message1',
        payload: 'test',
      });

      expect(log.error).toHaveBeenCalledWith(
        "Error handling request 'message1' for webview 'webview1':",
        expect.any(Error),
      );
      expect(result).toBeUndefined();
    });
  });

  describe('handleNotification', () => {
    it('calls the registered notification handler', async () => {
      const handler = jest.fn();
      registry.onNotification('webview1', 'message1', handler);

      await registry.handleNotification('webview1', { type: 'message1', payload: 'test' });

      expect(handler).toHaveBeenCalledWith('test');
    });

    it('logs a warning if no handler is found', async () => {
      await registry.handleNotification('webview1', { type: 'message1', payload: 'test' });

      expect(log.warn).toHaveBeenCalledWith(
        "No notification handler found for webview 'webview1' and message 'message1'",
      );
    });

    it('logs an error if the handler throws an error', async () => {
      const handler = jest.fn(() => {
        throw new Error('Handler error');
      });
      registry.onNotification('webview1', 'message1', handler);

      await registry.handleNotification('webview1', { type: 'message1', payload: 'test' });

      expect(log.error).toHaveBeenCalledWith(
        "Error handling notification 'message1' for webview 'webview1':",
        expect.any(Error),
      );
    });
  });

  describe('sendNotification', () => {
    it('calls the notify function with the correct parameters', async () => {
      const mockNotify = jest.fn();
      registry.initNotifier(mockNotify);

      const webviewId = 'testWebview';
      const type = 'testType';
      const payload = { data: 'testData' };

      await registry.sendNotification(webviewId, type, payload);

      expect(mockNotify).toHaveBeenCalledWith({
        pluginId: webviewId,
        type,
        payload,
      });
    });

    it('logs an error if notify function is not registered', async () => {
      const webviewId = 'testWebview';
      const type = 'testType';
      const payload = { data: 'testData' };

      await registry.sendNotification(webviewId, type, payload);

      expect(log.error).toHaveBeenCalledWith(
        "No notifier function was registered. Message 'testType' won't be sent to  webview 'testWebview'",
      );
    });

    it('logs an error if notify function throws', async () => {
      const mockNotify = jest.fn().mockRejectedValue(new Error('Notify error'));
      registry.initNotifier(mockNotify);

      const webviewId = 'testWebview';
      const type = 'testType';
      const payload = { data: 'testData' };

      await registry.sendNotification(webviewId, type, payload);

      expect(log.error).toHaveBeenCalledWith(
        "Error sending notification 'testType' for webview 'testWebview':",
        expect.any(Error),
      );
    });
  });

  describe('sendRequest', () => {
    it('calls the request function with the correct parameters and returns its result', async () => {
      const mockRequest = jest.fn().mockResolvedValue('response');
      registry.initRequester(mockRequest);

      const webviewId = 'testWebview';
      const type = 'testType';
      const payload = { data: 'testData' };

      const result = await registry.sendRequest(webviewId, type, payload);

      expect(mockRequest).toHaveBeenCalledWith({
        pluginId: webviewId,
        type,
        payload,
      });
      expect(result).toBe('response');
    });

    it('should not send the request if request function is not registered', async () => {
      const webviewId = 'testWebview';
      const type = 'testType';
      const payload = { data: 'testData' };

      const result = await registry.sendRequest(webviewId, type, payload);

      expect(result).toBeUndefined();
    });

    it('rethrows exceptions if the request fails', async () => {
      const mockRequest = jest.fn().mockRejectedValue(new Error('Request error'));
      registry.initRequester(mockRequest);

      const webviewId = 'testWebview';
      const type = 'testType';
      const payload = { data: 'testData' };

      await expect(registry.sendRequest(webviewId, type, payload)).rejects.toThrow();
    });
  });
});
