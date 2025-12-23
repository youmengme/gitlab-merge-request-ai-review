import { DISABLED_BY_USER, DisabledForSessionPolicy } from './disabled_for_session_policy';

describe('DisabledForSessionPolicy', () => {
  let policy: DisabledForSessionPolicy;

  beforeEach(() => {
    policy = new DisabledForSessionPolicy();
  });

  it('has DISABLED_BY_USER state', () => {
    expect(policy.state).toBe(DISABLED_BY_USER);
  });

  it('is not engaged by default', () => {
    expect(policy.engaged).toBe(false);
  });

  it('can be toggled', () => {
    policy.setTemporaryDisabled(true);
    expect(policy.engaged).toBe(true);
  });

  it('triggers change', () => {
    const listener = jest.fn();
    policy.onEngagedChange(listener);
    policy.setTemporaryDisabled(true);

    expect(listener).toHaveBeenCalledWith(true);
  });
});
