import crossFetch from 'cross-fetch';
import { log } from './log';
import { extractURL } from './utils/extract_url';

async function fetchLogged(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const start = Date.now();
  const url = extractURL(input);

  try {
    const resp = await crossFetch(input, init);
    const duration = Date.now() - start;

    log.debug(`fetch: request to ${url} returned HTTP ${resp.status} after ${duration} ms`);

    return resp;
  } catch (e) {
    const duration = Date.now() - start;
    log.debug(`fetch: request to ${url} threw an exception after ${duration} ms`);
    log.debug(`fetch: request to ${url} failed with:`, e);

    throw e;
  }
}

// eslint-disable-next-line import/no-default-export
export default fetchLogged;
