import { project } from '../../../common/test_utils/entities';
import { getPipelinesForRef } from './get_pipelines_for_ref';

describe('getPipelinesForRef', () => {
  it('creates request', async () => {
    const request = getPipelinesForRef(project, 'test-ref');

    expect(request).toEqual({
      type: 'rest',
      method: 'GET',
      path: `/projects/${project.restId}/pipelines`,
      searchParams: { ref: 'test-ref' },
    });
  });
});
