import { GitLabChatController } from '../gitlab_chat_controller';
import { GitLabChatRecord } from '../gitlab_chat_record';

export const COMMAND_FIX_CODE = 'gl.fixCode';

/**
 * Command will fix currently selected code with GitLab Chat
 */
export const fixCode = async (controller: GitLabChatController) => {
  const record = await GitLabChatRecord.buildWithContext(
    {
      role: 'user',
      type: 'fixCode',
      content: `/fix`,
    },
    controller.aiContextManager,
  );

  if (!record.context?.currentFile.selectedText) return;

  await controller.processNewUserRecord(record);
};
