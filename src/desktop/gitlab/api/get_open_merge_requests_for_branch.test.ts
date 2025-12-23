import { project } from '../../../common/test_utils/entities';
import { getOpenMergeRequestsForBranch } from './get_open_merge_requests_for_branch';

describe('getPipelinesForRef', () => {
  it('creates request', async () => {
    const request = getOpenMergeRequestsForBranch(project, 'test-ref');

    expect(request).toEqual({
      type: 'rest',
      method: 'GET',
      path: `/projects/${project.restId}/merge_requests`,
      searchParams: { state: 'opened', source_branch: 'test-ref' },
    });
  });
});
