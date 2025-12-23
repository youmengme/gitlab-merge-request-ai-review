import { createFakePartial } from './create_fake_partial';

interface FakeResponseOptions {
  status?: number;
  text?: Promise<string>;
  url?: string;
  headers?: Record<string, string>;
}

export const createFakeResponse = ({
  status = 200,
  text = Promise.resolve(''),
  url = '',
  headers = {},
}: FakeResponseOptions): Response =>
  createFakePartial<Response>({
    ok: status >= 200 && status < 400,
    status,
    url,
    text: () => text,
    json: () => text.then(JSON.parse),
    headers: new Headers(headers),
  });
