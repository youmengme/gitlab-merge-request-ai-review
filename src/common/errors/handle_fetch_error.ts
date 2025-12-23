import { FetchError } from './fetch_error';

export const handleFetchError = async (response: Response, resourceName: string) => {
  if (!response.ok) {
    const body = await response.text().catch(() => undefined);
    throw new FetchError(response, resourceName, body);
  }
};
