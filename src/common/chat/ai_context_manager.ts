import {
  AIContextCategory,
  AIContextEndpoints,
  AIContextEndpointTypes,
  AIContextItem,
  DuoChatAIRequest,
} from '@gitlab-org/gitlab-lsp/';
import type { LanguageServerManager } from '../language_server/language_server_manager';
import { log } from '../log';

export interface AIContextManager {
  query: (query: DuoChatAIRequest) => Promise<AIContextItem[]>;
  add: (item: AIContextItem) => Promise<boolean>;
  remove: (item: AIContextItem) => Promise<boolean>;
  retrieveSelectedContextItemsWithContent: () => Promise<AIContextItem[]>;
  getCurrentItems: () => Promise<AIContextItem[]>;
  getAvailableCategories: () => Promise<AIContextCategory[]>;
  clearSelectedContextItems: () => Promise<boolean>;
  getItemWithContent: (item: AIContextItem) => Promise<AIContextItem>;
  isAdditionalContextEnabled: () => Promise<boolean>;
}

export class DefaultAIContextManager implements AIContextManager {
  #languageServerManager?: LanguageServerManager;

  constructor(languageServerManager?: LanguageServerManager) {
    this.#languageServerManager = languageServerManager;
  }

  async #sendRequest<K extends keyof AIContextEndpointTypes>(
    method: K,
    params: AIContextEndpointTypes[K]['request'],
  ): Promise<AIContextEndpointTypes[K]['response']> {
    if (!this.#languageServerManager) {
      throw new Error('Language server manager not initialized');
    }
    return this.#languageServerManager.sendRequest(method, params) as Promise<
      AIContextEndpointTypes[K]['response']
    >;
  }

  async query(query: DuoChatAIRequest) {
    return this.#sendRequest(AIContextEndpoints.QUERY, query);
  }

  async add(item: AIContextItem) {
    return this.#sendRequest(AIContextEndpoints.ADD, item);
  }

  async remove(item: AIContextItem) {
    return this.#sendRequest(AIContextEndpoints.REMOVE, item);
  }

  async retrieveSelectedContextItemsWithContent() {
    return this.#sendRequest(AIContextEndpoints.RETRIEVE, undefined);
  }

  async getCurrentItems() {
    return this.#sendRequest(AIContextEndpoints.CURRENT_ITEMS, undefined);
  }

  async getAvailableCategories() {
    return this.#sendRequest(AIContextEndpoints.GET_PROVIDER_CATEGORIES, undefined);
  }

  async clearSelectedContextItems() {
    return this.#sendRequest(AIContextEndpoints.CLEAR, undefined);
  }

  async getItemWithContent(item: AIContextItem): Promise<AIContextItem> {
    return this.#sendRequest(AIContextEndpoints.GET_ITEM_CONTENT, item);
  }

  /**
   * This RPC call is gated behind a feature flag on the server.
   * In the case the feature flag is not enabled, the call will return an empty array.
   */
  async isAdditionalContextEnabled() {
    try {
      const categories = await this.getAvailableCategories();
      return categories && categories.length > 0;
    } catch (error) {
      log.error('Error checking if additional context is enabled', error);
      return false;
    }
  }
}
