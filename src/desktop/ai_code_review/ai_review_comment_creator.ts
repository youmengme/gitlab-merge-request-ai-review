import * as vscode from 'vscode';
import { log } from '../../common/log';
import { commentControllerProvider } from '../review/comment_controller_provider';
import { CommentingRangeProvider } from '../review/commenting_range_provider';
import { toReviewUri } from '../review/review_uri';
import { createComment } from '../commands/mr_discussion_commands';
import type { ReviewComment } from './types';

/**
 * AI Review Comment Creator
 * 通过 VS Code Comment API 创建 AI Review 评论
 */
export class AIReviewCommentCreator {
  #commentController: vscode.CommentController | null = null;

  /**
   * 初始化 Comment Controller
   */
  initializeController(
    mr: RestMr,
    mrVersion: RestMrVersion,
  ): void {
    // 创建 CommentController
    this.#commentController = commentControllerProvider.borrowCommentController(
      mr.references.full,
      `AI Review: ${mr.title}`,
      new CommentingRangeProvider(mr, mrVersion),
    );
  }

  /**
   * 创建并自动提交 AI 评论
   */
  async createAndSubmitComments(
    comments: ReviewComment[],
    mr: RestMr,
    mrVersion: RestMrVersion,
    workspaceRoot: string,
  ): Promise<{ successCount: number; failedCount: number }> {
    if (!this.#commentController) {
      throw new Error('Comment controller not initialized. Call initializeController first.');
    }

    let successCount = 0;
    let failedCount = 0;

    // 顺序创建评论（需要等待每个评论完成）
    for (const [, comment] of comments.entries()) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.#createSingleComment(comment, mr, mrVersion, workspaceRoot);
        successCount += 1;
      } catch (error) {
        failedCount += 1;
      }
    }

    return { successCount, failedCount };
  }

  /**
   * 创建单个评论
   */
  async #createSingleComment(
    comment: ReviewComment,
    mr: RestMr,
    mrVersion: RestMrVersion,
    workspaceRoot: string,
  ): Promise<void> {
    if (!this.#commentController) {
      throw new Error('Comment controller not initialized');
    }

    // 获取配置：是否自动提交评论
    const config = vscode.workspace.getConfiguration('gitlab.aiCodeReview');
    const autoSubmitComments = config.get<boolean>('autoSubmitComments', false);

    // 日志辅助函数
    const logMsg = (msg: string) => {
      log.info(msg);
      // eslint-disable-next-line no-console
      console.log(msg);
    };

    // 使用新文件（head）的路径和行号
    const { filePath } = comment;
    const commit = mrVersion.head_commit_sha;

    // 创建 Review URI
    const reviewUri = toReviewUri({
      repositoryRoot: workspaceRoot,
      changeType: 'modified', // 简化处理，都当作 modified
      projectId: mr.project_id,
      mrId: mr.id,
      path: filePath,
      exists: true,
      commit,
    });


    // 创建 CommentThread（行号从 0 开始）
    const lineNumber = comment.lineNumber - 1;
    const range = new vscode.Range(lineNumber, 0, lineNumber, 0);

    const thread = this.#commentController.createCommentThread(reviewUri, range, []);
    thread.canReply = true;

    // 格式化评论内容
    const commentText = this.#formatCommentText(comment);

    // 根据配置决定是否自动提交到 GitLab
    if (autoSubmitComments) {

      try {
        await createComment({ text: commentText, thread });
      } catch (error) {
        const logError = (msg: string) => {
          log.error(msg);
          // eslint-disable-next-line no-console
          console.error(msg);
        };

        if (error instanceof Error && error.stack) {
          logError(`[AI Review Comment Creator] Error stack: ${error.stack}`);
        }
        throw error;
      }
    } else {
      // 创建评论但不提交 - 添加到 thread 中供用户手动提交
      try {
        const aiComment: vscode.Comment = {
          author: { name: 'AI Review' },
          body: commentText,
          mode: vscode.CommentMode.Preview,
          contextValue: 'ai-review-comment',
        };
        thread.comments = [aiComment];
      } catch (error) {
        const logError = (msg: string) => {
          log.error(msg);
          // eslint-disable-next-line no-console
          console.error(msg);
        };

        logError(`[AI Review Comment Creator] Failed to create VS Code comment for ${comment.filePath}:${comment.lineNumber}`);
        logError(`[AI Review Comment Creator] Error: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }
  }

  /**
   * 格式化评论内容
   */
  #formatCommentText(comment: ReviewComment): string {
    const severityEmoji = {
      error: '🔴',
      warning: '⚠️',
      info: 'ℹ️',
      suggestion: '💡',
    };

    const emoji = severityEmoji[comment.severity] || '💬';

    return `${emoji} [${comment.severity.toUpperCase()}]\n\n${comment.content}`;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.#commentController) {
      log.info('[AI Review Comment Creator] Disposing comment controller');
      // eslint-disable-next-line no-console
      console.log('[AI Review Comment Creator] Disposing comment controller');
      // 注意：不要 dispose controller，因为评论需要保留在 VS Code 中
      // 只清空引用
      this.#commentController = null;
    }
  }
}
