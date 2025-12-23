import { Server, createServer } from 'http';
import { AddressInfo } from 'net';
import { DefaultApiClient } from './api_client';

const TEST_RESPONSE_JSON = { foo: 123 };
const IS_TIMEOUT_ERROR_REGEXP = /^Request to .* timed out after/;

describe('DefaultApiClient timeouts', () => {
  let subject: DefaultApiClient;
  let server: Server;

  function getApiClient() {
    const { DefaultApiClient: MockedApiClient } = require('./api_client'); // eslint-disable-line global-require,  @typescript-eslint/no-var-requires
    return new MockedApiClient({
      instanceUrl: `http://localhost:${(server.address() as AddressInfo).port}`,
    });
  }

  beforeAll(() => {
    server = createServer(async (req, res) => {
      const response = req.url?.match(/graphql/)
        ? { data: TEST_RESPONSE_JSON }
        : TEST_RESPONSE_JSON;

      // Fake delay
      // eslint-disable-next-line no-promise-executor-return
      await new Promise(r => setTimeout(r, 50));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(response));
    });

    server.listen(0);
  });

  afterAll(() => {
    server.close();
  });

  describe('Server responds on time', () => {
    beforeAll(() => {
      jest.unmock('../../constants');
      subject = getApiClient();
    });

    it('Rest GET', async () => {
      const response = subject.fetchFromApi({
        type: 'rest',
        method: 'GET',
        path: '/',
      });

      await expect(response).resolves.toMatchObject(TEST_RESPONSE_JSON);
    });

    it('Rest POST', async () => {
      const response = subject.fetchFromApi({
        type: 'rest',
        method: 'POST',
        path: '/',
      });

      await expect(response).resolves.toMatchObject(TEST_RESPONSE_JSON);
    });

    it('Graphql', async () => {
      const response = subject.fetchFromApi({
        type: 'graphql',
        query: 'query { test }',
        variables: {
          foo: 'bar',
        },
      });

      await expect(response).resolves.toMatchObject(TEST_RESPONSE_JSON);
    });
  });

  describe('Server does not respond on time', () => {
    beforeAll(() => {
      jest.resetModules();
      jest.doMock('../../constants');
      subject = getApiClient();
    });

    it('Rest GET', async () => {
      const response = subject.fetchFromApi({
        type: 'rest',
        method: 'GET',
        path: '/',
      });

      await expect(response).rejects.toThrow(IS_TIMEOUT_ERROR_REGEXP);
    });

    it('Rest POST', async () => {
      const response = subject.fetchFromApi({
        type: 'rest',
        method: 'POST',
        path: '/',
      });

      await expect(response).rejects.toThrow(IS_TIMEOUT_ERROR_REGEXP);
    });

    it('Graphql', async () => {
      const response = subject.fetchFromApi({
        type: 'graphql',
        query: 'query { test }',
        variables: {
          foo: 'bar',
        },
      });

      await expect(response).rejects.toThrow(IS_TIMEOUT_ERROR_REGEXP);
    });
  });
});
