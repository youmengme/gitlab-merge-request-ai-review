# AI Code Review 功能设置和使用指南

## 快速开始

### 1. 安装依赖

首先需要安装 OpenAI npm 包：

```bash
npm install
```

这会安装 `openai@^4.77.0` 包（已添加到 package.json）。

### 2. 配置 OpenAI API

有两种方式配置 OpenAI API Key：

#### 方式 A: 通过 VS Code 设置（推荐）

1. 打开 VS Code 设置（`Cmd+,` 或 `Ctrl+,`）
2. 搜索 `gitlab.aiCodeReview`
3. 配置以下选项：
   - **API Key**: `gitlab.aiCodeReview.openai.apiKey`
   - **Endpoint**: `gitlab.aiCodeReview.openai.endpoint`（默认：`https://api.openai.com/v1`）
   - **Model**: `gitlab.aiCodeReview.openai.model`（可选：`gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`）

#### 方式 B: 通过环境变量

设置环境变量 `OPENAI_API_KEY`：

```bash
export OPENAI_API_KEY="your-api-key-here"
```

### 3. 创建 Review 提示词文件

在项目根目录创建 `REVIEW_PROMPT.md` 文件（已提供示例文件）：

```bash
# 使用提供的示例
cp REVIEW_PROMPT.md your-project-root/REVIEW_PROMPT.md

# 或者自定义你的 Review 规则
vim your-project-root/REVIEW_PROMPT.md
```

### 4. 注册命令到扩展

需要在 `src/desktop/extension.ts` 中注册命令。找到 `activate` 函数，添加：

```typescript
import { aiReviewMRCommand, COMMAND_AI_REVIEW_MR } from './ai_code_review/commands/review_mr_command';

// 在 activate 函数中
context.subscriptions.push(
  vscode.commands.registerCommand(COMMAND_AI_REVIEW_MR, () =>
    aiReviewMRCommand(platformManager, aiContextManager)
  )
);
```

**注意**：需要确保 `platformManager` 和 `aiContextManager` 已经初始化。

### 5. 编译和运行

```bash
# 编译扩展
npm run build:desktop

# 或在开发模式下运行
npm run watch:desktop
```

然后按 `F5` 启动调试。

## 使用方法

### 执行 AI Code Review

1. **打开 MR 视图**
   - 确保已经在 GitLab Workflow 侧边栏中打开了 MR
   - 这会加载 MR 数据到缓存中

2. **运行命令**
   - 打开命令面板：`Cmd+Shift+P` (Mac) 或 `Ctrl+Shift+P` (Windows/Linux)
   - 输入并选择：`GitLab: AI Code Review for Merge Request`

3. **等待处理**
   - 扩展会读取 `REVIEW_PROMPT.md`
   - 分析 MR 的 diff
   - 调用 OpenAI API
   - 在 GitLab 上创建评论

4. **查看结果**
   - 在 GitLab MR 页面查看 AI 添加的评论
   - 每个评论会标注严重程度（🚨 error / ⚠️ warning / ℹ️ info）

## 配置选项详解

### gitlab.aiCodeReview.enabled
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 是否启用 AI Code Review 功能

### gitlab.aiCodeReview.openai.endpoint
- **类型**: `string`
- **默认值**: `https://api.openai.com/v1`
- **说明**: OpenAI API 端点 URL
- **用途**: 可以配置为兼容 OpenAI 的其他服务（如 Azure OpenAI）

### gitlab.aiCodeReview.openai.apiKey
- **类型**: `string`
- **默认值**: `""`
- **说明**: OpenAI API Key
- **注意**: 如果为空，会使用环境变量 `OPENAI_API_KEY`

### gitlab.aiCodeReview.openai.model
- **类型**: `string`
- **默认值**: `gpt-4`
- **可选值**: 
  - `gpt-4`: 最强大，但较慢且贵
  - `gpt-4-turbo`: 更快，成本较低
  - `gpt-3.5-turbo`: 最快，成本最低
