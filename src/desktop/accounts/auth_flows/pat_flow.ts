import vscode from 'vscode';
import { Account, makeAccountId } from '../../../common/platform/gitlab_account';
import { openUrl } from '../../commands/openers';
import { getUserForCredentialsOrFail } from '../get_user_for_credentials_or_fail';
import { Flow } from './flow';

export const ENTER_TOKEN_CHOICE = {
  label: 'Enter an existing token',
  description: "The token must have 'api' scope.",
};
export const CREATE_TOKEN_CHOICE = {
  label: 'Create a token first',
  description: 'Opens the settings page to create a new token.',
};

export const createPatFlow: () => Flow = () => ({
  title: 'Personal Access Token',

  description: "Authenticate using a PAT. We'll help you create one.",

  supportsGitLabInstance: () => true,

  async authenticate(instanceUrl): Promise<Account | undefined> {
    const tokenChoice = await vscode.window.showQuickPick(
      [CREATE_TOKEN_CHOICE, ENTER_TOKEN_CHOICE],
      {
        title: 'Do you want to create a new token?',
        ignoreFocusOut: true,
      },
    );
    if (!tokenChoice) return undefined;
    if (tokenChoice === CREATE_TOKEN_CHOICE) {
      await openUrl(
        `${instanceUrl}/-/user_settings/personal_access_tokens?name=GitLab+Workflow+Extension&scopes=api`,
      );
    }
    const token = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      password: true,
      placeHolder: 'Paste your GitLab Personal Access Token...',
    });

    if (!token) return undefined;
    const user = await getUserForCredentialsOrFail({ instanceUrl, token });
    return {
      instanceUrl,
      token,
      id: makeAccountId(instanceUrl, user.id),
      username: user.username,
      type: 'token',
    };
  },
});
