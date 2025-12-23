import vscode from 'vscode';
import { InMemoryMemento } from '../../test/integration/test_infrastructure/in_memory_memento';
import { UserMessage } from './user_message';

describe('UserMessage', () => {
  const TEST_STORAGE_KEY = 'test.message.key';
  const TEST_MESSAGE = 'Test message';

  let globalState: vscode.Memento;
  let message: UserMessage;
  let callbackSpy: jest.Mock;
  let messageResponse: string | undefined;

  beforeEach(() => {
    globalState = new InMemoryMemento();

    callbackSpy = jest.fn();

    jest
      .mocked(vscode.window.showInformationMessage)
      .mockImplementation(async () => messageResponse as unknown as vscode.MessageItem);

    message = new UserMessage(globalState, TEST_STORAGE_KEY, TEST_MESSAGE, [
      { title: 'Action 1', callback: callbackSpy },
      { title: 'Action 2', callback: () => {} },
    ]);
  });

  it('shows message with all options', async () => {
    await message.trigger();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      TEST_MESSAGE,
      'Action 1',
      'Action 2',
      "Don't show again",
    );
  });

  it('executes callback when action is selected', async () => {
    messageResponse = 'Action 1';

    await message.trigger();

    expect(callbackSpy).toHaveBeenCalled();
  });

  it('stores dismissal in globalState when "Don\'t show again" is selected', async () => {
    messageResponse = "Don't show again";

    await message.trigger();

    expect(globalState.get(TEST_STORAGE_KEY)).toBe(true);
  });

  it('does not show message if previously dismissed', async () => {
    await globalState.update(TEST_STORAGE_KEY, true);

    await message.trigger();

    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('shows message only once per session', async () => {
    await message.trigger();
    await message.trigger();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no option is selected', async () => {
    messageResponse = undefined;

    await message.trigger();

    expect(callbackSpy).not.toHaveBeenCalled();
    expect(globalState.get(TEST_STORAGE_KEY)).toBeUndefined();
  });
});
