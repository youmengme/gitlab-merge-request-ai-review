import { personalAccessTokenDetailsRequest } from './get_personal_access_token_details';

describe('getPersonalAccessTokenDetails', () => {
  it('creates request', async () => {
    const request = personalAccessTokenDetailsRequest;

    expect(request).toEqual({
      type: 'rest',
      method: 'GET',
      path: '/personal_access_tokens/self',
    });
  });
});
