import { GitLabChatController } from '../gitlab_chat_controller';
import { GitLabChatRecord } from '../gitlab_chat_record';
import { SPECIAL_MESSAGES } from '../constants';

export const COMMAND_NEW_CHAT_CONVERSATION = 'gl.newChatConversation';

/**
 * Command will start new chat conversation
 */
export const newChatConversation = async (controller: GitLabChatController) => {
  const record = await GitLabChatRecord.buildWithContext(
    {
      role: 'user',
      type: 'newConversation',
      content: SPECIAL_MESSAGES.RESET,
    },
    controller.aiContextManager,
  );

  await controller.processNewUserRecord(record);
};
