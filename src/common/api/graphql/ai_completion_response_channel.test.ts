import { AiCompletionResponseChannel } from './ai_completion_response_channel';

describe('AiCompletionResponseChannel', () => {
  let channel: AiCompletionResponseChannel;
  let emittedEvents: Array<[string, object]>;

  const messageMock = {
    role: 'USER',
    content: 'abc',
    requestId: 'foo',
    timestamp: 'bar',
    errors: [],
  };

  beforeEach(() => {
    const additionalContextEnabled = false;
    channel = new AiCompletionResponseChannel({ userId: 'foo' }, additionalContextEnabled);
    emittedEvents = [];

    channel.on('newChunk', data => {
      emittedEvents.push(['newChunk', data]);
    });
    channel.on('fullMessage', data => {
      emittedEvents.push(['fullMessage', data]);
    });
    channel.on('systemMessage', data => {
      emittedEvents.push(['systemMessage', data]);
    });
  });

  it('emits "systemMessage" when message has system role', async () => {
    const expectedData = { ...messageMock, role: 'SYSTEM' };

    channel.receive({ result: { data: { aiCompletionResponse: expectedData } }, more: true });

    expect(emittedEvents[0]).toStrictEqual(['systemMessage', expectedData]);
  });

  it('emits "newChunk" when message has chunkId', async () => {
    const expectedData = { ...messageMock, chunkId: 1 };

    channel.receive({ result: { data: { aiCompletionResponse: expectedData } }, more: true });

    expect(emittedEvents[0]).toStrictEqual(['newChunk', expectedData]);
  });

  it('emits "fullMessage" when message has no chunkId', async () => {
    const expectedData = { ...messageMock };

    channel.receive({ result: { data: { aiCompletionResponse: expectedData } }, more: true });

    expect(emittedEvents[0]).toStrictEqual(['fullMessage', expectedData]);
  });
});
