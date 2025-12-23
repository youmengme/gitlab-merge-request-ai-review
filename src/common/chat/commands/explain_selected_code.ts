import { GitLabChatController } from '../gitlab_chat_controller';
import { GitLabChatRecord } from '../gitlab_chat_record';

export const COMMAND_EXPLAIN_SELECTED_CODE = 'gl.explainSelectedCode';

/**
 * Command will explain currently selected code with GitLab Chat
 */
export const explainSelectedCode = async (controller: GitLabChatController) => {
  const record = await GitLabChatRecord.buildWithContext(
    {
      role: 'user',
      type: 'explainCode',
      content: `/explain`,
    },
    controller.aiContextManager,
  );

  if (!record.context?.currentFile.selectedText) return;

  await controller.processNewUserRecord(record);
};
