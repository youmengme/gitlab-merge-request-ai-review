import { getActiveFileContext, GitLabChatFileContext } from './gitlab_chat_file_context';

export type GitLabChatRecordContext = {
  currentFile: GitLabChatFileContext;
};

export const buildCurrentContext = (): GitLabChatRecordContext | undefined => {
  const currentFile = getActiveFileContext();

  if (!currentFile) {
    return undefined;
  }

  return { currentFile };
};