- **说明**: 用于代码审查的 AI 模型

## 自定义 Review 规则

编辑项目根目录的 `REVIEW_PROMPT.md` 文件来自定义审查规则：

```markdown
# 我的团队代码审查规则

## 必须检查的项目
1. 所有公共方法必须有 JSDoc 注释
2. 禁止使用 `any` 类型
3. 所有异步函数必须有错误处理

## 输出格式
请按照 JSON 格式输出...
```

**重要**：必须保持输出格式部分，确保 AI 返回正确的 JSON 格式。

## 故障排除

### 问题 1: "OpenAI API key not configured"

**解决方法**：
- 检查 VS Code 设置中的 `gitlab.aiCodeReview.openai.apiKey`
- 或设置环境变量 `OPENAI_API_KEY`

### 问题 2: "REVIEW_PROMPT.md not found"

**解决方法**：
- 在项目根目录创建 `REVIEW_PROMPT.md` 文件
- 可以复制提供的示例文件

### 问题 3: "No merge request found"

**解决方法**：
- 先在 GitLab Workflow 侧边栏中打开 MR 视图
- 确保 MR 数据已加载到缓存
- 或者修改代码以直接从 GitLab API 获取 MR

### 问题 4: "Unable to resolve path to module 'openai'"

**解决方法**：
```bash
npm install openai@^4.77.0
```

### 问题 5: OpenAI API 调用失败

**可能原因**：
- API Key 无效
- 网络问题（需要代理）
- API 配额用尽
- Endpoint 配置错误

**解决方法**：
- 检查 API Key 是否正确
- 配置代理（如果需要）
- 检查 OpenAI 账户余额
- 验证 Endpoint URL

## 成本估算

使用 OpenAI API 会产生费用，以下是大致估算：

### GPT-4
- **输入**: ~$0.03 / 1K tokens
- **输出**: ~$0.06 / 1K tokens
- **单次 Review**: 约 $0.10 - $0.50（取决于 diff 大小）

### GPT-3.5-Turbo
- **输入**: ~$0.0015 / 1K tokens
- **输出**: ~$0.002 / 1K tokens
- **单次 Review**: 约 $0.01 - $0.05

**建议**：
- 开发时使用 `gpt-3.5-turbo` 测试
- 重要 MR 使用 `gpt-4` 进行详细审查

## 高级用法

### 使用 Azure OpenAI

```json
{
  "gitlab.aiCodeReview.openai.endpoint": "https://your-resource.openai.azure.com/openai/deployments/your-deployment",
  "gitlab.aiCodeReview.openai.apiKey": "your-azure-api-key",
  "gitlab.aiCodeReview.openai.model": "gpt-4"
}
```

### 使用本地 LLM（如 Ollama）

如果你运行了兼容 OpenAI API 的本地模型：

```json
{
  "gitlab.aiCodeReview.openai.endpoint": "http://localhost:11434/v1",
  "gitlab.aiCodeReview.openai.apiKey": "ollama",
  "gitlab.aiCodeReview.openai.model": "codellama"
}
```

## 开发和调试

### 查看日志

1. 打开 VS Code 输出面板
2. 选择 "GitLab Workflow" 频道
3. 查看详细的执行日志

### 调试模式

在 `settings.json` 中启用调试：

```json
{
  "gitlab.debug": true
}
```

### 测试 API 调用

可以直接测试 OpenAI API：

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'your-api-key',
});

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

## 下一步优化

1. **支持更多 AI 提供商**
   - Anthropic Claude
   - Google Gemini
   - 本地模型

2. **增量 Review**
   - 只 Review 新增的 commits
   - 避免重复审查

3. **Review 历史**
   - 保存 Review 记录
   - 生成 Review 报告

4. **批量 Review**
   - 一次审查多个 MR
   - 定时自动审查

## 参考资料

- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)
- [GitLab MR API](https://docs.gitlab.com/ee/api/merge_requests.html)
- [VS Code 扩展开发](https://code.visualstudio.com/api)
