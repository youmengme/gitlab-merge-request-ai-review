import * as vscode from 'vscode';
import OpenAI from 'openai';
import { log } from '../../common/log';
import { GitLabChatApi } from '../../common/chat/gitlab_chat_api';
import { GitLabPlatformManagerForChat } from '../../common/chat/get_platform_manager_for_chat';
import { AIContextManager } from '../../common/chat/ai_context_manager';
import { readPromptConfig } from './review_prompt_reader';
import { createMRReviewContext } from './mr_diff_analyzer';
import { AIReviewResult, ReviewComment, DiffHunk, MRReviewContext } from './types';

/**
 * AI Code Review 服务
 * 负责协调整个 AI Code Review 流程
 */
export class AICodeReviewService {
  #manager: GitLabPlatformManagerForChat;

  #aiContextManager: AIContextManager;

  #chatApi: GitLabChatApi;

  constructor(
    manager: GitLabPlatformManagerForChat,
    aiContextManager: AIContextManager,
  ) {
    this.#manager = manager;
    this.#aiContextManager = aiContextManager;
    this.#chatApi = new GitLabChatApi(manager, [], aiContextManager);
  }

  /**
   * 对 MR 进行 AI Code Review
   * @param mr MR 对象
   * @param mrVersion MR 版本信息
   * @param workspaceRoot 工作区根目录
   * @returns AI Review 结果
   */
  async reviewMR(
    mr: RestMr,
    mrVersion: RestMrVersion,
    workspaceRoot: string,
  ): Promise<AIReviewResult> {
    try {
      // 1. 读取 Review 提示词配置
      const promptConfig = await readPromptConfig(workspaceRoot);
      if (!promptConfig) {
        log.info('REVIEW_PROMPT.md not found, skipping AI Code Review');
        return {
          hasComments: false,
          comments: [],
          summary: 'Review skipped: REVIEW_PROMPT.md not found',
        };
      }

      // 2. 创建 MR Review 上下文
      const reviewContext = createMRReviewContext(mr, mrVersion);

      log.info(`Review context created: ${reviewContext.diffs.length} files to review`);
      reviewContext.diffs.forEach((diff, index) => {
        log.info(`[File ${index + 1}/${reviewContext.diffs.length}] ${diff.filePath} (${diff.changeType}, lines ${diff.newLineStart}-${diff.newLineEnd})`);
      });

      if (reviewContext.diffs.length === 0) {
        log.info('No reviewable files found');
        return {
          hasComments: false,
          comments: [],
          summary: 'No reviewable files found',
        };
      }

      // 3. 调用 AI 进行 Review
      const reviewResult = await this.#performAIReview(promptConfig.promptContent, reviewContext);

      log.info(`AI Code Review completed with ${reviewResult.comments.length} comments`);
      return reviewResult;
    } catch (error) {
      log.error(`AI Code Review failed: ${error}`);
      return {
        hasComments: false,
        comments: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 执行 AI Review - 并发队列处理
   * @param promptTemplate Review 提示词模板
   * @param context MR Review 上下文
   * @returns AI Review 结果
   */
  async #performAIReview(
    promptTemplate: string,
    context: MRReviewContext,
  ): Promise<AIReviewResult> {
    const maxConcurrent = vscode.workspace.getConfiguration('gitlab.aiCodeReview').get<number>('maxConcurrentFiles', 5);
    log.info(`Starting concurrent AI review: ${context.diffs.length} files, max concurrent: ${maxConcurrent}`);

    const allComments: ReviewComment[] = [];
    const fileQueue = [...context.diffs];
    const activePromises = new Set<Promise<void>>();
    let processedCount = 0;

    // 并发处理函数
    const processNextFile = async (): Promise<void> => {
      if (fileQueue.length === 0) return;

      const diff = fileQueue.shift()!;
      const fileIndex = processedCount + 1;
      processedCount++;

      try {
        log.info(`[File ${fileIndex}/${context.diffs.length}] Starting review of ${diff.filePath}`);
        const comments = await this.#reviewSingleFileWithRetry(promptTemplate, diff, context, fileIndex);
        allComments.push(...comments);
        log.info(`[File ${fileIndex}/${context.diffs.length}] Completed review of ${diff.filePath}: ${comments.length} comments`);
      } catch (error) {
        log.error(`[File ${fileIndex}/${context.diffs.length}] Failed to review ${diff.filePath}: ${error}`);
        // 单个文件失败不影响其他文件
      }
    };

    // 启动初始并发任务
    const initialPromises = [];
    for (let i = 0; i < Math.min(maxConcurrent, fileQueue.length); i++) {
      const promise = processNextFile().finally(() => {
        activePromises.delete(promise);
        // 当某个任务完成时，启动下一个任务
        if (fileQueue.length > 0) {
          const nextPromise = processNextFile();
          activePromises.add(nextPromise);
        }
      });
      activePromises.add(promise);
      initialPromises.push(promise);
    }

    // 等待所有任务完成
    await Promise.all(activePromises);

    log.info(`AI Code Review completed: ${allComments.length} total comments from ${context.diffs.length} files`);
    return {
      hasComments: allComments.length > 0,
      comments: allComments,
      summary: `Reviewed ${context.diffs.length} files, found ${allComments.length} issues`,
    };
  }

  /**
   * 单文件 review 带重试机制
   */
  async #reviewSingleFileWithRetry(
    promptTemplate: string,
    diff: DiffHunk,
    context: MRReviewContext,
    fileIndex: number,
  ): Promise<ReviewComment[]> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log.info(`[File ${fileIndex}] Attempt ${attempt}/${maxRetries} for ${diff.filePath}`);
        const comments = await this.#reviewSingleFile(promptTemplate, diff, context);
        return comments;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log.warn(`[File ${fileIndex}] Attempt ${attempt}/${maxRetries} failed for ${diff.filePath}: ${lastError.message}`);

        if (attempt < maxRetries) {
          // 等待一段时间后重试 (指数退避)
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          log.info(`[File ${fileIndex}] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 所有重试都失败了
    log.error(`[File ${fileIndex}] All ${maxRetries} attempts failed for ${diff.filePath}: ${lastError?.message}`);
    throw lastError || new Error('Unknown error during file review');
  }

  /**
   * 单文件 AI review
   */
  async #reviewSingleFile(
    promptTemplate: string,
    diff: DiffHunk,
    context: MRReviewContext,
  ): Promise<ReviewComment[]> {
    // 构建单文件的提示词
    const fullPrompt = this.#buildSingleFilePrompt(promptTemplate, diff, context);

    // 调用 AI API
    const aiResponse = await this.#callAIChatAPI(fullPrompt);

    // 解析响应
    const comments = this.#parseSingleFileResponse(aiResponse, diff);

    return comments;
  }

  /**
   * 构建单文件的 Review 提示词
   */
  #buildSingleFilePrompt(template: string, diff: DiffHunk, context: MRReviewContext): string {
    const diffText = this.#formatDiffForPrompt(diff);

    return `${template}

## MR Information
- MR IID: !${context.mrIid}
- Project ID: ${context.projectId}
- File: ${diff.filePath}
- Change Type: ${diff.changeType}

## Code Changes to Review

${diffText}

## Instructions
Please review the above code changes and provide feedback in the following JSON format:

\`\`\`json
{
  "comments": [
    {
      "filePath": "${diff.filePath}",
      "lineNumber": 42,
      "content": "Your review comment here",
      "severity": "error|warning|info"
    }
  ]
}
\`\`\`

Focus only on the changed lines (marked with + or -). Provide specific, actionable feedback for this file only.`;
  }

  /**
   * 解析单文件 AI 响应
   */
  #parseSingleFileResponse(aiResponse: string, diff: DiffHunk): ReviewComment[] {
    try {
      log.info(`Parsing single file response for ${diff.filePath}...`);

      let parsed;

      // 首先尝试直接解析整个响应作为 JSON
      try {
        parsed = JSON.parse(aiResponse.trim());
        log.info(`Successfully parsed response for ${diff.filePath} as direct JSON`);
      } catch (directParseError) {
        // 如果直接解析失败，尝试从 ```json 代码块中提取
        log.info(`Direct JSON parsing failed for ${diff.filePath}, trying to extract from code block...`);
        const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (!jsonMatch) {
          log.warn(`No JSON found in response for ${diff.filePath}`);
          log.debug(`AI Response: ${aiResponse.substring(0, 500)}...`);
          return [];
        }
        parsed = JSON.parse(jsonMatch[1]);
        log.info(`Successfully parsed response for ${diff.filePath} from code block`);
      }

      const { comments } = parsed;

      log.info(`AI returned ${Array.isArray(comments) ? comments.length : 'invalid'} comments for ${diff.filePath}`);

      if (!Array.isArray(comments)) {
        log.warn(`Invalid comments format in response for ${diff.filePath}`);
        return [];
      }

      // 验证和过滤评论 - 只保留属于当前文件的评论
      const validComments = comments.filter((comment: ReviewComment) => {
        // 确保评论属于当前文件
        if (comment.filePath !== diff.filePath) {
          log.warn(`Comment for ${comment.filePath} ignored: does not match current file ${diff.filePath}`);
          return false;
        }

        // 确保必需字段存在
        const hasRequiredFields = comment.lineNumber && comment.content && comment.severity;
        if (!hasRequiredFields) {
          log.warn(`Comment for ${diff.filePath} ignored: missing required fields`);
          return false;
        }

        return true;
      });

      log.info(`After validation: ${validComments.length}/${comments.length} comments are valid for ${diff.filePath}`);

      return validComments;
    } catch (error) {
      log.error(`Failed to parse response for ${diff.filePath}: ${error}`);
      log.debug(`Raw AI response: ${aiResponse.substring(0, 1000)}...`);
      return [];
    }
  }

  /**
   * 格式化单个 diff 用于提示词
   */
  #formatDiffForPrompt(diff: DiffHunk): string {
    return `### File: ${diff.filePath}
**Change Type:** ${diff.changeType}
**Lines:** ${diff.newLineStart}-${diff.newLineEnd}

\`\`\`diff
${diff.diffContent}
\`\`\``;
  }

  /**
   * 调用 OpenAI API 进行代码审查
   */
  async #callAIChatAPI(prompt: string): Promise<string> {
    log.info('Calling OpenAI API for code review...');

    // 获取配置
    const config = vscode.workspace.getConfiguration('gitlab.aiCodeReview.openai');
    const endpoint = config.get<string>('endpoint') || 'https://api.openai.com/v1';
    const apiKey = config.get<string>('apiKey') || process.env.OPENAI_API_KEY;
    const model = config.get<string>('model') || 'gpt-4';

    if (!apiKey) {
      throw new Error(
        'OpenAI API key not configured. Please set it in settings or OPENAI_API_KEY environment variable.',
      );
    }

    // 创建 OpenAI 客户端
    const openai = new OpenAI({
      apiKey,
      baseURL: endpoint,
    });

    try {
      // 调用 OpenAI Chat Completion API
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert code reviewer. Analyze code changes and provide specific, actionable feedback in JSON format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI API');
      }

      log.info('OpenAI API call successful');
      return content;
    } catch (error) {
      log.error(`OpenAI API call failed: ${error}`);
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
