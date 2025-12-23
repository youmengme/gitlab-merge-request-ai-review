import { GetRequest } from '../../platform/web_ide';

export const currentUserRequest: GetRequest<RestUser> = {
  type: 'rest',
  method: 'GET',
  path: '/user',
};
