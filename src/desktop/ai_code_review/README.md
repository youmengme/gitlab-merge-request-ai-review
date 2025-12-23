# AI Code Review for Merge Requests

## 功能说明

这个模块为 GitLab Workflow VSCode 扩展添加了 AI Code Review MR 的功能。

### 主要特性

1. **自定义 Review 提示词**：通过项目根目录的 `REVIEW_PROMPT.md` 文件自定义 AI Review 规则
2. **智能 Diff 分析**：只对 MR 的变更部分进行 Review，不浪费 AI 资源
3. **自动添加评论**：将 AI 的 Review 意见直接添加到 GitLab MR 的相应文件和行号

## 文件结构

```
ai_code_review/
├── README.md                         # 本文件
├── types.ts                          # TypeScript 类型定义
├── review_prompt_reader.ts           # 读取和监听 REVIEW_PROMPT.md
├── mr_diff_analyzer.ts               # 分析 MR diff，提取变更信息
├── ai_code_review_service.ts         # 核心服务，协调整个 Review 流程
├── review_comment_creator.ts         # 在 GitLab 上创建 Review 评论
└── commands/
    └── review_mr_command.ts          # VSCode 命令实现
```

## 工作流程

```
1. 用户执行命令 "gl.aiReviewMR"
   ↓
2. 读取项目根目录的 REVIEW_PROMPT.md
   ├─ 如果文件不存在 → 跳过 Review
   └─ 如果文件存在 → 继续
   ↓
3. 获取当前 MR 的 diff 信息
   ├─ 提取所有变更的文件
   ├─ 解析每个文件的 diff hunks
   └─ 记录行号信息
   ↓
4. 构建 AI 提示词
   ├─ 包含用户自定义的 Review 规则
   ├─ 包含 MR 的元信息
   └─ 包含格式化的 diff 内容
   ↓
5. 调用 GitLab Duo AI API
   ├─ 发送提示词
   └─ 接收 AI 响应
   ↓
6. 解析 AI 响应
   ├─ 提取 JSON 格式的 Review 评论
   ├─ 验证评论的有效性
   └─ 过滤无效评论
   ↓
7. 创建 GitLab 评论
   ├─ 为每个 Review 意见创建 diff 评论
   ├─ 包含严重程度标记（error/warning/info）
   └─ 添加 AI 生成标识
   ↓
8. 显示完成通知
```

## 使用方法

### 1. 创建 REVIEW_PROMPT.md

在项目根目录创建 `REVIEW_PROMPT.md` 文件，例如：

```markdown
# Code Review Guidelines

请按照以下标准审查代码：

## 代码质量
- 检查潜在的 bug 和逻辑错误
- 验证错误处理是否完善
- 查找性能问题

## 最佳实践
- 遵循语言特定的约定
- 检查安全漏洞
- 确保资源正确管理

## 代码风格
- 一致的命名规范
- 适当的代码组织
- 复杂逻辑需要注释
```

### 2. 执行 Review

- 打开命令面板：`Cmd+Shift+P` (Mac) 或 `Ctrl+Shift+P` (Windows/Linux)
- 输入并选择：`GitLab: AI Code Review for Merge Request`
- 如果有多个项目或 MR，选择要 Review 的目标
- 等待 AI 完成分析并创建评论

### 3. 查看结果

- AI 会在 GitLab MR 页面添加评论
- 每个评论会标注严重程度（🚨 error / ⚠️ warning / ℹ️ info）
- 评论会附加 "AI Code Review" 标识

## API 集成

### 当前状态

`ai_code_review_service.ts` 中的 `#callAIChatAPI` 方法需要实现实际的 AI API 调用。

### 实现选项

#### 选项 1: 使用 GitLab Duo Chat API

```typescript
async #callAIChatAPI(prompt: string): Promise<string> {
  const environment = await this.#manager.getGitLabEnvironment();
  
  const response = await fetch(`${environment.baseUrl}/api/v4/ai/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${environment.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      // 其他参数
    }),
  });
  
  const data = await response.json();
  return data.content;
}
```

#### 选项 2: 使用 GitLab Language Server

如果 LSP 支持 Code Review 功能，可以通过 Language Server 调用。

## 类型定义

### ReviewPromptConfig

```typescript
interface ReviewPromptConfig {
  enabled: boolean;           // 是否启用
  promptContent: string;      // 提示词内容
  promptFilePath: string;     // 文件路径
}
```

### DiffHunk

```typescript
interface DiffHunk {
  filePath: string;           // 文件路径
  oldPath?: string;           // 旧路径（重命名时）
  newPath: string;            // 新路径
  diffContent: string;        // diff 内容
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  newLineStart: number;       // 新文件起始行
  newLineEnd: number;         // 新文件结束行
  oldLineStart?: number;      // 旧文件起始行
  oldLineEnd?: number;        // 旧文件结束行
}
```

### ReviewComment

```typescript
interface ReviewComment {
  filePath: string;           // 文件路径
  lineNumber: number;         // 行号
  content: string;            // 评论内容
  severity: 'info' | 'warning' | 'error';  // 严重程度
  oldLineNumber?: number;     // 旧文件行号
}
```

## 配置选项（待添加到 package.json）

```json
{
  "gitlab.aiCodeReview.enabled": {
    "type": "boolean",
    "default": true,
    "description": "启用 AI Code Review"
  },
  "gitlab.aiCodeReview.autoReview": {
    "type": "boolean",
    "default": false,
    "description": "打开 MR 时自动执行 Review"
  }
}
```

## 待完成的工作

1. **修复编译错误**
   - 修正 `UserFriendlyError` 构造函数调用
   - 使用正确的 API 获取项目和 MR 列表
   - 添加 Promise 处理

2. **实现 AI API 调用**
   - 集成 GitLab Duo Chat API
   - 或使用 Language Server

3. **注册命令**
   - 在 `package.json` 中添加命令定义
   - 在 `extension.ts` 中注册命令

4. **添加测试**
   - 单元测试
   - 集成测试

5. **优化和增强**
   - 添加进度取消功能
   - 支持大型 MR 的分批处理
   - 添加 Review 历史记录

## 依赖关系

- `../../common/log`：日志记录
- `../../common/chat/gitlab_chat_api`：GitLab Chat API
- `../../common/chat/get_platform_manager_for_chat`：平台管理器
- `../../common/chat/ai_context_manager`：AI 上下文管理
- `../gitlab/get_gitlab_service`：GitLab 服务
- `../gitlab/gitlab_project_repository`：项目仓库
- `../gitlab/mr_cache`：MR 缓存

## 参考资料

- [GitLab Duo Chat API 文档](https://docs.gitlab.com/ee/api/ai/)
- [VSCode 扩展开发指南](https://code.visualstudio.com/api)
- [GitLab MR API](https://docs.gitlab.com/ee/api/merge_requests.html)
