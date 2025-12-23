import { PostRequest } from '../../../common/platform/web_ide';

export type CreateProjectRequest = {
  path: string;
  namespace_id?: number;
  visibility: ProjectVisibility;
};

export const createProject = (body: CreateProjectRequest): PostRequest<RestProject> => ({
  type: 'rest',
  method: 'POST',
  path: `/projects`,
  body,
});
