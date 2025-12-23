import { GetRequest } from '../../../common/platform/web_ide';

export const getNamespaceIdByPath = (path: string): GetRequest<{ id: number }> => ({
  type: 'rest',
  method: 'GET',
  path: `/namespaces/${encodeURIComponent(path)}`,
});
