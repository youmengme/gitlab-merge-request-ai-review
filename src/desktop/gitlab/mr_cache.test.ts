import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { mr, mrVersion, projectInRepository } from '../test_utils/entities';
import { getGitLabService } from './get_gitlab_service';
import { GitLabService } from './gitlab_service';
import { MrCacheImpl } from './mr_cache';

jest.mock('./get_gitlab_service');

describe('MrCacheImpl', () => {
  let mrCache: MrCacheImpl;
  beforeEach(() => {
    mrCache = new MrCacheImpl();
  });
  it('returns undefined if the MR is not cached', () => {
    expect(mrCache.getMr(1, projectInRepository)).toBe(undefined);
  });

  it('fetches MR versions when we reload MR', async () => {
    jest.mocked(getGitLabService).mockReturnValue(
      createFakePartial<GitLabService>({
        getMrDiff: async () => mrVersion,
      }),
    );

    const result = await mrCache.reloadMr(mr, projectInRepository);

    expect(result).toEqual({ mr, mrVersion });
  });

  it('returns MR when it was cached', async () => {
    jest.mocked(getGitLabService).mockReturnValue(
      createFakePartial<GitLabService>({
        getMrDiff: async () => mrVersion,
      }),
    );

    await mrCache.reloadMr(mr, projectInRepository);

    expect(mrCache.getMr(mr.id, projectInRepository)).toEqual({ mr, mrVersion });
  });
});
