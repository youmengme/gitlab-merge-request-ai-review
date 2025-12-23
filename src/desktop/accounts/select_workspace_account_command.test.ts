import vscode from 'vscode';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { account } from '../../common/test_utils/entities';
import { createOAuthAccount } from '../test_utils/entities';
import {
  EXTENSION_EVENT_SOURCE,
  GITLAB_STANDARD_SCHEMA_URL,
} from '../../common/snowplow/snowplow_options';
import { Snowplow } from '../../common/snowplow/snowplow';
import { GitLabEnvironment } from '../../common/snowplow/get_environment';
import {
  AccountQuickPickItem,
  createSelectWorkspaceAccountCommand,
} from './select_workspace_account_command';
import {
  WorkspaceAccountManager,
  MULTIPLE_AVAILABLE_ACCOUNTS,
  ACCOUNT_SELECTED,
  ACCOUNT_PRESELECTED,
} from './workspace_account_manager';

jest.mock('../../common/snowplow/snowplow');

describe('select workspace account command', () => {
  let trackStructEvent: jest.Mock;
  let manager: WorkspaceAccountManager;

  beforeEach(async () => {
    trackStructEvent = jest.fn();
    jest.mocked(Snowplow.getInstance).mockReturnValue(
      createFakePartial<Snowplow>({
        trackStructEvent,
      }),
    );
    manager = createFakePartial<WorkspaceAccountManager>({
      state: {
        type: MULTIPLE_AVAILABLE_ACCOUNTS,
        availableAccounts: [account, createOAuthAccount()],
      },
      selectAccount: jest.fn(),
    });
    const command = createSelectWorkspaceAccountCommand(manager);
    const accountItem: AccountQuickPickItem = {
      label: account.username,
      description: account.instanceUrl,
      account,
    };
    jest.mocked(vscode.window.showQuickPick).mockResolvedValue(accountItem);
    await command();
  });

  it('selects account', async () => {
    expect(manager.selectAccount).toHaveBeenCalledWith(account);
  });

  it('tracks command execution', async () => {
    const standardContext = {
      schema: GITLAB_STANDARD_SCHEMA_URL,
      data: {
        environment: GitLabEnvironment.GITLAB_SELF_MANAGED,
        source: EXTENSION_EVENT_SOURCE,
      },
    };
    expect(trackStructEvent).toHaveBeenCalledWith(
      {
        category: 'account_management',
        action: 'select_workspace_account_command',
      },
      [standardContext, 'ide-extension-context'],
    );
  });
});

describe('account ordering', () => {
  const activeAccount = account;
  const secondAccount = createOAuthAccount('https://example.com', 1);
  const thirdAccount = createOAuthAccount('https://example.com', 2);

  beforeEach(() => {
    jest.mocked(vscode.window.showQuickPick).mockReset();
  });

  it.each([ACCOUNT_SELECTED, ACCOUNT_PRESELECTED])(
    'shows active account first when in %s',
    async stateType => {
      const manager = createFakePartial<WorkspaceAccountManager>({
        state: {
          type: stateType,
          account: activeAccount,
          availableAccounts: [secondAccount, thirdAccount, activeAccount],
        },
      });

      const command = createSelectWorkspaceAccountCommand(manager);
      await command();

      // First item should be the active account
      const quickPickItems = jest.mocked(vscode.window.showQuickPick).mock
        .calls[0][0] as AccountQuickPickItem[];
      expect(quickPickItems[0].account).toBe(activeAccount);
      expect(quickPickItems).toHaveLength(3);
    },
  );
});
