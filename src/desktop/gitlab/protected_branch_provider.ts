import * as vscode from 'vscode';
import { isEmpty } from 'lodash';
import { BranchProtection, BranchProtectionProvider } from '../api/git';
import { doNotAwait } from '../../common/utils/do_not_await';
import { GITLAB_BRANCH_PROTECTION } from '../../common/utils/extension_configuration';
import { currentUserRequest } from '../../common/gitlab/api/get_current_user';
import { log } from '../../common/log';
import { REQUIRED_VERSIONS } from '../constants';
import { ProjectInRepository } from './new_project';
import { getGitLabService } from './get_gitlab_service';
import { getProtectedBranches } from './api/get_protected_branches';
import { getProjectAccessLevel } from './api/get_project_access_level';

export class ProtectedBranchProvider implements BranchProtectionProvider, vscode.Disposable {
  #uri: vscode.Uri;

  #project: ProjectInRepository;

  #accessLevel?: number;

  #rules?: RestProtectedBranch[];

  #configListener: vscode.Disposable;

  #userId: number | undefined;

  constructor(uri: vscode.Uri, project: ProjectInRepository) {
    this.#uri = uri;
    this.#project = project;
    this.#configListener = vscode.workspace.onDidChangeConfiguration(ev => {
      if (ev.affectsConfiguration(GITLAB_BRANCH_PROTECTION)) {
        this.#onDidChangeBranchProtectionEmitter.fire(this.#uri);
      }
    });
  }

  #onDidChangeBranchProtectionEmitter = new vscode.EventEmitter<vscode.Uri>();

  onDidChangeBranchProtection = this.#onDidChangeBranchProtectionEmitter.event;

  async #updateRules() {
    const service = getGitLabService(this.#project);
    await service.validateVersion('Branch Protection', REQUIRED_VERSIONS.BRANCH_PROTECTION);

    const accessLevel = await service.fetchFromApi(
      getProjectAccessLevel(this.#project.project.namespaceWithPath),
    );
    this.#accessLevel = accessLevel.project.maxAccessLevel.integerValue;
    this.#userId = (await service.fetchFromApi(currentUserRequest)).id;

    this.#rules = await service.fetchFromApi(getProtectedBranches(this.#project.project));

    if (this.#accessLevel !== undefined && this.#rules !== undefined) {
      this.#onDidChangeBranchProtectionEmitter.fire(this.#uri);
    }
  }

  provideBranchProtection(): BranchProtection[] {
    if (vscode.workspace.getConfiguration('gitlab').branchProtection === false) {
      return [];
    }

    if (this.#rules === undefined || this.#accessLevel === undefined) {
      // The interface does not allow this function to return a promise.
      // Retrieve the branch rules in the background, then trigger an event so this function is called again.
      doNotAwait(
        this.#updateRules().catch(err => {
          log.warn('Could not retrieve Branch Protection', err);
        }),
      );
      return [];
    }

    const level = this.#accessLevel;

    const include: string[] = [];
    const exclude: string[] = [];

    this.#rules.forEach(rule => {
      // A baseLevel of 0 indicates 'no one'.
      const baseLevel = rule.push_access_levels?.find(
        item => !item.deploy_key_id && !item.user_id,
      )?.access_level;
      const personalRule = rule.push_access_levels?.find(item => item.user_id === this.#userId);

      const allowed = personalRule || (baseLevel && baseLevel <= level);

      if (allowed) {
        exclude.push(rule.name);
      } else {
        include.push(rule.name);
      }
    });

    if (isEmpty(include)) {
      return [];
    }

    const result = [
      {
        remote: this.#project.pointer.remote.name,
        rules: [{ include, exclude }],
      },
    ];

    return result;
  }

  dispose() {
    this.#onDidChangeBranchProtectionEmitter.dispose();
    this.#configListener.dispose();
  }
}
