import type { HttpsProxyAgent } from 'https-proxy-agent';
import type { Cable } from '@anycable/core';
import fetch from '../../fetch_logged';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { createFakeResponse } from '../../test_utils/create_fake_response';
import { REQUEST_TIMEOUT_MILLISECONDS } from '../../constants';
import { connectToCable } from './action_cable';
import { DefaultApiClient, AuthProvider } from './api_client';

jest.mock('./action_cable');
jest.mock('../../fetch_logged');

const TEST_INSTANCE_URL = 'https://gdk.test:3443';
const TEST_AUTH_PROVIDER: AuthProvider = {
  getAuthHeaders: () =>
    Promise.resolve({
      Authorization: 'test 123456',
    }),
};
const TEST_HEADERS = {
  'User-Agent': 'test',
};
const TEST_AGENT = createFakePartial<HttpsProxyAgent<string>>({
  proxy: {
    host: 'test',
    port: '1234',
  },
});
const TEST_RESPONSE_JSON = [{ id: 1 }, { id: 2 }];

describe('DefaultApiClient', () => {
  let subject: DefaultApiClient;

  beforeEach(() => {
    jest.mocked(fetch).mockResolvedValue(
      createFakeResponse({
        text: Promise.resolve(JSON.stringify(TEST_RESPONSE_JSON)),
      }),
    );
  });

  describe('default', () => {
    beforeEach(() => {
      subject = new DefaultApiClient({
        instanceUrl: TEST_INSTANCE_URL,
        agent: TEST_AGENT,
        headers: TEST_HEADERS,
        authProvider: TEST_AUTH_PROVIDER,
      });
    });

    describe('fetchFromApi', () => {
      it('with successful GET request, returns parsed body from fetch', async () => {
        expect(fetch).not.toHaveBeenCalled();

        const actual = await subject.fetchFromApi<unknown>({
          type: 'rest',
          method: 'GET',
          path: '/test',
          searchParams: {
            param: '123',
            foo: 'bar',
          },
          headers: {
            'X-Test': '123',
          },
        });

        expect(actual).toEqual(TEST_RESPONSE_JSON);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(`${TEST_INSTANCE_URL}/api/v4/test?param=123&foo=bar`, {
          agent: TEST_AGENT,
          headers: {
            Authorization: 'test 123456',
            Connection: 'keep-alive',
            'User-Agent': 'test',
            'X-Test': '123',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
        });
      });

      it('with successful POST request, returns parsed body from fetch', async () => {
        expect(fetch).not.toHaveBeenCalled();

        const body = { foo: 'bar' };
        const actual = await subject.fetchFromApi<unknown>({
          type: 'rest',
          method: 'POST',
          path: '/test',
          body: { foo: 'bar' },
          headers: {
            'X-Test': '123',
          },
        });

        expect(actual).toEqual(TEST_RESPONSE_JSON);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(`${TEST_INSTANCE_URL}/api/v4/test`, {
          agent: TEST_AGENT,
          body: JSON.stringify(body),
          headers: {
            Authorization: 'test 123456',
            Connection: 'keep-alive',
            'Content-Type': 'application/json',
            'User-Agent': 'test',
            'X-Test': '123',
          },
          method: 'POST',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
        });
      });

      it.each<'GET' | 'POST'>(['GET', 'POST'])('with failed %s request, rejects', async method => {
        jest
          .mocked(fetch)
          .mockResolvedValue(createFakeResponse({ url: 'response_url', status: 400 }));

        const actual = subject.fetchFromApi<unknown>({
          type: 'rest',
          method,
          path: '/test',
        });

        await expect(actual).rejects.toThrow('Fetching resource from response_url failed');
      });

      it('with successful graphql request, returns response', async () => {
        const responseData = {
          data: {
            test: 'FOO',
          },
        };

        jest.mocked(fetch).mockResolvedValue(
          createFakeResponse({
            text: Promise.resolve(JSON.stringify(responseData)),
            headers: {
              'Content-Type': 'application/json',
            },
          }),
        );

        const response = await subject.fetchFromApi({
          type: 'graphql',
          query: 'query { test }',
          variables: {
            foo: 'bar',
          },
        });

        expect(response).toEqual(responseData.data);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(`${TEST_INSTANCE_URL}/api/graphql`, {
          agent: TEST_AGENT,
          body: JSON.stringify({
            query: 'query { test }',
            variables: {
              foo: 'bar',
            },
          }),
          headers: {
            Authorization: 'test 123456',
            Connection: 'keep-alive',
            'Content-Type': 'application/json',
            'User-Agent': 'test',
          },
          method: 'POST',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
        });
      });
    });

    describe('connectToCable', () => {
      it('calls connectToCable with correct params', async () => {
        const response = createFakePartial<Cable>({});
        jest.mocked(connectToCable).mockResolvedValue(response);

        const actual = await subject.connectToCable();

        expect(actual).toBe(response);
        expect(connectToCable).toHaveBeenCalledWith(TEST_INSTANCE_URL, {
          headers: {
            Authorization: 'test 123456',
            Connection: 'keep-alive',
            'User-Agent': 'test',
            Origin: TEST_INSTANCE_URL,
          },
        });
      });

      it.each([
        ['https://gitlab.com', 'https://gitlab.com'],
        ['https://gitlab.com/api/v4', 'https://gitlab.com'],
        ['http://gitlab.example.com:8080/foo/bar', 'http://gitlab.example.com:8080'],
        ['https://sub.domain.gitlab.com/path?query=123', 'https://sub.domain.gitlab.com'],
      ])(
        'sets correct Origin header when instanceUrl is %s',
        async (instanceUrl, expectedOrigin) => {
          const client = new DefaultApiClient({
            instanceUrl,
            agent: TEST_AGENT,
            headers: TEST_HEADERS,
            authProvider: TEST_AUTH_PROVIDER,
          });

          await client.connectToCable();

          expect(connectToCable).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              headers: expect.objectContaining({
                Origin: expectedOrigin,
              }),
            }),
          );
        },
      );
    });
  });

  describe('with no auth provider or agent', () => {
    beforeEach(() => {
      subject = new DefaultApiClient({
        instanceUrl: TEST_INSTANCE_URL,
        headers: TEST_HEADERS,
      });
    });

    it('uses noop auth provider and no agent', async () => {
      await subject.fetchFromApi<unknown>({
        type: 'rest',
        method: 'GET',
        path: '/test',
        searchParams: {
          param: '123',
          foo: 'bar',
        },
        headers: {
          'X-Test': '123',
        },
      });

      expect(fetch).toHaveBeenCalledWith(`${TEST_INSTANCE_URL}/api/v4/test?param=123&foo=bar`, {
        headers: {
          Connection: 'keep-alive',
          'User-Agent': 'test',
          'X-Test': '123',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
      });
    });
  });
});
