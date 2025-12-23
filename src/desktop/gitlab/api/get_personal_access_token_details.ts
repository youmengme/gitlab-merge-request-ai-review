import { GetRequest } from '../../../common/platform/web_ide';

// GitLab token info
export interface PersonalAccessTokenDetails {
  scopes: string[];
}
export const personalAccessTokenDetailsRequest: GetRequest<PersonalAccessTokenDetails> = {
  type: 'rest',
  method: 'GET',
  path: '/personal_access_tokens/self',
};
