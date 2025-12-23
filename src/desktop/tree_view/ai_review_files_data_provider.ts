import * as vscode from 'vscode';
import { aiReviewStateManager, AIReviewState } from '../ai_code_review/ai_review_state';
import { ChangedFileItem } from './items/changed_file_item';

/**
 * AI Code Review Files TreeDataProvider
 * 显示当前正在 Review 的 MR 文件列表
 */
export class AIReviewFilesDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  readonly #onDidChangeTreeDataEmitter = new vscode.EventEmitter<vscode.TreeItem | undefined>();

  readonly onDidChangeTreeData = this.#onDidChangeTreeDataEmitter.event;

  constructor() {
    // 监听 Review 状态变化
    aiReviewStateManager.onDidChange(() => {
      this.#onDidChangeTreeDataEmitter.fire(undefined);
    });
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    // 如果有子元素，说明是在查询文件的子项，直接返回空
    if (element) {
      return [];
    }

    const reviewState = aiReviewStateManager.getCurrentReview();

    // 没有正在进行的 Review
    if (!reviewState) {
      return [this.#createEmptyStateItem()];
    }

    // 显示 MR 信息和文件列表
    return [
      this.#createMRInfoItem(reviewState),
      ...this.#createFileItems(reviewState),
    ];
  }

  /**
   * 创建空状态项
   */
  #createEmptyStateItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      'No active AI code review',
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = 'Click the ✨ button on an MR to start';
    item.iconPath = new vscode.ThemeIcon('info');
    item.contextValue = 'empty-state';
    return item;
  }

  /**
   * 创建 MR 信息项
   */
  #createMRInfoItem(state: AIReviewState): vscode.TreeItem {
    const { mr } = state;
    const duration = Math.floor((Date.now() - state.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    const item = new vscode.TreeItem(
      `!${mr.iid} · ${mr.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = `Reviewing for ${timeStr}`;
    item.iconPath = new vscode.ThemeIcon('sparkle');
    item.contextValue = 'mr-info';
    item.tooltip = `Project: ${state.projectName}\nAuthor: ${mr.author.name}\nReviewing since: ${new Date(state.startTime).toLocaleTimeString()}`;
    return item;
  }

  /**
   * 创建文件列表项
   * 直接复用 ChangedFileItem，确保与 MR 列表完全一致
   */
  #createFileItems(state: AIReviewState): vscode.TreeItem[] {
    const { mr, mrVersion, workspaceRoot } = state;

    // 空的 hasComment 函数，因为在 Review 面板中不需要显示评论标记
    const hasComment = () => false;

    return mrVersion.diffs.map(diff =>
      new ChangedFileItem(mr, mrVersion, diff, workspaceRoot, hasComment, true)
    );
  }

  /**
   * 刷新视图
   */
  refresh(): void {
    this.#onDidChangeTreeDataEmitter.fire(undefined);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.#onDidChangeTreeDataEmitter.dispose();
  }
}
