import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { log } from '../../common/log';
import { ReviewPromptConfig } from './types';

const PROMPT_FILE_NAME = 'REVIEW_PROMPT.md';

/**
 * 从工作区根目录读取 Review 提示词配置
 * @param workspaceRoot 工作区根目录路径
 * @returns Review 提示词配置，如果文件不存在则返回 null
 */
export async function readPromptConfig(
  workspaceRoot: string,
): Promise<ReviewPromptConfig | null> {
  const promptFilePath = path.join(workspaceRoot, PROMPT_FILE_NAME);

  try {
    // 检查文件是否存在
    await fs.access(promptFilePath);

    // 读取文件内容
    const promptContent = await fs.readFile(promptFilePath, 'utf-8');

    if (!promptContent.trim()) {
      log.warn(`${PROMPT_FILE_NAME} is empty, AI Code Review will be skipped`);
      return null;
    }

    log.info(`Loaded AI Code Review prompt from ${promptFilePath}`);

    return {
      enabled: true,
      promptContent: promptContent.trim(),
      promptFilePath,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      log.info(
        `${PROMPT_FILE_NAME} not found in workspace root, AI Code Review will be skipped`,
      );
      return null;
    }

    log.error(`Error reading ${PROMPT_FILE_NAME}: ${error}`);
    throw error;
  }
}

/**
 * 监听 REVIEW_PROMPT.md 文件变化
 * @param workspaceRoot 工作区根目录路径
 * @param onChange 文件变化时的回调函数
 * @returns Disposable 对象
 */
export function watchPromptFile(
  workspaceRoot: string,
  onChange: (config: ReviewPromptConfig | null) => void,
): vscode.Disposable {
  const promptFilePath = path.join(workspaceRoot, PROMPT_FILE_NAME);
  const watcher = vscode.workspace.createFileSystemWatcher(promptFilePath);

  const handleChange = async () => {
    const config = await readPromptConfig(workspaceRoot);
    onChange(config);
  };

  watcher.onDidCreate(handleChange);
  watcher.onDidChange(handleChange);
  watcher.onDidDelete(() => onChange(null));

  return watcher;
}
