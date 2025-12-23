import { KNOWLEDGE_GRAPH_WEBVIEW_ID } from '../../constants';
import { log } from '../../log';
import { WebviewMessageRegistry } from '../message_handlers';
import { KnowledgeGraphWebview } from './knowledge_graph_webview';

interface ReadyNotificationParams {
  url: string;
}

export const ready = async (
  webview: KnowledgeGraphWebview,
  params: ReadyNotificationParams | unknown,
) => {
  const { url } = (params as ReadyNotificationParams) ?? {};

  if (url) {
    await webview.start(url);
  }
};

// Display the web view if the Knowledge Graph started before the handler was registered.
const startWebviewIfReady = async (
  webview: KnowledgeGraphWebview,
  registry: WebviewMessageRegistry,
) => {
  try {
    const result = await registry.sendRequest(KNOWLEDGE_GRAPH_WEBVIEW_ID, 'getUrl', undefined);

    // Validate the result is an object with a url property.
    if (result && typeof result === 'object' && 'url' in result && typeof result.url === 'string') {
      await webview.start(result.url);
    }
  } catch (error) {
    log.debug(
      'Failed to get url for Knowledge Graph webview. The request was likely made before the Knowledge Graph started.',
      error,
    );
  }
};

export const registerKnowledgeGraphHandlers = async (
  registry: WebviewMessageRegistry,
  webview: KnowledgeGraphWebview,
) => {
  registry.onNotification(
    KNOWLEDGE_GRAPH_WEBVIEW_ID,
    'ready',
    (params: ReadyNotificationParams | unknown) => ready(webview, params),
  );

  await startWebviewIfReady(webview, registry);
};
