import { log } from '../../log';
import { waitForMs } from '../../utils/wait_for_ms';

export const API_PULLING = {
  interval: 5000,
  maxRetries: 20,
};

export const pullHandler = async <T>(
  handler: () => Promise<T | undefined>,
  retry = API_PULLING.maxRetries,
): Promise<T | undefined> => {
  if (retry <= 0) {
    log.debug('Pull handler: no retries left, exiting without return value.');
    return undefined;
  }

  log.debug(`Pull handler: pulling, ${retry - 1} retries left.`);
  const response = await handler();

  if (response) return response;

  await waitForMs(API_PULLING.interval);
  return pullHandler(handler, retry - 1);
};
