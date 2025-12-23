import fetch from 'cross-fetch';
import { Snowplow } from './snowplow';

jest.mock('cross-fetch');

const structEvent = {
  category: 'test',
  action: 'test',
  label: 'test',
  value: 1,
};

const enabledMock = jest.fn();

const TEST_IDE_EXTENSION_CONTEXT = {
  schema: 'test',
  data: {
    ide_name: 'Visual Studio Code',
    ide_vendor: 'Microsoft Corporation',
    ide_version: '1.0.0',
    extension_name: 'GitLab Workflow',
    extension_version: '1.0.0',
  },
};

const sp = Snowplow.getInstance({
  appId: 'test',
  timeInterval: 1000,
  maxItems: 1,
  endpoint: 'http://localhost',
  enabled: enabledMock,
  ideExtensionContext: TEST_IDE_EXTENSION_CONTEXT,
});

function getFetchCalls() {
  return jest.mocked(fetch).mock.calls.map(([url, req]) => {
    const bodyJSON = typeof req?.body === 'string' && JSON.parse(req.body);
    const schema = bodyJSON?.schema;
    const data = bodyJSON?.data?.map((item: Record<string, unknown>) => {
      const ctx = typeof item.cx === 'string' ? JSON.parse(atob(item.cx)) : null;

      return {
        se_ac: item.se_ac,
        contexts: ctx
          ? {
              schema: ctx.schema,
              data: ctx.data,
            }
          : {},
      };
    });

    return {
      url,
      method: req?.method,
      schema,
      data,
    };
  });
}

describe('Snowplow', () => {
  describe('Snowplow interface', () => {
    it('should initialize', async () => {
      const newSP = Snowplow.getInstance();
      expect(newSP).toBe(sp);
    });

    it('should let you track events', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        statusText: 'OK',
      } as Response);
      enabledMock.mockReturnValue(true);
      await sp.trackStructEvent(structEvent);
      await sp.stop();
    });

    it('should let you stop when the program ends', async () => {
      enabledMock.mockReturnValue(true);
      await sp.stop();
    });
  });

  describe('should track and send events to snowplow', () => {
    beforeEach(() => {
      (fetch as jest.MockedFunction<typeof fetch>).mockClear();
      enabledMock.mockReturnValue(true);
    });

    afterEach(async () => {
      await sp.stop();
    });

    it('should send the events to snowplow', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockClear();
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        statusText: 'OK',
      } as Response);

      const structEvent1 = { ...structEvent };
      structEvent1.action = 'action';
      const structEvent1Context = {
        schema: 'test2',
        data: { foo: 'bar' },
      };

      await sp.trackStructEvent(structEvent);
      await sp.trackStructEvent(structEvent1, [TEST_IDE_EXTENSION_CONTEXT, structEvent1Context]);
      expect(getFetchCalls()).toEqual([
        {
          url: 'http://localhost/com.snowplowanalytics.snowplow/tp2',
          method: 'POST',
          schema: 'iglu:com.snowplowanalytics.snowplow/payload_data/jsonschema/1-0-4',
          data: [
            {
              se_ac: 'test',
              contexts: {},
            },
          ],
        },
        {
          url: 'http://localhost/com.snowplowanalytics.snowplow/tp2',
          method: 'POST',
          schema: 'iglu:com.snowplowanalytics.snowplow/payload_data/jsonschema/1-0-4',
          data: [
            {
              se_ac: 'action',
              contexts: {
                schema: 'iglu:com.snowplowanalytics.snowplow/contexts/jsonschema/1-0-0',
                data: [TEST_IDE_EXTENSION_CONTEXT, structEvent1Context],
              },
            },
          ],
        },
      ]);
      await sp.stop();
    });
  });

  describe('enabled function', () => {
    it('should not send events to snowplow when disabled', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        statusText: 'OK',
      } as Response);

      enabledMock.mockReturnValue(false);

      const structEvent1 = { ...structEvent };
      structEvent1.action = 'action';

      await sp.trackStructEvent(structEvent);
      expect(fetch).not.toBeCalled();
      await sp.stop();
    });

    it('should send events to snowplow when enabled', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        statusText: 'OK',
      } as Response);

      enabledMock.mockReturnValue(true);

      const structEvent1 = { ...structEvent };
      structEvent1.action = 'action';

      await sp.trackStructEvent(structEvent);
      expect(fetch).toBeCalled();
      await sp.stop();
    });
  });
});
