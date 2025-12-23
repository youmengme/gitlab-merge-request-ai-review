# AI Code Review MR 功能实现指南

## 概述

本文档说明如何在 GitLab Workflow VSCode 扩展中实现 AI Code Review MR 功能。

## 功能需求

1. **读取项目 Review 提示词**：从项目根目录的 `REVIEW_PROMPT.md` 文件读取 AI Review 提示词
2. **只 Review Diff 部分**：仅对 MR 的变更部分进行 Review
3. **添加 Review 评论**：将 AI 的 Review 意见作为评论添加到指定文件的指定行

## 已创建的文件

### 核心模块

```
src/desktop/ai_code_review/
├── types.ts                          # 类型定义
├── review_prompt_reader.ts           # 读取 REVIEW_PROMPT.md
├── mr_diff_analyzer.ts               # 分析 MR diff
├── ai_code_review_service.ts         # AI Review 服务
├── review_comment_creator.ts         # 创建 Review 评论
└── commands/
    └── review_mr_command.ts          # 命令实现
```

## 实现步骤

### 步骤 1: 注册命令到 package.json

在 `package.json` 的 `contributes.commands` 中添加：

```json
{
  "command": "gl.aiReviewMR",
  "title": "AI Code Review for Merge Request",
  "category": "GitLab"
}
```

在 `contributes.menus` 中添加菜单项（可选）：

```json
"commandPalette": [
  {
    "command": "gl.aiReviewMR",
    "when": "config.gitlab.duoChat.enabled"
  }
]
```

### 步骤 2: 在扩展主入口注册命令

在 `src/desktop/extension.ts` 中：

```typescript
import { aiReviewMRCommand, COMMAND_AI_REVIEW_MR } from './ai_code_review/commands/review_mr_command';

// 在 activate 函数中注册命令
context.subscriptions.push(
  vscode.commands.registerCommand(
    COMMAND_AI_REVIEW_MR,
    () => aiReviewMRCommand(platformManager, aiContextManager)
  )
);
```

### 步骤 3: 实现 AI API 调用

当前 `ai_code_review_service.ts` 中的 `#callAIChatAPI` 方法需要实现实际的 AI API 调用。

有两种实现方式：

#### 方式 A: 使用 GitLab Duo Chat API（推荐）

参考 `src/common/chat/gitlab_chat_api.ts` 的实现：

```typescript
async #callAIChatAPI(prompt: string): Promise<string> {
  const environment = await this.#manager.getGitLabEnvironment();
  
  // 构建 AI 请求
  const request = {
    prompt,
    // 其他必要参数
  };
  
  // 调用 GitLab AI API
  const response = await fetch(`${environment.baseUrl}/api/v4/ai/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${environment.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  const data = await response.json();
  return data.content;
}
```

#### 方式 B: 使用 Language Server

如果 GitLab LSP 支持 Code Review，可以通过 Language Server 调用：

```typescript
async #callAIChatAPI(prompt: string): Promise<string> {
  // 通过 Language Server 调用 AI
  // 参考 src/common/language_server/ 中的实现
}
```

### 步骤 4: 创建 REVIEW_PROMPT.md 示例

在项目根目录创建示例文件：

```markdown
# AI Code Review Guidelines

Please review the code changes with the following criteria:

## Code Quality
- Check for potential bugs and logic errors
- Verify error handling
- Look for performance issues

## Best Practices
- Follow language-specific conventions
- Check for security vulnerabilities
- Ensure proper resource management

## Code Style
- Consistent naming conventions
- Proper code organization
- Adequate comments for complex logic

## Output Format
Provide specific, actionable feedback for each issue found.
```

### 步骤 5: 修复当前的编译错误

需要修复以下问题：

1. **UserFriendlyError 构造函数**：需要两个参数
   ```typescript
   throw new UserFriendlyError('Message', new Error('Details'));
   ```

2. **获取所有项目**：使用正确的 API
   ```typescript
   const projects = projectRepository.getProjects(); // 或其他正确的方法
   ```

3. **获取所有 MRs**：检查 mrCache 的正确 API
   ```typescript
   const allMRs = mrCache.getMrs(selectedProject); // 检查正确的方法名
   ```

4. **Promise 处理**：添加 void 或 await
   ```typescript
   void vscode.window.showInformationMessage(...);
   ```

### 步骤 6: 添加配置选项

在 `package.json` 的 `configuration` 中添加：

```json
{
  "gitlab.aiCodeReview.enabled": {
    "type": "boolean",
    "default": true,
    "description": "Enable AI Code Review for Merge Requests"
  },
  "gitlab.aiCodeReview.autoReview": {
    "type": "boolean",
    "default": false,
    "description": "Automatically review MR when opened"
  }
}
```

### 步骤 7: 添加测试

创建测试文件：

```
src/desktop/ai_code_review/__tests__/
├── review_prompt_reader.test.ts
├── mr_diff_analyzer.test.ts
├── ai_code_review_service.test.ts
└── review_comment_creator.test.ts
```

## 使用流程

1. **准备工作**
   - 在项目根目录创建 `REVIEW_PROMPT.md` 文件
   - 配置 GitLab Duo Chat

2. **执行 Review**
   - 打开命令面板 (Cmd+Shift+P)
   - 运行 "GitLab: AI Code Review for Merge Request"
   - 选择要 Review 的 MR（如果有多个）

3. **查看结果**
   - AI 会分析 MR 的 diff
   - 在相应文件的相应行添加评论
   - 显示完成通知

## 架构流程图

```
用户触发命令
    ↓
读取 REVIEW_PROMPT.md
    ↓
获取 MR 和 diff 信息
    ↓
提取 diff hunks
    ↓
构建 AI 提示词
    ↓
调用 GitLab Duo AI API
    ↓
解析 AI 响应
    ↓
创建 GitLab 评论
    ↓
显示完成结果
```

## 注意事项

1. **API 限制**：注意 GitLab AI API 的调用频率限制
2. **大型 MR**：对于大型 MR，可能需要分批处理
3. **错误处理**：确保所有异步操作都有适当的错误处理
4. **用户反馈**：使用进度提示让用户了解处理状态

## 下一步优化

1. **增量 Review**：只 Review 新增的 commits
2. **Review 历史**：保存 Review 历史记录
3. **自定义规则**：支持更细粒度的 Review 规则配置
4. **批量 Review**：支持一次 Review 多个 MR
5. **Review 报告**：生成 Review 总结报告

## 相关文件参考

- MR 相关：`src/desktop/tree_view/items/mr_item_model.ts`
- Diff 处理：`src/desktop/git/diff_line_count.ts`
- 评论创建：`src/desktop/commands/mr_discussion_commands.ts`
- AI Chat：`src/common/chat/gitlab_chat_api.ts`

## 调试建议

1. 使用 VS Code 调试器运行扩展
2. 查看 "GitLab Workflow" 输出面板的日志
3. 使用 `log.info()` 和 `log.error()` 记录关键步骤
4. 测试时使用小型 MR 以加快迭代速度
