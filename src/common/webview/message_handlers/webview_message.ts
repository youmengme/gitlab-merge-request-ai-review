import { LS_WEBVIEW_IDS } from '../../constants';

export const DEFAULT_WEBVIEW_NOTIFICATION_METHOD = '$/gitlab/plugin/notification';
export const DEFAULT_WEBVIEW_REQUEST_METHOD = '$/gitlab/plugin/request';

export type WebviewID = (typeof LS_WEBVIEW_IDS)[number];

export type WebviewMessage = {
  pluginId: WebviewID;
  type: string;
  payload: unknown;
};

export const isWebviewMessage = (message: unknown): message is WebviewMessage => {
  return (
    typeof message === 'object' && message !== null && 'pluginId' in message && 'type' in message
  );
};
