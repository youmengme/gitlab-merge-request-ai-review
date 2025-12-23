import { Credentials } from '../../common/platform/gitlab_account';

export const testCredentials = (instanceUrl = 'https://gitlab.example.com'): Credentials => ({
  instanceUrl,
  token: 'token',
});
