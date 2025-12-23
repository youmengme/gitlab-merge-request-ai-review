// TODO: make types exportable from LS, remove this copy pasta, import actual types in view/controller
// This will be available in https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/1952
// import type { AIContextProviderType, AIContextItem, AIContextCategory, AIContextItemMetadata } from '@gitlab-org/gitlab-lsp';
export type AIContextProviderType = 'open_tab';
export type AIContextCategory = 'file' | 'snippet' | 'issue' | 'merge_request';
export type AIContextItemMetadata = {
  enabled: boolean;
  disabledReasons?: string[];
  subType: AIContextProviderType;
};
export type AIContextItem = {
  id: string;
  category: AIContextCategory;
  content: string;
  metadata: AIContextItemMetadata;
};
