import * as path from 'path';
import * as vscode from 'vscode';
import { log } from '../../../common/log';
import { handleError } from '../../../common/errors/handle_error';
import { UserFriendlyError } from '../../../common/errors/user_friendly_error';
import { getProjectRepository } from '../../gitlab/gitlab_project_repository';
import { mrCache } from '../../gitlab/mr_cache';
import { ProjectInRepository } from '../../gitlab/new_project';
import { AICodeReviewService } from '../ai_code_review_service';
import { GitLabPlatformManagerForChat } from '../../../common/chat/get_platform_manager_for_chat';
import { AIContextManager } from '../../../common/chat/ai_context_manager';
import { MrItemModel } from '../../tree_view/items/mr_item_model';
import { readPromptConfig } from '../review_prompt_reader';
import { aiReviewStateManager } from '../ai_review_state';
import { AIReviewCommentCreator } from '../ai_review_comment_creator';

export const COMMAND_AI_REVIEW_MR = 'gl.aiReviewMR';

/**
 * AI Code Review MR 命令
 * 对当前 MR 进行 AI Code Review 并添加评论
 * @param manager - GitLab Platform Manager
 * @param aiContextManager - AI Context Manager
 * @param mrItem - 可选的 MR Item，从树视图点击时传入
 */
export async function aiReviewMRCommand(
  manager: GitLabPlatformManagerForChat,
  aiContextManager: AIContextManager,
  mrItem?: MrItemModel,
): Promise<void> {
  try {
    // 1. 如果从树视图点击，直接使用传入的 MR
    let mr: RestMr;
    let selectedProject: ProjectInRepository;
    let workspaceRoot: string;

    if (mrItem) {
      // 从树视图点击的情况
      mr = mrItem.mr;
      selectedProject = mrItem.projectInRepository;
      workspaceRoot = selectedProject.pointer.repository.rootFsPath;
    } else {
      // 从命令面板调用的情况
      const { workspaceFolders } = vscode.workspace;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new UserFriendlyError('No workspace folder open', new Error('Workspace not found'));
      }

      workspaceRoot = workspaceFolders[0].uri.fsPath;

      // 获取当前项目和 MR
      const projectRepository = getProjectRepository();
      const projects = projectRepository.getDefaultAndSelectedProjects();

      if (projects.length === 0) {
        throw new UserFriendlyError(
          'No GitLab project found in workspace',
          new Error('No projects initialized'),
        );
      }

      // 如果有多个项目，让用户选择
      [selectedProject] = projects;
      if (projects.length > 1) {
        const projectItems = projects.map((p: ProjectInRepository) => ({
          label: p.project.name,
          description: p.project.webUrl,
          project: p,
        }));

        const selected = await vscode.window.showQuickPick(projectItems, {
          placeHolder: 'Select a project to review',
        });

        if (!selected) {
          return; // 用户取消
        }

        selectedProject = selected.project;
      }

      // 获取当前分支的 MR
      const tempMrId = 1; // TODO: 从实际的 Git 分支或 API 获取 MR ID
      const cachedMr = mrCache.getMr(tempMrId, selectedProject);
      if (!cachedMr) {
        throw new UserFriendlyError(
          'No merge request found. Please open the MR view first to load MR data.',
          new Error('MR not cached'),
        );
      }

      mr = cachedMr.mr;
    }

    // 2. 检查 REVIEW_PROMPT.md 文件是否存在
    log.info(`[AI Code Review] Starting review for MR !${mr.iid} (${mr.title})`);
    log.info(`[AI Code Review] Workspace root: ${workspaceRoot}`);
    log.info(`[AI Code Review] Project: ${selectedProject.project.name}`);

    const promptConfig = await readPromptConfig(workspaceRoot);
    if (!promptConfig) {
      log.warn('[AI Code Review] REVIEW_PROMPT.md not found in workspace root');
      const promptFilePath = path.join(workspaceRoot, 'REVIEW_PROMPT.md');
      const createFile = 'Create File';
      const result = await vscode.window.showWarningMessage(
        `REVIEW_PROMPT.md not found in workspace root.\n\nPlease create this file to define your AI code review guidelines.`,
        createFile,
        'Cancel',
      );

      if (result === createFile) {
        log.info('[AI Code Review] User chose to create REVIEW_PROMPT.md file');
        // 创建示例文件
        const exampleContent = `# AI Code Review Guidelines

## Review Focus Areas

1. **Code Quality**
   - Check for code smells and anti-patterns
   - Verify proper error handling
   - Ensure code follows best practices

2. **Security**
   - Look for potential security vulnerabilities
   - Check for sensitive data exposure
   - Verify input validation

3. **Performance**
   - Identify potential performance issues
   - Check for inefficient algorithms
   - Look for unnecessary computations

4. **Maintainability**
   - Ensure code is readable and well-documented
   - Check for proper naming conventions
   - Verify code modularity

## Review Instructions

Please review the code changes and provide constructive feedback on the areas mentioned above.
`;
        const uri = vscode.Uri.file(promptFilePath);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(exampleContent, 'utf-8'));
        await vscode.window.showTextDocument(uri);
        log.info(`[AI Code Review] Created REVIEW_PROMPT.md at ${promptFilePath}`);
      } else {
        log.info('[AI Code Review] User cancelled file creation');
      }
      return;
    }

    log.info(`[AI Code Review] REVIEW_PROMPT.md found, prompt length: ${promptConfig.promptContent.length}`);

    // 3. 重新加载 MR 数据以获取最新版本
    log.info('[AI Code Review] Reloading MR data...');
    const { mrVersion } = await mrCache.reloadMr(mr, selectedProject);
    log.info(`[AI Code Review] MR version loaded: base=${mrVersion.base_commit_sha.substring(0, 8)}, head=${mrVersion.head_commit_sha.substring(0, 8)}, diffs=${mrVersion.diffs.length}`);

    // 4. 设置 Review 状态
    aiReviewStateManager.startReview({
      mr,
      mrVersion,
      projectName: selectedProject.project.name,
      workspaceRoot,
      startTime: Date.now(),
    });

    // 4. 执行 AI Code Review（带进度提示）
    let reviewResult: Awaited<ReturnType<AICodeReviewService['reviewMR']>> | undefined;
    let successCount = 0;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `AI Code Review for !${mr.iid}`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Analyzing code changes...' });
        log.info('[AI Code Review] Starting AI analysis...');

        // 5. 执行 AI Code Review
        const reviewService = new AICodeReviewService(manager, aiContextManager);
        const startTime = Date.now();
        reviewResult = await reviewService.reviewMR(mr, mrVersion, workspaceRoot);
        const duration = Date.now() - startTime;

        log.info(`[AI Code Review] Analysis completed in ${duration}ms`);

        if (reviewResult.error) {
          log.error(`[AI Code Review] Review failed: ${reviewResult.error}`);
          throw new UserFriendlyError(
            `AI Code Review failed: ${reviewResult.error}`,
            new Error(reviewResult.error),
          );
        }

        log.info(`[AI Code Review] Review summary: ${reviewResult.summary}`);
        log.info(`[AI Code Review] Has comments: ${reviewResult.hasComments}`);

        if (reviewResult.hasComments) {
          log.info(`[AI Code Review] Generated ${reviewResult.comments.length} comments`);
          reviewResult.comments.forEach((comment, index) => {
            const preview = comment.content.length > 100 ? `${comment.content.substring(0, 100)}...` : comment.content;
            log.info(`[AI Code Review] Comment ${index + 1}: [${comment.severity}] ${comment.filePath}:${comment.lineNumber} - ${preview}`);
          });

          // 6. 通过 Comment API 创建评论
          progress.report({ message: `Creating ${reviewResult.comments.length} review comments...` });
          log.info(`[AI Code Review] Creating ${reviewResult.comments.length} review comments via Comment API...`);

          // 初始化 Comment Creator
          const commentCreator = new AIReviewCommentCreator();
          commentCreator.initializeController(mr, mrVersion);

          // 创建并自动提交评论
          const result = await commentCreator.createAndSubmitComments(
            reviewResult.comments,
            mr,
            mrVersion,
            workspaceRoot,
          );

          const { successCount: createdCount, failedCount } = result;
          successCount = createdCount;

          log.info(`[AI Code Review] Successfully created ${successCount}/${reviewResult.comments.length} comments (${failedCount} failed)`);
        }

        log.info(`[AI Code Review] Review completed for MR !${mr.iid}, total time: ${Date.now() - startTime}ms`);
      },
    );

    // 7. 进度通知关闭后，显示结果消息
    if (!reviewResult?.hasComments) {
      log.info('[AI Code Review] No comments to create, review completed');
      await vscode.window.showInformationMessage(
        `AI Code Review completed: ${reviewResult?.summary || 'No issues found'}`,
      );
    } else {
      await vscode.window.showInformationMessage(
        `AI Code Review completed: ${successCount}/${reviewResult.comments.length} comments created`,
      );
    }

    // 结束 Review 状态
    aiReviewStateManager.endReview();
  } catch (error) {
    // 出错时也要清除状态
    aiReviewStateManager.endReview();
    log.error(`[AI Code Review] Error occurred: ${error}`);
    if (error instanceof Error) {
      log.error(`[AI Code Review] Error stack: ${error.stack}`);
    }
    handleError(error);
  }
}
