import { AIContextItem } from '@gitlab-org/gitlab-lsp';
import type { AIContextManager } from './ai_context_manager';

// This is a stub of the AIContextManager to prevent the "Language server manager not initialized" error
// from occurring in the Web IDE as it does not currently support the Language Server.
export class AIContextManagerWebIde implements AIContextManager {
  async query() {
    return [];
  }

  async add() {
    return false;
  }

  async remove() {
    return false;
  }

  async retrieveSelectedContextItemsWithContent() {
    return [];
  }

  async getCurrentItems() {
    return [];
  }

  async getItemWithContent(item: AIContextItem): Promise<AIContextItem> {
    throw new Error(
      `AIContextManagerWebIde::getItemWithContent is not yet implemented. Failed to get item "${item.id}"`,
    );
  }

  async getAvailableCategories() {
    return [];
  }

  async clearSelectedContextItems() {
    return false;
  }

  async isAdditionalContextEnabled() {
    return false;
  }
}
