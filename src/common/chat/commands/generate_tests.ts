import { GitLabChatController } from '../gitlab_chat_controller';
import { GitLabChatRecord } from '../gitlab_chat_record';

export const COMMAND_GENERATE_TESTS = 'gl.generateTests';

/**
 * Command will explain currently selected code with GitLab Chat
 */
export const generateTests = async (controller: GitLabChatController) => {
  const record = await GitLabChatRecord.buildWithContext(
    {
      role: 'user',
      type: 'generateTests',
      content: `/tests`,
    },
    controller.aiContextManager,
  );

  if (!record.context?.currentFile.selectedText) return;

  await controller.processNewUserRecord(record);
};
