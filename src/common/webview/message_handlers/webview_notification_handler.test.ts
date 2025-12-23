import { log } from '../../log';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { WebviewMessageRegistry } from './webview_message_registry';
import { isWebviewMessage } from './webview_message';
import { handleWebviewNotification } from './webview_notification_handler';

jest.mock('../../log');
jest.mock('./webview_message', () => ({
  isWebviewMessage: jest.fn(),
}));

jest.mock('../setup_webviews');

describe('handleWebviewNotification', () => {
  let mockRegistry: WebviewMessageRegistry;

  beforeEach(() => {
    mockRegistry = createFakePartial<WebviewMessageRegistry>({
      handleNotification: jest.fn(),
    });

    jest.clearAllMocks();
  });

  it('returns an error if the message is not a valid webview message', async () => {
    jest.mocked(isWebviewMessage).mockReturnValue(false);

    const invalidMessage = { invalid: true };
    await handleWebviewNotification(mockRegistry)(invalidMessage);

    expect(isWebviewMessage).toHaveBeenCalledWith(invalidMessage);
    expect(log.debug).toHaveBeenCalledWith(
      `Received invalid notification: ${JSON.stringify(invalidMessage)}`,
    );
  });

  it('calls the registry to handle a valid notification', async () => {
    jest.mocked(isWebviewMessage).mockReturnValue(true);
    const validMessage = { pluginId: 'plugin1', type: 'type1', payload: { data: 'test' } };

    await handleWebviewNotification(mockRegistry)(validMessage);

    expect(isWebviewMessage).toHaveBeenCalledWith(validMessage);
    expect(mockRegistry.handleNotification).toHaveBeenCalledWith('plugin1', {
      type: 'type1',
      payload: { data: 'test' },
    });
  });

  it('logs and returns an error if the registry throws an exception', async () => {
    jest.mocked(isWebviewMessage).mockReturnValue(true);
    const validMessage = { pluginId: 'plugin1', type: 'type1', payload: { data: 'test' } };
    const error = new Error('Handler error');

    jest.mocked(mockRegistry.handleNotification).mockImplementation(() => {
      throw error;
    });
    await handleWebviewNotification(mockRegistry)(validMessage);

    expect(isWebviewMessage).toHaveBeenCalledWith(validMessage);
    expect(mockRegistry.handleNotification).toHaveBeenCalledWith('plugin1', {
      type: 'type1',
      payload: { data: 'test' },
    });
    expect(log.error).toHaveBeenCalledWith(
      `Failed to handle notification for pluginId: plugin1, type: type1, payload: ${JSON.stringify({
        data: 'test',
      })}`,
      error,
    );
  });
});
