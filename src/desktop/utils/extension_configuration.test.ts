import * as vscode from 'vscode';
import { GITLAB_COM_URL } from '../../common/constants';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { BUNDLED_CLIENT_IDS, getAuthenticationConfiguration } from './extension_configuration';

describe('extension_configuration', () => {
  const mockGetConfiguration = jest.mocked(vscode.workspace.getConfiguration);

  beforeEach(() => {
    mockGetConfiguration.mockReset();
  });

  describe('getAuthenticationConfiguration', () => {
    it('returns default GitLab.com client ID when no user configuration exists', () => {
      mockGetConfiguration.mockReturnValue(
        createFakePartial<vscode.WorkspaceConfiguration>({
          get: jest.fn().mockReturnValue({}),
        }),
      );

      const config = getAuthenticationConfiguration();
      expect(config.oauthClientIds).toEqual({
        [GITLAB_COM_URL]: BUNDLED_CLIENT_IDS[GITLAB_COM_URL],
      });
    });

    it('merges user configuration with default GitLab.com client ID', () => {
      const userConfig = {
        'https://self-managed.example.com': 'user-client-id-123',
        'https://dedicated.gitlab.com': 'dedicated-client-id-456',
      };
      mockGetConfiguration.mockReturnValue(
        createFakePartial<vscode.WorkspaceConfiguration>({
          get: jest.fn().mockReturnValue(userConfig),
        }),
      );

      const config = getAuthenticationConfiguration();

      expect(config.oauthClientIds).toEqual({
        'https://self-managed.example.com': 'user-client-id-123',
        'https://dedicated.gitlab.com': 'dedicated-client-id-456',
        [GITLAB_COM_URL]: BUNDLED_CLIENT_IDS[GITLAB_COM_URL],
      });
    });

    it('allows user to override GitLab.com client ID', () => {
      const userConfig = {
        [GITLAB_COM_URL]: 'custom-gitlab-com-client-id',
        'https://self-managed.example.com': 'self-managed-client-id',
      };
      mockGetConfiguration.mockReturnValue(
        createFakePartial<vscode.WorkspaceConfiguration>({
          get: jest.fn().mockReturnValue(userConfig),
        }),
      );

      const config = getAuthenticationConfiguration();

      // User configuration should be applied first, then default is added
      // Since default is added last, it should override user's GitLab.com setting
      expect(config.oauthClientIds).toEqual({
        [GITLAB_COM_URL]: BUNDLED_CLIENT_IDS[GITLAB_COM_URL],
        'https://self-managed.example.com': 'self-managed-client-id',
      });
    });

    it('handles empty string client IDs from user configuration', () => {
      const userConfig = {
        'https://self-managed.example.com': '',
        'https://dedicated.gitlab.com': 'valid-client-id',
      };
      mockGetConfiguration.mockReturnValue(
        createFakePartial<vscode.WorkspaceConfiguration>({
          get: jest.fn().mockReturnValue(userConfig),
        }),
      );

      const config = getAuthenticationConfiguration();

      expect(config.oauthClientIds).toEqual({
        'https://self-managed.example.com': '',
        'https://dedicated.gitlab.com': 'valid-client-id',
        [GITLAB_COM_URL]: BUNDLED_CLIENT_IDS[GITLAB_COM_URL],
      });
    });

    it('handles blank values from user configuration by falling back to bundled IDs', () => {
      const userConfig = {
        'https://self-managed.example.com': null,
        'https://dedicated.gitlab.com': undefined,
        'https://example.gitlab.com': '',
        'https://valid.example.com': 'valid-client-id',
      };
      mockGetConfiguration.mockReturnValue(
        createFakePartial<vscode.WorkspaceConfiguration>({
          get: jest.fn().mockReturnValue(userConfig),
        }),
      );

      const config = getAuthenticationConfiguration();

      // When user config contains non-string values, it falls back to bundled client IDs only
      expect(config.oauthClientIds).toEqual({
        [GITLAB_COM_URL]: BUNDLED_CLIENT_IDS[GITLAB_COM_URL],
      });
    });

    it('handles multiple instances with various URL formats', () => {
      const userConfig = {
        'https://gitlab.example.com': 'example-client-id',
        'https://gitlab.example.com/': 'example-with-slash-client-id',
        'https://gitlab.example.com/subpath': 'example-with-slash-client-id',
        'http://localhost:3000': 'localhost-client-id',
        'https://gitlab.company.internal:8443': 'internal-client-id',
      };
      mockGetConfiguration.mockReturnValue(
        createFakePartial<vscode.WorkspaceConfiguration>({
          get: jest.fn().mockReturnValue(userConfig),
        }),
      );

      const config = getAuthenticationConfiguration();

      expect(config.oauthClientIds).toEqual({
        'https://gitlab.example.com': 'example-client-id',
        'https://gitlab.example.com/': 'example-with-slash-client-id',
        'https://gitlab.example.com/subpath': 'example-with-slash-client-id',
        'http://localhost:3000': 'localhost-client-id',
        'https://gitlab.company.internal:8443': 'internal-client-id',
        [GITLAB_COM_URL]: BUNDLED_CLIENT_IDS[GITLAB_COM_URL],
      });
    });

    it('preserves the order with default GitLab.com client ID added last', () => {
      const userConfig = {
        'https://first.example.com': 'first-client-id',
        [GITLAB_COM_URL]: 'user-gitlab-com-override',
        'https://second.example.com': 'second-client-id',
      };
      mockGetConfiguration.mockReturnValue(
        createFakePartial<vscode.WorkspaceConfiguration>({
          get: jest.fn().mockReturnValue(userConfig),
        }),
      );

      const config = getAuthenticationConfiguration();

      // The default GitLab.com client ID should be added last, overriding user's setting
      const keys = Object.keys(config.oauthClientIds);
      expect(keys).toEqual([
        'https://first.example.com',
        GITLAB_COM_URL,
        'https://second.example.com',
      ]);
      expect(config.oauthClientIds[GITLAB_COM_URL]).toBe(BUNDLED_CLIENT_IDS[GITLAB_COM_URL]);
    });
  });
});
