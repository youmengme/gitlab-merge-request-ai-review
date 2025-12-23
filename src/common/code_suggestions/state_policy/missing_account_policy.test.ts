import { GitLabPlatform } from '../../platform/gitlab_platform';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { gitlabPlatformForAccount } from '../../test_utils/entities';
import { GitLabPlatformManagerForCodeSuggestions } from '../gitlab_platform_manager_for_code_suggestions';
import { MissingAccountPolicy, NO_ACCOUNT } from './missing_account_policy';

describe('MissingAccountPolicy', () => {
  let gitlabPlatform: GitLabPlatform | undefined;
  let onAccountChange = jest.fn();
  let policy: MissingAccountPolicy;

  beforeEach(() => {
    onAccountChange = jest.fn();

    const manager = createFakePartial<GitLabPlatformManagerForCodeSuggestions>({
      getGitLabPlatform: async () => gitlabPlatform,
      onAccountChange,
    });
    policy = new MissingAccountPolicy(manager);
  });

  it('has NO_ACCOUNT state', () => {
    expect(policy.state).toBe(NO_ACCOUNT);
  });

  it('is not engaged when there is a platform(account)', async () => {
    gitlabPlatform = gitlabPlatformForAccount;

    await policy.init();

    expect(policy.engaged).toBe(false);
  });

  it('is engaged when there is no platform(account)', async () => {
    gitlabPlatform = undefined;

    await policy.init();

    expect(policy.engaged).toBe(true);
  });

  it('fires onEngagedChange event when the engaged changes', async () => {
    // start in engaged state (no account)
    gitlabPlatform = undefined;
    const listener = jest.fn();
    policy.onEngagedChange(listener);

    await policy.init();

    expect(listener).not.toHaveBeenCalled();

    onAccountChange.mock.calls[0][0](gitlabPlatformForAccount); // account added

    expect(listener).toHaveBeenCalledWith(false);

    onAccountChange.mock.calls[0][0](undefined); // account removed

    expect(listener).toHaveBeenCalledWith(true);
  });
});
