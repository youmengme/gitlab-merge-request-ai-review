import vscode from 'vscode';
import { uniq } from 'lodash';
import { GitExtensionWrapper } from '../git/git_extension_wrapper';
import { parseGitLabRemote } from '../git/git_remote_parser';
import { notNullOrUndefined } from '../../common/utils/not_null_or_undefined';
import { handleError } from '../../common/errors/handle_error';
import { GITLAB_COM_URL } from '../../common/constants';
import { validateInstanceUrl } from '../utils/validate_instance_url';
import { removeTrailingSlash } from '../utils/remove_trailing_slash';
import { AccountService } from './account_service';
import { Flow } from './auth_flows/flow';
import { createPatFlow } from './auth_flows/pat_flow';
import { OAuthFlow } from './auth_flows/oauth_flow';

export const MANUAL_INSTANCE_URL_CHOICE = 'Manually enter instance URL';
export const AUTH_URL_DENY_LIST = ['github.com', 'bitbucket.org', 'gitea.com'];

export class AuthenticateCommand {
  #gitExtensionWrapper: GitExtensionWrapper;

  #accountService: AccountService;

  #flows: Flow[] = [new OAuthFlow(), createPatFlow()];

  constructor(gitExtensionWrapper: GitExtensionWrapper, accountService: AccountService) {
    this.#gitExtensionWrapper = gitExtensionWrapper;
    this.#accountService = accountService;
  }

  get #possibleInstanceUrls() {
    const remoteUrls = uniq(
      this.#gitExtensionWrapper.gitRepositories.flatMap(repo =>
        repo.remotes.flatMap(remote => remote.urlEntries.flatMap(urlEntry => urlEntry.url)),
      ),
    );
    const hosts = remoteUrls.map(url => parseGitLabRemote(url)?.host).filter(notNullOrUndefined);
    const gitlabHosts = hosts.filter(
      host => !AUTH_URL_DENY_LIST.some(denyHost => host.endsWith(denyHost)),
    );
    const instanceUrls = gitlabHosts.map(h => `https://${h}`);
    // always prepend gitlab.com
    return uniq([GITLAB_COM_URL, ...instanceUrls]);
  }

  run = async (previousInstanceUrl?: string) => {
    // TODO: we could improve this prompt by pinging the instances before showing them in the quick pick
    const instanceUrlChoice =
      previousInstanceUrl ??
      (await vscode.window.showQuickPick(
        [...this.#possibleInstanceUrls, MANUAL_INSTANCE_URL_CHOICE],
        { title: 'Select GitLab instance' },
      ));

    if (!instanceUrlChoice) return;
    let instanceUrl;
    if (instanceUrlChoice === MANUAL_INSTANCE_URL_CHOICE) {
      const rawInstanceUrl = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        value: GITLAB_COM_URL,
        placeHolder: 'E.g. https://gitlab.com',
        prompt: 'URL to GitLab instance',
        validateInput: validateInstanceUrl,
      });
      if (!rawInstanceUrl) return;
      instanceUrl = removeTrailingSlash(rawInstanceUrl);
    } else {
      instanceUrl = instanceUrlChoice;
    }

    const flows = this.#flows.filter(flow => flow.supportsGitLabInstance(instanceUrl));
    let flow: Flow;

    // this should never happen
    if (flows.length === 0)
      throw new Error(`Assertion error: no authentication flows support ${instanceUrl}`);

    if (flows.length === 1) {
      [flow] = flows;
    } else {
      const options = flows.map(f => ({ label: f.title, description: f.description, flow: f }));
      const flowChoice = await vscode.window.showQuickPick(options, {
        title: 'Select authentication method',
      });
      if (!flowChoice) return;
      flow = flowChoice.flow;
    }

    try {
      const account = await flow.authenticate(instanceUrl);
      if (!account) return;
      await this.#accountService.addAccount(account);
      await vscode.window.showInformationMessage(
        `Added GitLab account for user ${account.username} on ${account.instanceUrl}.`,
      );
    } catch (e) {
      handleError(e);
    }
  };
}
