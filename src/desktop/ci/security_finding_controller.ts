import * as path from 'path';
import assert from 'assert';
import * as vscode from 'vscode';
import { WEBVIEW_SECURITY_FINDING } from '../constants';
import { GqlSecurityFinding } from '../gitlab/security_findings/api/get_security_finding_report';
import { prepareWebviewSource } from '../../common/utils/webviews/prepare_webview_source';
import { getSecurityFinding } from '../gitlab/security_findings/api/get_security_finding';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { RepositoryRootWebviewProvider } from '../commands/run_with_valid_project';
import { ProjectInRepository } from '../gitlab/new_project';

export type SecurityFindingWebviewPanel = vscode.WebviewPanel & {
  finding: GqlSecurityFinding;
  repositoryRoot?: string;
};

export class SecurityFindingWebviewController implements RepositoryRootWebviewProvider {
  #context?: vscode.ExtensionContext;

  #panel?: SecurityFindingWebviewPanel;

  init(context: vscode.ExtensionContext) {
    this.#context = context;
  }

  #createEmptyPanel(): SecurityFindingWebviewPanel {
    assert(this.#context);

    const panel = vscode.window.createWebviewPanel(
      WEBVIEW_SECURITY_FINDING,
      '',
      {
        preserveFocus: true,
        viewColumn: vscode.ViewColumn.Beside,
      },
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.#context.extensionPath, 'webviews')),
          vscode.Uri.file(path.join(this.#context.extensionPath, 'assets')),
        ],
        retainContextWhenHidden: true,
      },
    ) as SecurityFindingWebviewPanel;

    this.#panel = panel;

    panel.onDidDispose(() => {
      if (this.#panel === panel) {
        this.#panel = undefined;
      }
    });

    return panel;
  }

  async createOrUpdateWebview(
    finding: GqlSecurityFinding,
    projectInRepository: ProjectInRepository,
    existingPanel?: SecurityFindingWebviewPanel,
  ): Promise<SecurityFindingWebviewPanel> {
    assert(this.#context);

    const panel = existingPanel ?? this.#createEmptyPanel();

    if (!finding) {
      return panel;
    }

    const { title } = finding;
    panel.title = title;
    panel.iconPath = vscode.Uri.file(
      path.join(this.#context?.extensionPath, 'assets', 'images', 'dark', 'vulnerabilities.svg'),
    );

    panel.webview.html = await prepareWebviewSource(
      panel.webview,
      this.#context,
      'security_finding',
      projectInRepository.account.instanceUrl,
    );

    panel.repositoryRoot = projectInRepository.pointer.repository.rootFsPath;

    const data = await getGitLabService(projectInRepository).fetchFromApi(
      getSecurityFinding(projectInRepository.project, finding.foundByPipelineIid, finding.uuid),
    );

    const securityReportFinding = data?.project.pipeline.securityReportFinding;

    await panel.webview.postMessage({
      type: 'findingDetails',
      finding: securityReportFinding,
      instanceUrl: projectInRepository.account?.instanceUrl,
    });

    return panel;
  }

  async open(
    item: GqlSecurityFinding,
    projectInRepository: ProjectInRepository,
  ): Promise<SecurityFindingWebviewPanel> {
    const panel = await this.createOrUpdateWebview(item, projectInRepository, this.#panel);
    panel.reveal();
    return panel;
  }

  matchesViewType(viewType: string): boolean {
    return viewType === `mainThreadWebview-security`;
  }

  get repositoryRootForActiveTab(): string | undefined {
    if (!this.#panel?.active) return undefined;
    return this.#panel.repositoryRoot;
  }
}

export const securityFindingWebviewController = new SecurityFindingWebviewController();
