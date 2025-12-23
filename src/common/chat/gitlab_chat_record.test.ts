import { createFakePartial } from '../test_utils/create_fake_partial';
import { AIContextManager } from './ai_context_manager';
import { detectType, GitLabChatRecord } from './gitlab_chat_record';

const currentContextMock = { currentFile: { fileName: 'foo', selectedText: 'bar' } };

jest.mock('./gitlab_chat_record_context', () => ({
  buildCurrentContext: jest.fn().mockImplementation(() => currentContextMock),
}));

describe('GitLabChatRecord', () => {
  let record: GitLabChatRecord;
  let mockAIContextManager: AIContextManager;

  beforeEach(() => {
    mockAIContextManager = createFakePartial<AIContextManager>({
      retrieveSelectedContextItemsWithContent: jest.fn().mockResolvedValue([]),
    });
  });

  it('has meaningful defaults', () => {
    record = new GitLabChatRecord({ role: 'user', content: '' });
    expect(record.type).toBe('general');
    expect(record.state).toBe('ready');
  });

  it('respects provided values over defaults', () => {
    record = new GitLabChatRecord({
      chunkId: 1,
      role: 'user',
      content: '',
      type: 'explainCode',
      requestId: '123',
      state: 'pending',
    });
    expect(record.chunkId).toBe(1);
    expect(record.type).toBe('explainCode');
    expect(record.state).toBe('pending');
    expect(record.requestId).toBe('123');
  });

  it('assigns unique id', () => {
    record = new GitLabChatRecord({ role: 'user', content: '' });
    const anotherRecord = new GitLabChatRecord({ role: 'user', content: '' });

    expect(record.id).not.toEqual(anotherRecord.id);
    expect(record.id.length).toBe(36);
  });

  describe('buildWithContext', () => {
    it('assigns current file context to the record', async () => {
      record = await GitLabChatRecord.buildWithContext(
        { role: 'user', content: '' },
        mockAIContextManager,
      );

      expect(record.context).toStrictEqual(currentContextMock);
    });
  });
});

describe('detectType', () => {
  it.each`
    message           | version        | expectedType
    ${'/reset'}       | ${'17.5.0-ee'} | ${'newConversation'}
    ${'/reset'}       | ${'17.5.0'}    | ${'newConversation'}
    ${'/reset'}       | ${'17.4.0'}    | ${'newConversation'}
    ${'/clear'}       | ${'17.5.0-ee'} | ${'clearChat'}
    ${'/clear'}       | ${'17.5.0'}    | ${'clearChat'}
    ${'/clear'}       | ${'17.4.0'}    | ${'clearChat'}
    ${'/clean'}       | ${'17.6.0-ee'} | ${'general'}
    ${'/clean'}       | ${'17.5.0-ee'} | ${'general'}
    ${'/clean'}       | ${'17.5.0'}    | ${'general'}
    ${'/clean'}       | ${'17.4.0-ee'} | ${'clearChat'}
    ${'/clean'}       | ${'17.4.0'}    | ${'clearChat'}
    ${'test message'} | ${'17.5.0-ee'} | ${'general'}
    ${'test message'} | ${'17.5.0'}    | ${'general'}
    ${'test message'} | ${'17.4.0'}    | ${'general'}
  `('returns $expectedType for $message on $version', ({ message, version, expectedType }) => {
    expect(detectType(message, version)).toBe(expectedType);
  });
});
