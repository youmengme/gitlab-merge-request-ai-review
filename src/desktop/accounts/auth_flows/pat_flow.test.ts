import vscode from 'vscode';
import { GitLabVersionResponse, versionRequest } from '../../../common/gitlab/check_version';
import { currentUserRequest } from '../../../common/gitlab/api/get_current_user';
import { createFakeFetchFromApi } from '../../../common/test_utils/create_fake_fetch_from_api';
import { createFakePartial } from '../../../common/test_utils/create_fake_partial';
import {
  PersonalAccessTokenDetails,
  personalAccessTokenDetailsRequest,
} from '../../gitlab/api/get_personal_access_token_details';
import { GitLabService } from '../../gitlab/gitlab_service';
import { user } from '../../test_utils/entities';
import { FetchError } from '../../../common/errors/fetch_error';
import { GITLAB_COM_URL } from '../../../common/constants';
import { openUrl } from '../../commands/openers';
import { CREATE_TOKEN_CHOICE, ENTER_TOKEN_CHOICE, createPatFlow } from './pat_flow';

jest.mock('../../gitlab/gitlab_service');
jest.mock('../../commands/openers');

describe('PAT flow', () => {
  it('works for any instance', () => {
    expect(createPatFlow().supportsGitLabInstance('blah-blah-ho-ho')).toBe(true);
  });

  describe('authenticate', () => {
    const mockResponses = ({
      currentUser,
      scopesResponse,
      versionResponse,
    }: {
      currentUser?: RestUser | Promise<RestUser>;
      scopesResponse?: PersonalAccessTokenDetails;
      versionResponse?: GitLabVersionResponse;
    }) => {
      jest.mocked(GitLabService).mockImplementation(() =>
        createFakePartial<GitLabService>({
          fetchFromApi: createFakeFetchFromApi(
            { request: currentUserRequest, response: currentUser },
            { request: personalAccessTokenDetailsRequest, response: scopesResponse },
            { request: versionRequest, response: versionResponse },
          ),
        }),
      );
    };

    beforeEach(() => {
      // simulate user filling in token
      jest.mocked(vscode.window.showInputBox).mockResolvedValue('token');
    });
    describe('user wants to create a token', () => {
      beforeEach(() => {
        // simulate user saying they want to enter existing token
        jest.mocked(vscode.window.showQuickPick).mockResolvedValue(CREATE_TOKEN_CHOICE);
        // simulate API returning user for the instance url and token
        mockResponses({ currentUser: user, scopesResponse: { scopes: ['api'] } });
      });

      it('opens the URL for creating a token', async () => {
        await createPatFlow().authenticate('https://example.com');

        expect(openUrl).toHaveBeenCalledWith(
          'https://example.com/-/user_settings/personal_access_tokens?name=GitLab+Workflow+Extension&scopes=api',
        );
      });

      it('authenticates', async () => {
        const account = await createPatFlow().authenticate('https://gitlab.com');

        expect(account).toBeTruthy();
      });
    });

    describe('user has a token', () => {
      beforeEach(() => {
        // simulate user saying they want to enter existing token
        jest.mocked(vscode.window.showQuickPick).mockResolvedValue(ENTER_TOKEN_CHOICE);
      });

      it('authenticates', async () => {
        // simulate API returning user for the instance url and token
        mockResponses({ currentUser: user, scopesResponse: { scopes: ['api'] } });

        const account = await createPatFlow().authenticate('https://gitlab.com');

        expect(GitLabService).toHaveBeenCalledWith({
          instanceUrl: 'https://gitlab.com',
          token: 'token',
        });
        expect(account).toEqual({
          id: 'https://gitlab.com|123',
          token: 'token',
          instanceUrl: 'https://gitlab.com',
          username: 'test-user',
          type: 'token',
        });
      });

      it('handles Unauthorized error', async () => {
        // simulate API failing with Unauthorized
        mockResponses({
          currentUser: Promise.reject(new FetchError({ status: 401 } as Response, '')),
          scopesResponse: {
            scopes: ['api'],
          },
        });

        await expect(() => createPatFlow().authenticate(GITLAB_COM_URL)).rejects.toThrow(
          /.*Unauthorized.*/,
        );
      });

      it('handles fetch error', async () => {
        // simulate API returning error response
        mockResponses({
          currentUser: Promise.reject(new FetchError({ status: 404 } as Response, '')),
          scopesResponse: {
            scopes: ['api'],
          },
        });

        await expect(() => createPatFlow().authenticate(GITLAB_COM_URL)).rejects.toThrow(
          /.*Request failed.*/,
        );
      });

      it('handles insufficient scopes error', async () => {
        // simulate token with missing scopes
        mockResponses({
          currentUser: user,
          scopesResponse: { scopes: ['read_user', 'some_other_scope'] },
        });

        await expect(() => createPatFlow().authenticate(GITLAB_COM_URL)).rejects.toThrow(
          /token is missing 'api' scope/,
        );
      });

      it('handles low GitLab version', async () => {
        mockResponses({ versionResponse: { version: '12.0.0' } });

        await expect(() => createPatFlow().authenticate(GITLAB_COM_URL)).rejects.toThrow(
          /extension requires GitLab version/,
        );
      });
    });
  });
});
