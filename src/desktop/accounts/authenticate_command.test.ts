import vscode, { QuickPickItem } from 'vscode';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { GitExtensionWrapper } from '../git/git_extension_wrapper';
import { GitRemote, GitRepository } from '../git/new_git';
import { createTokenAccount } from '../test_utils/entities';
import { handleError } from '../../common/errors/handle_error';
import { AccountService } from './account_service';
import { AuthenticateCommand, MANUAL_INSTANCE_URL_CHOICE } from './authenticate_command';
import { createPatFlow } from './auth_flows/pat_flow';
import { OAuthFlow } from './auth_flows/oauth_flow';
import { Flow } from './auth_flows/flow';

jest.mock('./auth_flows/pat_flow');
jest.mock('./auth_flows/oauth_flow');
jest.mock('../../common/errors/handle_error');

describe('AuthenticateCommand', () => {
  describe('run', () => {
    let gitRepositories: GitRepository[];

    let accountService: AccountService;
    let gitExtensionWrapper: GitExtensionWrapper;

    let command: AuthenticateCommand;

    let patFlow: Flow;
    let oauthFlow: OAuthFlow;

    const createFakeRepository = (remoteUrls: string[]) =>
      createFakePartial<GitRepository>({
        remotes: remoteUrls.map(remoteUrl =>
          createFakePartial<GitRemote>({
            urlEntries: [{ url: remoteUrl }],
          }),
        ),
      });

    beforeEach(() => {
      accountService = createFakePartial<AccountService>({
        addAccount: jest.fn(),
      });
      gitExtensionWrapper = createFakePartial<GitExtensionWrapper>({
        get gitRepositories() {
          return gitRepositories;
        },
      });
      patFlow = {
        title: 'pat',
        description: 'pat desc',
        supportsGitLabInstance: jest.fn(),
        authenticate: jest.fn(),
      };
      oauthFlow = createFakePartial<OAuthFlow>({
        title: 'oauth',
        description: 'oauth desc',
        supportsGitLabInstance: jest.fn(),
        authenticate: jest.fn(),
      });
      jest.mocked(createPatFlow).mockReturnValue(patFlow);
      jest.mocked(OAuthFlow).mockReturnValue(oauthFlow);

      command = new AuthenticateCommand(gitExtensionWrapper, accountService);
    });

    describe('instance URL handling', () => {
      it('offers remote URLs as instance URLs', async () => {
        gitRepositories = [
          createFakeRepository([
            'git@gitlab.com/gitlab-org/gitlab-vscode-extension',
            'https://gitlab.com/gitlab-org/gitlab-vscode-extension.git',
          ]),
          createFakeRepository([
            'git@gitlab.com/gitlab-org/gitlab',
            'https://gnome.org/gnome/project',
          ]),
          createFakeRepository([
            'git@github.com/test/project',
            'https://github.com/test/project.git',
          ]),
        ];

        await command.run();

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
          ['https://gitlab.com', 'https://gnome.org', MANUAL_INSTANCE_URL_CHOICE],
          { title: expect.any(String) },
        );
      });

      it('removes trailing slash from the instanceUrl', async () => {
        jest.mocked(patFlow.supportsGitLabInstance).mockReturnValue(true);
        jest.mocked(oauthFlow.supportsGitLabInstance).mockReturnValue(false);
        jest
          .mocked(vscode.window.showQuickPick)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .mockResolvedValue(MANUAL_INSTANCE_URL_CHOICE as any);
        jest.mocked(vscode.window.showInputBox).mockResolvedValue('https://gitlab.com/');
        // simulate API returning user for the instance url and token

        await command.run();

        expect(patFlow.authenticate).toHaveBeenCalledWith('https://gitlab.com');
      });

      it('uses the previousInstanceUrl parameter', async () => {
        jest.mocked(patFlow.supportsGitLabInstance).mockReturnValue(true);
        jest.mocked(oauthFlow.supportsGitLabInstance).mockReturnValue(false);
        // simulate API returning user for the instance url and token

        await command.run('https://gitlab.example.com');

        expect(patFlow.authenticate).toHaveBeenCalledWith('https://gitlab.example.com');
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
      });

      describe('selecting flow', () => {
        beforeEach(() => {
          gitRepositories = [
            createFakeRepository(['git@gitlab.com/gitlab-org/gitlab-vscode-extension']),
          ];
          jest
            .mocked(vscode.window.showQuickPick)
            .mockImplementation(async items => (await items)[0]);
        });

        it('throws assertion error when there are no flows', async () => {
          jest.mocked(patFlow.supportsGitLabInstance).mockReturnValue(false);
          jest.mocked(oauthFlow.supportsGitLabInstance).mockReturnValue(false);

          await expect(() => command.run()).rejects.toThrow(/Assertion error/);
        });

        it('when multiple flows are available, shows a quick pick', async () => {
          jest.mocked(patFlow.supportsGitLabInstance).mockReturnValue(true);
          jest.mocked(oauthFlow.supportsGitLabInstance).mockReturnValue(true);

          await command.run();

          const offeredFlows = (
            jest.mocked(vscode.window.showQuickPick).mock.calls[1][0] as QuickPickItem[]
          ).map(item => item.label);

          expect(offeredFlows).toEqual(['oauth', 'pat']);
        });

        it('directly selects a flow when only one is available', async () => {
          jest.mocked(patFlow.supportsGitLabInstance).mockReturnValue(true);
          jest.mocked(oauthFlow.supportsGitLabInstance).mockReturnValue(false);

          await command.run();

          expect(patFlow.authenticate).toHaveBeenCalled();
        });
      });

      describe('creating an account', () => {
        beforeEach(() => {
          gitRepositories = [
            createFakeRepository(['git@gitlab.com/gitlab-org/gitlab-vscode-extension']),
          ];
          jest
            .mocked(vscode.window.showQuickPick)
            .mockImplementation(async items => (await items)[0]);
          jest.mocked(patFlow.supportsGitLabInstance).mockReturnValue(true);
          jest.mocked(oauthFlow.supportsGitLabInstance).mockReturnValue(false);
        });

        it('uses the available flow to create an account', async () => {
          const account = createTokenAccount();
          jest.mocked(patFlow.authenticate).mockResolvedValue(account);

          await command.run();

          expect(accountService.addAccount).toHaveBeenCalledWith(account);
          expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            expect.stringMatching(/Added GitLab account/),
          );
        });

        it('handles flow error', async () => {
          const error = new Error('flow error');
          jest.mocked(patFlow.authenticate).mockRejectedValue(error);

          await command.run();

          expect(handleError).toHaveBeenCalledWith(error);
        });
      });
    });
  });
});
