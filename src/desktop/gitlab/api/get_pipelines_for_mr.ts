import { GetRequest } from '../../../common/platform/web_ide';

export const getPipelinesForMr = (mr: RestMr): GetRequest<RestPipeline[]> => ({
  type: 'rest',
  method: 'GET',
  path: `/projects/${mr.project_id}/merge_requests/${mr.iid}/pipelines`,
});
