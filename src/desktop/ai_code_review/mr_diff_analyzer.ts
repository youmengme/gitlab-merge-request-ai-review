import * as vscode from 'vscode';
import { log } from '../../common/log';
import { DiffHunk, MRReviewContext } from './types';

/**
 * 支持的代码文件扩展名配置
 */
const DEFAULT_SUPPORTED_EXTENSIONS = [
  // JavaScript/TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  // Python
  '.py', '.pyw', '.pyi',
  // Java
  '.java', '.jar', '.class',
  // C/C++
  '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
  // C#
  '.cs', '.csx',
  // PHP
  '.php', '.phtml', '.php3', '.php4', '.php5', '.php7', '.phps',
  // Ruby
  '.rb', '.rbw',
  // Go
  '.go',
  // Rust
  '.rs',
  // Swift
  '.swift',
  // Kotlin
  '.kt', '.kts',
  // Scala
  '.scala', '.sc',
  // HTML/CSS
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  // Vue/React/Angular
  '.vue', '.svelte', '.astro',
  // 配置文件
  '.json', '.yaml', '.yml', '.toml', '.xml',
  // 其他
  '.md', '.txt', '.sh', '.bash', '.zsh', '.fish', '.ps1',
];

/**
 * 获取支持的文件扩展名配置
 */
function getSupportedExtensions(): string[] {
  const config = vscode.workspace.getConfiguration('gitlab.aiCodeReview');
  const configuredExtensions = config.get<string[]>('supportedFileExtensions') || [];

  if (configuredExtensions.length > 0) {
    log.debug(`Using configured file extensions: ${configuredExtensions.join(', ')}`);
    return configuredExtensions;
  }

  log.debug(`Using default file extensions (${DEFAULT_SUPPORTED_EXTENSIONS.length} types)`);
  return DEFAULT_SUPPORTED_EXTENSIONS;
}

/**
 * 检查文件是否应该被 review
 */
function shouldReviewFile(filePath: string): boolean {
  if (!filePath) return false;

  // 获取支持的文件类型配置
  const supportedExtensions = getSupportedExtensions();

  // 检查是否是支持的文件类型
  const isSupported = supportedExtensions.some(ext => filePath.toLowerCase().endsWith(ext));

  // 排除一些特殊文件
  const excludePatterns = [
    /^package-lock\.json$/,
    /^yarn\.lock$/,
    /^pnpm-lock\.yaml$/,
    /^.*\.min\.(js|css)$/,
    /^dist\//,
    /^build\//,
    /^node_modules\//,
    /^\.git\//,
  ];

  const shouldExclude = excludePatterns.some(pattern => pattern.test(filePath.toLowerCase()));

  const result = isSupported && !shouldExclude;
  if (!result) {
    log.debug(`Skipping file: ${filePath} (supported: ${isSupported}, excluded: ${shouldExclude})`);
  }

  return result;
}

/**
 * 从 MR 版本中提取 diff hunks
 * @param mrVersion MR 版本信息
 * @returns Diff hunks 数组
 */
export function extractDiffHunks(mrVersion: RestMrVersion): DiffHunk[] {
  const hunks: DiffHunk[] = [];

  mrVersion.diffs.forEach((diff) => {
    // 跳过空 diff
    if (!diff.diff || diff.diff === '') {
      return;
    }

    // 检查文件是否应该被 review
    if (!shouldReviewFile(diff.new_path)) {
      log.debug(`Skipping diff for file: ${diff.new_path}`);
      return;
    }

    const hunk = parseDiffHunk(diff);
    if (hunk) {
      hunks.push(hunk);
    }
  });

  log.info(`Extracted ${hunks.length} reviewable diff hunks from ${mrVersion.diffs.length} total diffs`);
  return hunks;
}

/**
 * 解析单个文件的 diff
 * @param diff GitLab diff 对象
 * @returns DiffHunk 或 null
 */
function parseDiffHunk(diff: RestDiffFile): DiffHunk | null {
  const changeType = getChangeType(diff);
  const lineNumbers = extractLineNumbers(diff.diff);

  if (!lineNumbers) {
    return null;
  }

  return {
    filePath: diff.new_path,
    oldPath: diff.old_path !== diff.new_path ? diff.old_path : undefined,
    newPath: diff.new_path,
    diffContent: diff.diff,
    changeType,
    newLineStart: lineNumbers.newStart,
    newLineEnd: lineNumbers.newEnd,
    oldLineStart: lineNumbers.oldStart,
    oldLineEnd: lineNumbers.oldEnd,
  };
}

/**
 * 确定文件变更类型
 */
function getChangeType(diff: RestDiffFile): 'added' | 'modified' | 'deleted' | 'renamed' {
  if (diff.new_file) return 'added';
  if (diff.deleted_file) return 'deleted';
  if (diff.renamed_file) return 'renamed';
  return 'modified';
}

/**
 * 从 diff 内容中提取行号信息
 * @param diffContent diff 文本内容
 * @returns 行号信息
 */
function extractLineNumbers(diffContent: string): {
  newStart: number;
  newEnd: number;
  oldStart?: number;
  oldEnd?: number;
} | null {
  // 匹配 diff hunk header: @@ -oldStart,oldCount +newStart,newCount @@
  const hunkHeaderRegex = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
  const match = diffContent.match(hunkHeaderRegex);

  if (!match) {
    return null;
  }

  const oldStart = parseInt(match[1], 10);
  const oldCount = match[2] ? parseInt(match[2], 10) : 1;
  const newStart = parseInt(match[3], 10);
  const newCount = match[4] ? parseInt(match[4], 10) : 1;

  return {
    oldStart,
    oldEnd: oldStart + oldCount - 1,
    newStart,
    newEnd: newStart + newCount - 1,
  };
}

/**
 * 创建 MR Review 上下文
 * @param mr MR 对象
 * @param mrVersion MR 版本信息
 * @returns MRReviewContext
 */
export function createMRReviewContext(
  mr: RestMr,
  mrVersion: RestMrVersion,
): MRReviewContext {
  const diffs = extractDiffHunks(mrVersion);

  return {
    mrId: mr.id,
    mrIid: mr.iid,
    projectId: mr.project_id,
    baseSha: mrVersion.base_commit_sha,
    headSha: mrVersion.head_commit_sha,
    startSha: mrVersion.start_commit_sha,
    diffs,
  };
}
