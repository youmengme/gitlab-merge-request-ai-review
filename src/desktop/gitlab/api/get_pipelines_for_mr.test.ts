import { mr } from '../../test_utils/entities';
import { getPipelinesForMr } from './get_pipelines_for_mr';

describe('getPipelinesForMr', () => {
  it('creates request', async () => {
    const request = getPipelinesForMr(mr);

    expect(request).toEqual({
      type: 'rest',
      method: 'GET',
      path: `/projects/${mr.project_id}/merge_requests/${mr.iid}/pipelines`,
    });
  });
});
