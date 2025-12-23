/**
 * AI Code Review 功能的类型定义
 */

export interface ReviewPromptConfig {
  /** 是否启用 AI Code Review */
  enabled: boolean;
  /** Review 提示词内容 */
  promptContent: string;
  /** 提示词文件路径 */
  promptFilePath: string;
}

export interface DiffHunk {
  /** 文件路径 */
  filePath: string;
  /** 旧文件路径（重命名时使用） */
  oldPath?: string;
  /** 新文件路径 */
  newPath: string;
  /** diff 内容 */
  diffContent: string;
  /** 变更类型 */
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  /** 新文件的起始行号 */
  newLineStart: number;
  /** 新文件的结束行号 */
  newLineEnd: number;
  /** 旧文件的起始行号 */
  oldLineStart?: number;
  /** 旧文件的结束行号 */
  oldLineEnd?: number;
}

export interface ReviewComment {
  /** 文件路径 */
  filePath: string;
  /** 评论所在行号（新文件） */
  lineNumber: number;
  /** 评论内容 */
  content: string;
  /** 严重程度 */
  severity: 'info' | 'warning' | 'error';
  /** 旧文件行号（如果适用） */
  oldLineNumber?: number;
}

export interface AIReviewResult {
  /** 是否有 review 意见 */
  hasComments: boolean;
  /** Review 评论列表 */
  comments: ReviewComment[];
  /** 总体评价 */
  summary?: string;
  /** 错误信息（如果有） */
  error?: string;
}

export interface MRReviewContext {
  /** MR ID */
  mrId: number;
  /** MR IID */
  mrIid: number;
  /** 项目 ID */
  projectId: number;
  /** Base SHA */
  baseSha: string;
  /** Head SHA */
  headSha: string;
  /** Start SHA */
  startSha: string;
  /** Diff hunks */
  diffs: DiffHunk[];
}
