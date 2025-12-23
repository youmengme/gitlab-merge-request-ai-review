import WebSocket from 'isomorphic-ws';
import { createCable } from '@anycable/core';
import { log } from '../../log';

const ensureEndsWithSlash = (url: string) => url.replace(/\/?$/, '/');

export const connectToCable = async (instanceUrl: string, websocketOptions?: object) => {
  const oldCableUrl = new URL('/-/cable', instanceUrl);
  // supports GitLab instances that are on a custom path, e.g. "https://example.com/gitlab"
  const cableUrl = new URL('-/cable', ensureEndsWithSlash(instanceUrl));
  oldCableUrl.protocol = cableUrl.protocol === 'http:' ? 'ws:' : 'wss:';
  cableUrl.protocol = cableUrl.protocol === 'http:' ? 'ws:' : 'wss:';

  // We have not taken into account custom instance path before. We've fixed it.
  // But we log this message just in case WS connection stops working.
  // So we'll know this change might have caused it.
  if (oldCableUrl.href !== cableUrl.href) {
    log.info(
      `Old URL used for WS connection: ${oldCableUrl.href} has changed to ${cableUrl.href}.`,
    );
  }

  const cable = createCable(cableUrl.href, {
    websocketImplementation: WebSocket,
    websocketOptions,
  });

  await cable.connect();

  return cable;
};
