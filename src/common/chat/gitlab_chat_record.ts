import { v4 as uuidv4 } from 'uuid';
import { AIContextItem } from '@gitlab-org/gitlab-lsp';
import { coerce, gte } from 'semver';
import { log } from '../log';
import { buildCurrentContext, GitLabChatRecordContext } from './gitlab_chat_record_context';
import { SPECIAL_MESSAGES } from './constants';
import { AIContextManager } from './ai_context_manager';

type ChatRecordRole = 'user' | 'assistant' | 'system';
type ChatRecordState = 'pending' | 'ready';
type ChatRecordType =
  | 'general'
  | 'explainCode'
  | 'generateTests'
  | 'refactorCode'
  | 'newConversation'
  | 'clearChat'
  | 'fixCode';

type GitLabChatRecordAttributes = {
  chunkId?: number | null;
  type?: ChatRecordType;
  role: ChatRecordRole;
  content?: string;
  requestId?: string;
  state?: ChatRecordState;
  errors?: string[];
  timestamp?: string;
  extras?: {
    sources: object[];
    contextItems?: AIContextItem[];
  };
};

export function detectType(content: string, version: string): ChatRecordType {
  const parsedVersion = coerce(version);
  const usesGeneralTypeForCleanMessage = Boolean(parsedVersion && gte(parsedVersion, '17.5.0'));

  if (content === SPECIAL_MESSAGES.RESET) {
    return 'newConversation';
  }
  if (content === SPECIAL_MESSAGES.CLEAN && usesGeneralTypeForCleanMessage) {
    return 'general';
  }
  if (content === SPECIAL_MESSAGES.CLEAN || content === SPECIAL_MESSAGES.CLEAR) {
    return 'clearChat';
  }

  return 'general';
}

export class GitLabChatRecord {
  chunkId?: number | null;

  role: ChatRecordRole;

  content?: string;

  id: string;

  requestId?: string;

  state: ChatRecordState;

  timestamp: number;

  type: ChatRecordType;

  errors: string[];

  extras?: {
    sources: object[];
    contextItems?: AIContextItem[];
  };

  context?: GitLabChatRecordContext;

  constructor({
    chunkId,
    type,
    role,
    content,
    state,
    requestId,
    errors,
    timestamp,
    extras,
  }: GitLabChatRecordAttributes) {
    this.chunkId = chunkId;
    this.role = role;
    this.content = content;
    this.type = type ?? 'general';
    this.state = state ?? 'ready';
    this.requestId = requestId;
    this.errors = errors ?? [];
    this.id = uuidv4();
    this.timestamp = timestamp ? Date.parse(timestamp) : Date.now();
    this.extras = extras;
  }

  static async buildWithContext(
    attributes: GitLabChatRecordAttributes,
    aiContextManager: AIContextManager,
  ): Promise<GitLabChatRecord> {
    const record = new GitLabChatRecord(attributes);
    record.context = buildCurrentContext();
    try {
      const currentContextItems = await aiContextManager.retrieveSelectedContextItemsWithContent();
      log.info(`Retrieved ${currentContextItems.length} context items`);
      if (!record.extras) {
        record.extras = { sources: [], contextItems: [] };
      }
      record.extras.contextItems = currentContextItems;
    } catch (error) {
      log.error('Error retrieving AI context items', error);
    }

    return record;
  }

  update(attributes: Partial<GitLabChatRecordAttributes>) {
    const convertedAttributes = attributes as Partial<GitLabChatRecord>;
    if (attributes.timestamp) {
      convertedAttributes.timestamp = Date.parse(attributes.timestamp);
    }
    Object.assign(this, convertedAttributes);
  }
}
