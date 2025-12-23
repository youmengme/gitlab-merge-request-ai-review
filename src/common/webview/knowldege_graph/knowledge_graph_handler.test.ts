import { KNOWLEDGE_GRAPH_WEBVIEW_ID } from '../../constants';
import { WebviewMessageRegistry } from '../message_handlers/webview_message_registry';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { KnowledgeGraphWebview } from './knowledge_graph_webview';
import { registerKnowledgeGraphHandlers, ready } from './knowledge_graph_handler';

jest.mock('../../constants');
jest.mock('../../log');
jest.mock('./knowledge_graph_webview');

describe('knowledge_graph_handler', () => {
  let mockRegistry: WebviewMessageRegistry;
  let mockWebview: KnowledgeGraphWebview;

  beforeEach(() => {
    mockRegistry = createFakePartial<WebviewMessageRegistry>({
      onNotification: jest.fn(),
      sendRequest: jest.fn(),
    });

    mockWebview = createFakePartial<KnowledgeGraphWebview>({
      start: jest.fn(),
    });
  });

  describe('ready', () => {
    it('should call starts the webview with the url when valid params are provided', async () => {
      const url = 'https://example.com/knowledge-graph';
      const params = { url };

      await ready(mockWebview, params);

      expect(mockWebview.start).toHaveBeenCalledWith(url);
    });

    it('should not call start with undefined when url is not provided', async () => {
      const params = { url: undefined };

      await ready(mockWebview, params);

      expect(mockWebview.start).not.toHaveBeenCalled();
    });
  });

  describe('registerKnowledgeGraphHandlers', () => {
    it('should register a notification handler for ready', async () => {
      jest.mocked(mockRegistry.sendRequest).mockResolvedValue(undefined);

      await registerKnowledgeGraphHandlers(mockRegistry, mockWebview);

      expect(mockRegistry.onNotification).toHaveBeenCalledWith(
        KNOWLEDGE_GRAPH_WEBVIEW_ID,
        'ready',
        expect.any(Function),
      );
    });

    it('should start webview if ready before registering the handlers', async () => {
      const url = 'https://example.com/knowledge-graph';
      jest.mocked(mockRegistry.sendRequest).mockResolvedValue({ url });

      await registerKnowledgeGraphHandlers(mockRegistry, mockWebview);

      expect(mockRegistry.sendRequest).toHaveBeenCalledWith(
        KNOWLEDGE_GRAPH_WEBVIEW_ID,
        'getUrl',
        undefined,
      );
      expect(mockWebview.start).toHaveBeenCalledWith(url);
    });

    it('should not start webview is not ready when registering the handlers', async () => {
      jest.mocked(mockRegistry.sendRequest).mockResolvedValue({ url: undefined });

      await registerKnowledgeGraphHandlers(mockRegistry, mockWebview);

      expect(mockRegistry.sendRequest).toHaveBeenCalledWith(
        KNOWLEDGE_GRAPH_WEBVIEW_ID,
        'getUrl',
        undefined,
      );
      expect(mockWebview.start).not.toHaveBeenCalled();
    });

    it('should not start webview when sendRequest fails', async () => {
      const error = new Error('Network error');
      jest.mocked(mockRegistry.sendRequest).mockRejectedValue(error);

      await registerKnowledgeGraphHandlers(mockRegistry, mockWebview);

      expect(mockRegistry.sendRequest).toHaveBeenCalledWith(
        KNOWLEDGE_GRAPH_WEBVIEW_ID,
        'getUrl',
        undefined,
      );
      expect(mockWebview.start).not.toHaveBeenCalled();
    });

    it('should call registered ready handler when notification is received', async () => {
      jest.mocked(mockRegistry.sendRequest).mockResolvedValue(undefined);
      let registeredHandler: ((params: unknown) => Promise<void> | void) | undefined;

      jest.mocked(mockRegistry.onNotification).mockImplementation((webviewId, type, handler) => {
        if (webviewId === KNOWLEDGE_GRAPH_WEBVIEW_ID && type === 'ready') {
          registeredHandler = handler;
        }
      });

      await registerKnowledgeGraphHandlers(mockRegistry, mockWebview);

      const url = 'https://example.com/knowledge-graph';
      await registeredHandler!({ url });

      expect(mockWebview.start).toHaveBeenCalledWith(url);
    });
  });
});
