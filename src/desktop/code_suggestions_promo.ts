import * as vscode from 'vscode';
import { GITLAB_COM_URL } from '../common/constants';
import { DISMISSED_CODE_SUGGESTIONS_PROMO } from './constants';
import { accountService } from './accounts/account_service';

const DOCS_LINK = 'https://docs.gitlab.com/user/project/repository/code_suggestions/';

function isImmediatelyEligibleForPromo() {
  return accountService.getAllAccounts().some(account => account.instanceUrl === GITLAB_COM_URL);
}

// FIXME: Custom messages like these are deprecated in favour of the
// src/common/user_message.ts component
async function showPromo() {
  const LEARN_MORE_ACTION = 'Learn more';

  const selection = await vscode.window.showInformationMessage(
    'Get started with Code Suggestions. Code faster and more efficiently with AI-powered code suggestions in VS Code. Many languages are supported, including JavaScript, Python, Go, Java, Kotlin and Terraform. Enable Code Suggestions in your user profile, or see the documentation to learn more.',
    LEARN_MORE_ACTION,
    'Dismiss',
  );

  if (selection === LEARN_MORE_ACTION) {
    await vscode.env.openExternal(vscode.Uri.parse(DOCS_LINK));
  }

  return selection;
}

function markBannerAsDismissed(context: vscode.ExtensionContext) {
  return context.globalState.update(DISMISSED_CODE_SUGGESTIONS_PROMO, true);
}
export const setupCodeSuggestionsPromo = (context: vscode.ExtensionContext) => {
  if (context.globalState.get(DISMISSED_CODE_SUGGESTIONS_PROMO)) return;

  if (isImmediatelyEligibleForPromo()) {
    const changeListener = vscode.workspace.onDidChangeTextDocument(async () => {
      await showPromo();
      await markBannerAsDismissed(context);
      changeListener.dispose();
    });
  } else {
    const accountChangeListener = accountService.onDidChange(async () => {
      if (isImmediatelyEligibleForPromo()) {
        await showPromo();
        await markBannerAsDismissed(context);
        accountChangeListener.dispose();
      }
    });
  }
};
