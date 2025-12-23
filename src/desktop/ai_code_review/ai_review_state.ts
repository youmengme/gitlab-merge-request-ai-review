import * as vscode from 'vscode';
import { log } from '../../common/log';

/**
 * AI Code Review 状态信息
 */
export interface AIReviewState {
  /** MR 信息 */
  mr: RestMr;
  /** MR 版本信息 */
  mrVersion: RestMrVersion;
  /** 项目信息 */
  projectName: string;
  /** 工作区根目录 */
  workspaceRoot: string;
  /** 开始时间 */
  startTime: number;
}

/**
 * AI Code Review 状态管理器（单例）
 */
class AIReviewStateManager {
  #currentReview: AIReviewState | null = null;

  readonly #onDidChangeEmitter = new vscode.EventEmitter<AIReviewState | null>();

  readonly onDidChange = this.#onDidChangeEmitter.event;

  /**
   * 开始新的 Review
   */
  startReview(state: AIReviewState): void {
    this.#currentReview = state;
    log.info(`[AI Review State] Started review for MR !${state.mr.iid}`);
    this.#onDidChangeEmitter.fire(this.#currentReview);
  }

  /**
   * 结束当前 Review
   */
  endReview(): void {
    if (this.#currentReview) {
      log.info(`[AI Review State] Ended review for MR !${this.#currentReview.mr.iid}`);
      this.#currentReview = null;
      this.#onDidChangeEmitter.fire(null);
    }
  }

  /**
   * 获取当前 Review 状态
   */
  getCurrentReview(): AIReviewState | null {
    return this.#currentReview;
  }

  /**
   * 是否有正在进行的 Review
   */
  hasActiveReview(): boolean {
    return this.#currentReview !== null;
  }
}

// 导出单例
export const aiReviewStateManager = new AIReviewStateManager();
