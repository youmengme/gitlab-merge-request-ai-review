# AI Code Review 快速开始指南

## 🚀 5 分钟快速上手

### 1. 安装依赖 (1 分钟)

```bash
cd /Users/youmeng/MyProjects/gitlab-vscode-extension-main
npm install
```

### 2. 配置 OpenAI API Key (1 分钟)

**方式 A: 环境变量（推荐）**
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

**方式 B: VS Code 设置**
- 打开设置：`Cmd+,`
- 搜索：`gitlab.aiCodeReview.openai.apiKey`
- 填入你的 API Key

### 3. 注册命令 (2 分钟)

打开 `src/desktop/extension.ts`，找到 `activate` 函数，添加：

```typescript
// 在文件顶部导入
import { aiReviewMRCommand, COMMAND_AI_REVIEW_MR } from './ai_code_review/commands/review_mr_command';

// 在 activate 函数中，找到其他 vscode.commands.registerCommand 的地方，添加：
context.subscriptions.push(
  vscode.commands.registerCommand(COMMAND_AI_REVIEW_MR, () =>
    aiReviewMRCommand(platformManager, aiContextManager)
  )
);
```

**注意**：确保 `platformManager` 和 `aiContextManager` 变量名与实际代码中的一致。

### 4. 编译和运行 (1 分钟)

```bash
# 开发模式
npm run watch:desktop

# 然后按 F5 启动调试
```

### 5. 测试功能 (立即)

1. 在测试项目根目录创建 `REVIEW_PROMPT.md`（可以复制提供的示例）
2. 打开 GitLab Workflow 侧边栏，加载一个 MR
3. 打开命令面板：`Cmd+Shift+P`
4. 运行：`GitLab: AI Code Review for Merge Request`
5. 等待 AI 分析并在 GitLab 上查看评论

## 📝 最小化配置

如果你只想快速测试，最少只需要：

1. **安装依赖**：`npm install`
2. **设置 API Key**：`export OPENAI_API_KEY="sk-..."`
3. **注册命令**：在 `extension.ts` 中添加 3 行代码
4. **运行**：`npm run watch:desktop` + `F5`

## 🎯 完整流程示例

```bash
# 1. 安装
npm install

# 2. 配置
export OPENAI_API_KEY="sk-..."

# 3. 编译
npm run watch:desktop

# 4. 在另一个终端，按 F5 启动调试

# 5. 在扩展宿主中：
#    - 打开一个 GitLab 项目
#    - 在项目根目录创建 REVIEW_PROMPT.md
#    - 打开 MR 视图
#    - Cmd+Shift+P -> "GitLab: AI Code Review for Merge Request"
```

## ⚠️ 常见问题

### Q: "找不到模块 openai"
**A**: 运行 `npm install`

### Q: "OpenAI API key not configured"
**A**: 设置环境变量或 VS Code 设置中的 API Key

### Q: "No merge request found"
**A**: 先在 GitLab Workflow 侧边栏中打开 MR 视图，确保 MR 数据被加载

### Q: 命令不出现在命令面板
**A**: 检查是否在 `extension.ts` 中正确注册了命令

## 📖 详细文档

- **完整实现指南**: `AI_CODE_REVIEW_IMPLEMENTATION_GUIDE.md`
- **设置和使用**: `AI_CODE_REVIEW_SETUP.md`
- **完成总结**: `AI_CODE_REVIEW_COMPLETION_SUMMARY.md`
- **模块文档**: `src/desktop/ai_code_review/README.md`

## 💡 提示

- 开发测试时使用 `gpt-3.5-turbo` 节省成本
- 重要 MR 使用 `gpt-4` 获得更好的审查质量
- 自定义 `REVIEW_PROMPT.md` 以符合团队规范
