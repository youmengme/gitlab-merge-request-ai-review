import { createFakeRepository } from '../test_utils/fake_git_extension';
import { newRemoteName } from './new_remote_name';

describe('newRemoteName', () => {
  it("returns 'origin' when available", () => {
    const fakeRepository = createFakeRepository({
      remotes: [['upstream', 'git@gitlab.com/group/project']],
    });

    const newName = newRemoteName(fakeRepository);
    expect(newName).toBe('origin');
  });

  it('returns unique remote names', () => {
    const fakeRepository = createFakeRepository({
      remotes: [
        ['origin', 'git@gitlab.com/group/project'],
        ['origin2', 'git@gitlab.com/group/project'],
        ['origin3', 'git@gitlab.com/group/project'],
        ['origin5', 'git@gitlab.com/group/project'],
      ],
    });

    const newName = newRemoteName(fakeRepository);
    expect(newName).toBe('origin4');
  });
});
