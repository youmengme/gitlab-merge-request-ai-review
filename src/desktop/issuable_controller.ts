import * as path from 'path';
import assert from 'assert';
import * as vscode from 'vscode';
import { log } from '../common/log';
import { handleError } from '../common/errors/handle_error';
import { waitForWebview } from '../common/utils/webviews/wait_for_webview';
import { prepareWebviewSource } from '../common/utils/webviews/prepare_webview_source';
import { isMr } from './utils/is_mr';
import { makeHtmlLinksAbsolute } from './utils/make_html_links_absolute';
import { GitLabService } from './gitlab/gitlab_service';
import { getProjectRepository } from './gitlab/gitlab_project_repository';
import { ProjectInRepository } from './gitlab/new_project';
import { getGitLabService } from './gitlab/get_gitlab_service';
import { WEBVIEW_WORKFLOW } from './constants';
import { RepositoryRootWebviewProvider } from './commands/run_with_valid_project';

export type IssuableWebviewPanel = vscode.WebviewPanel & {
  repositoryRoot?: string;
};

async function initPanelIfActive(
  panel: vscode.WebviewPanel,
  issuable: RestIssuable,
  gitlabService: GitLabService,
) {
  if (!panel.active) return;

  const waitPromise = waitForWebview(panel.webview);

  const discussionsAndLabels = await gitlabService
    .getDiscussionsAndLabelEvents(issuable)
    .catch(e => {
      handleError(e);
      return [];
    });

  await waitPromise;
  await panel.webview.postMessage({
    type: 'issuableFetch',
    issuable,
    discussions: discussionsAndLabels,
  });
}

class IssuableController implements RepositoryRootWebviewProvider {
  context?: vscode.ExtensionContext;

  openedPanels: Record<string, IssuableWebviewPanel | undefined> = {};

  init(context: vscode.ExtensionContext) {
    this.context = context;
  }

  #createPanel(issuable: RestIssuable) {
    assert(this.context);
    const title = `${issuable.title.slice(0, 20)}...`;

    return vscode.window.createWebviewPanel(WEBVIEW_WORKFLOW, title, vscode.ViewColumn.One, {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'webviews')),
        vscode.Uri.file(path.join(this.context.extensionPath, 'assets')),
      ],
      retainContextWhenHidden: true,
    }) as IssuableWebviewPanel;
  }

  #createMessageHandler =
    (
      panel: vscode.WebviewPanel,
      issuable: RestIssuable,
      projectInRepository: ProjectInRepository,
    ) =>
    // FIXME: specify correct type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (message: any) => {
      if (message.command === 'renderMarkdown') {
        let rendered = await getGitLabService(projectInRepository).renderMarkdown(
          message.markdown,
          projectInRepository.project,
        );
        rendered = makeHtmlLinksAbsolute(rendered || '', projectInRepository.account.instanceUrl);

        await panel.webview.postMessage({
          type: 'markdownRendered',
          ref: message.ref,
          object: message.object,
          markdown: rendered,
        });
      }

      if (message.command === 'saveNote') {
        try {
          const gitlabService = getGitLabService(projectInRepository);
          try {
            await gitlabService.createNote(issuable, message.note, message.replyId);
          } catch (error) {
            // See https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/357
            const isCommentOnlyError = String(
              error?.details?.errorMessage?.startsWith('Commands only'),
            );
            if (!isCommentOnlyError) {
              throw error;
            }
          }
          const discussionsAndLabels = await gitlabService.getDiscussionsAndLabelEvents(issuable);
          await panel.webview.postMessage({
            type: 'issuableFetch',
            issuable,
            discussions: discussionsAndLabels,
          });
          await panel.webview.postMessage({ type: 'noteSaved' });
        } catch (e) {
          log.error('Failed to submit note to the API.', e);
          await panel.webview.postMessage({ type: 'noteSaved', status: false });
        }
      }
    };

  #getIconPathForIssuable(issuable: RestIssuable) {
    const getIconUri = (shade: string, file: string) =>
      vscode.Uri.file(
        path.join(this.context?.extensionPath || '', 'src', 'assets', 'images', shade, file),
      );
    const lightIssueIcon = getIconUri('light', 'issues.svg');
    const lightMrIcon = getIconUri('light', 'merge_requests.svg');
    const darkIssueIcon = getIconUri('dark', 'issues.svg');
    const darkMrIcon = getIconUri('dark', 'merge_requests.svg');
    return isMr(issuable)
      ? { light: lightMrIcon, dark: darkMrIcon }
      : { light: lightIssueIcon, dark: darkIssueIcon };
  }

  async open(issuable: RestIssuable, repositoryRoot: string) {
    const panelKey = `${repositoryRoot}-${issuable.id}`;
    const openedPanel = this.openedPanels[panelKey];
    if (openedPanel) {
      openedPanel.reveal();
      return openedPanel;
    }
    const newPanel = await this.#create(issuable, repositoryRoot);
    this.openedPanels[panelKey] = newPanel;
    newPanel.onDidDispose(() => {
      this.openedPanels[panelKey] = undefined;
    });
    return newPanel;
  }

  async #create(issuable: RestIssuable, repositoryRoot: string) {
    assert(this.context);
    const projectInRepository = getProjectRepository().getProjectOrFail(repositoryRoot);

    const panel = this.#createPanel(issuable);
    panel.webview.html = await prepareWebviewSource(
      panel.webview,
      this.context,
      'issuable',
      projectInRepository.account.instanceUrl,
    );
    panel.iconPath = this.#getIconPathForIssuable(issuable);
    panel.repositoryRoot = repositoryRoot;

    await initPanelIfActive(panel, issuable, getGitLabService(projectInRepository));
    panel.onDidChangeViewState(async () => {
      await initPanelIfActive(panel, issuable, getGitLabService(projectInRepository));
    });

    panel.webview.onDidReceiveMessage(
      this.#createMessageHandler(panel, issuable, projectInRepository),
    );
    return panel;
  }

  matchesViewType(viewType: string): boolean {
    return viewType === `mainThreadWebview-${WEBVIEW_WORKFLOW}`;
  }

  get repositoryRootForActiveTab(): string | undefined {
    const panel = Object.values(this.openedPanels).find(p => p?.active);
    return panel?.repositoryRoot;
  }
}

export const issuableController = new IssuableController();
