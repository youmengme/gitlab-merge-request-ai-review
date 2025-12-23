import WebSocket from 'ws';
import { createCable } from '@anycable/core';
import { log } from '../../log';
import { connectToCable } from './action_cable';

const cableMock = {
  connect: jest.fn(),
};

jest.mock('@anycable/core', () => ({
  createCable: jest.fn().mockImplementation(() => cableMock),
}));

jest.mock('../../log');

describe('connectToCable', () => {
  describe.each([
    ['https://foo.bar', 'wss://foo.bar/-/cable'],
    ['http://foo.bar', 'ws://foo.bar/-/cable'],
    ['https://foo.bar/nested/path', 'wss://foo.bar/nested/path/-/cable'],
    ['http://foo.bar/nested/path', 'ws://foo.bar/nested/path/-/cable'],
    ['https://foo.bar/nested/', 'wss://foo.bar/nested/-/cable'],
    ['http://foo.bar/nested/', 'ws://foo.bar/nested/-/cable'],
    ['https://foo.bar/', 'wss://foo.bar/-/cable'],
    ['http://foo.bar/', 'ws://foo.bar/-/cable'],

    // Test cases with ports
    ['https://foo.bar:8080', 'wss://foo.bar:8080/-/cable'],
    ['http://foo.bar:3000', 'ws://foo.bar:3000/-/cable'],
    ['https://foo.bar:8080/nested/path', 'wss://foo.bar:8080/nested/path/-/cable'],
    ['http://foo.bar:3000/nested/path', 'ws://foo.bar:3000/nested/path/-/cable'],
    ['https://foo.bar:8080/nested/', 'wss://foo.bar:8080/nested/-/cable'],
    ['http://foo.bar:3000/nested/', 'ws://foo.bar:3000/nested/-/cable'],
  ])('connectToCable with base URL %s', (instanceUrl, expectedUrl) => {
    it(`should call createCable with ${expectedUrl} and connect`, async () => {
      const connection = await connectToCable(instanceUrl);

      expect(createCable).toHaveBeenCalledWith(expectedUrl, {
        websocketImplementation: WebSocket,
      });
      expect(cableMock.connect).toHaveBeenCalled();

      expect(connection).toStrictEqual(cableMock);
    });
  });

  it('logs a message when the cable URL changes', async () => {
    const mockInstanceUrl = 'https://example.com/gitlab';
    const expectedOldCableUrl = 'wss://example.com/-/cable';
    const expectedNewCableUrl = 'wss://example.com/gitlab/-/cable';

    await connectToCable(mockInstanceUrl);

    expect(jest.mocked(log.info)).toHaveBeenCalledWith(
      `Old URL used for WS connection: ${expectedOldCableUrl} has changed to ${expectedNewCableUrl}.`,
    );
  });

  it('does not log a message when the cable URL does not change', async () => {
    const mockInstanceUrl = 'https://example.com/';

    await connectToCable(mockInstanceUrl);

    expect(jest.mocked(log.info)).not.toHaveBeenCalled();
  });

  it('adds additional websocket options if provided', async () => {
    const additionalOptions = { headers: 'foo' };

    await connectToCable('https://foo.bar', additionalOptions);

    expect(createCable).toHaveBeenCalledWith('wss://foo.bar/-/cable', {
      websocketImplementation: WebSocket,
      websocketOptions: additionalOptions,
    });
  });

  it('throws if connection to cable fails', async () => {
    const err = new Error('Foo Bar');
    cableMock.connect = jest.fn(() => {
      throw err;
    });

    await expect(() => connectToCable('http://foo.bar:3000')).rejects.toThrow('Foo Bar');
  });
});
