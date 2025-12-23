import { log } from '../../log';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { WebviewMessageRegistry } from './webview_message_registry';
import { isWebviewMessage } from './webview_message';
import { handleWebviewRequest } from './webview_request_handler';

jest.mock('../../log');
jest.mock('./webview_message', () => ({
  isWebviewMessage: jest.fn(),
}));

jest.mock('../setup_webviews');

describe('handleWebviewRequest', () => {
  let mockRegistry: WebviewMessageRegistry;

  beforeEach(() => {
    mockRegistry = createFakePartial<WebviewMessageRegistry>({
      handleRequest: jest.fn(),
    });

    jest.clearAllMocks();
  });

  it('returns an error if the message is not a valid webview message', async () => {
    jest.mocked(isWebviewMessage).mockReturnValue(false);

    const invalidMessage = { invalid: true };
    const result = await handleWebviewRequest(mockRegistry)(invalidMessage);

    expect(isWebviewMessage).toHaveBeenCalledWith(invalidMessage);
    expect(log.debug).toHaveBeenCalledWith(
      `Received invalid request message: ${JSON.stringify(invalidMessage)}`,
    );
    expect(result).toEqual({ error: 'Invalid request message' });
  });

  it('calls the registry to handle a valid request and returns the result', async () => {
    jest.mocked(isWebviewMessage).mockReturnValue(true);
    const validMessage = { pluginId: 'plugin1', type: 'type1', payload: { data: 'test' } };
    jest.mocked(mockRegistry.handleRequest).mockResolvedValue('success');

    const result = await handleWebviewRequest(mockRegistry)(validMessage);

    expect(isWebviewMessage).toHaveBeenCalledWith(validMessage);
    expect(mockRegistry.handleRequest).toHaveBeenCalledWith('plugin1', {
      type: 'type1',
      payload: { data: 'test' },
    });
    expect(result).toBe('success');
  });

  it('logs and returns an error if the registry throws an exception', async () => {
    jest.mocked(isWebviewMessage).mockReturnValue(true);
    const validMessage = { pluginId: 'plugin1', type: 'type1', payload: { data: 'test' } };
    const error = new Error('Handler error');
    jest.mocked(mockRegistry.handleRequest).mockRejectedValue(error);

    const result = await handleWebviewRequest(mockRegistry)(validMessage);

    expect(isWebviewMessage).toHaveBeenCalledWith(validMessage);
    expect(mockRegistry.handleRequest).toHaveBeenCalledWith('plugin1', {
      type: 'type1',
      payload: { data: 'test' },
    });
    expect(log.error).toHaveBeenCalledWith(
      `Failed to handle request for pluginId: plugin1, type: type1, payload: ${JSON.stringify({
        data: 'test',
      })}`,
      error,
    );
    expect(result).toEqual({ error });
  });
});
