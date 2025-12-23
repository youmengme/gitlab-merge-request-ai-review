export interface GitlabChatSlashCommand {
  name: string;
  description: string;
  shouldSubmit?: boolean;
}

const ResetCommand: GitlabChatSlashCommand = {
  name: '/reset',
  description: 'Reset conversation and ignore the previous messages.',
  shouldSubmit: true,
};

const ClearCommand: GitlabChatSlashCommand = {
  name: '/clear',
  description: 'Delete all messages in this conversation.',
};

const TestsCommand: GitlabChatSlashCommand = {
  name: '/tests',
  description: 'Generate tests for the selected snippet.',
};

const RefactorCommand: GitlabChatSlashCommand = {
  name: '/refactor',
  description: 'Refactor the selected snippet.',
};

const ExplainCommand: GitlabChatSlashCommand = {
  name: '/explain',
  description: 'Explain the selected snippet.',
};

const FixCommand: GitlabChatSlashCommand = {
  name: '/fix',
  description: 'Fix the selected code snippet.',
};

const IncludeCommand: GitlabChatSlashCommand = {
  name: '/include',
  description: 'Include additional context in the conversation.',
};

const HelpCommand: GitlabChatSlashCommand = {
  name: '/help',
  description: 'Learn what Duo Chat can do.',
};

export const defaultSlashCommands: GitlabChatSlashCommand[] = [
  ResetCommand,
  ClearCommand,
  TestsCommand,
  RefactorCommand,
  FixCommand,
  ExplainCommand,
  IncludeCommand,
  HelpCommand,
];
