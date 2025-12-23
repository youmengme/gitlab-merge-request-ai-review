import { gitlabPlatformForAccount } from '../../test_utils/entities';
import { log } from '../../log';
import {
  getChatSupport,
  ChatAvailableResponseType,
  ChatSupportResponseInterface,
} from './get_chat_support';

describe('getChatSupport', () => {
  const mockApiResponse = (duoChatAvailable: boolean = true) => {
    const apiResponse: ChatAvailableResponseType = {
      currentUser: {
        duoChatAvailable,
      },
    };
    gitlabPlatformForAccount.fetchFromApi = jest.fn().mockResolvedValue(apiResponse);
  };

  const platformWithoutChatEnabled: ChatSupportResponseInterface = { hasSupportForChat: false };

  beforeEach(() => {
    jest.spyOn(log, 'error');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it(`returns ${JSON.stringify(platformWithoutChatEnabled)} if there is no platform`, async () => {
    const result1 = await getChatSupport();
    expect(result1).toEqual(platformWithoutChatEnabled);
    const result2 = await getChatSupport(undefined);
    expect(result2).toEqual(platformWithoutChatEnabled);
  });

  it(`returns ${JSON.stringify(
    platformWithoutChatEnabled,
  )} and logs if fetching 'duoChatAvailable' fails`, async () => {
    const result = await getChatSupport({
      ...gitlabPlatformForAccount,
      fetchFromApi: jest.fn().mockRejectedValueOnce('foo'),
    });
    expect(result).toEqual(platformWithoutChatEnabled);
    expect(log.error).toHaveBeenCalledWith('foo');
  });

  it(`returns ${JSON.stringify(
    platformWithoutChatEnabled,
  )} and does not log if the user does not have chat support`, async () => {
    mockApiResponse(false);
    const result = await getChatSupport(gitlabPlatformForAccount);
    expect(result).toEqual(platformWithoutChatEnabled);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('returns gitlab platform if it has chat support', async () => {
    mockApiResponse();
    const result = await getChatSupport(gitlabPlatformForAccount);
    expect(result).toEqual({ hasSupportForChat: true, platform: gitlabPlatformForAccount });
    expect(log.error).not.toHaveBeenCalled();
  });
});
