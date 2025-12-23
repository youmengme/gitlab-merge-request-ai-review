import { createFakePartial } from '../../test_utils/create_fake_partial';
import { CombinedPolicy } from './combined_policy';
import { StatePolicy } from './state_policy';

describe('CombinedPolicy', () => {
  let policy1: StatePolicy;

  let policy2: StatePolicy;

  let combined: StatePolicy;

  beforeEach(() => {
    policy1 = createFakePartial<StatePolicy>({
      onEngagedChange: jest.fn(),
      engaged: false,
      state: 'policy1',
    });
    policy2 = createFakePartial<StatePolicy>({
      onEngagedChange: jest.fn(),
      engaged: false,
      state: 'policy2',
    });

    combined = new CombinedPolicy(policy1, policy2);
  });

  it('needs at least one policy', () => {
    expect(() => new CombinedPolicy()).toThrow();
  });

  it('is engaged if at least one policy is engaged', () => {
    expect(combined.engaged).toBe(false);

    policy1.engaged = true;

    expect(combined.engaged).toBe(true);
  });

  it('takes state from first policy if they are not engaged', () => {
    expect(combined.state).toBe('policy1');
  });

  it('takes state from first engaged policy', () => {
    policy2.engaged = true;

    expect(combined.state).toBe('policy2');
  });

  it('notifies listeners if any dependency changes', () => {
    const listener = jest.fn();
    combined.onEngagedChange(listener);

    policy1.engaged = true;
    jest.mocked(policy1.onEngagedChange).mock.calls[0][0](true);

    expect(listener).toHaveBeenCalledWith(true);
  });
});
