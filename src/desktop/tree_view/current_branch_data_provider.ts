import * as vscode from 'vscode';
import {
  FeatureFlag,
  getLocalFeatureFlagService,
} from '../../common/feature_flags/local_feature_flag_service';
import {
  TreeState,
  BranchState,
  InvalidState,
  TagState,
  currentBranchRefresher,
} from '../current_branch_refresher';
import { DetachedHeadError } from '../errors/detached_head_error';
import { ErrorItem } from './items/error_item';
import { ItemModel } from './items/item_model';
import { MrItemModel } from './items/mr_item_model';
import { IssueItem } from './items/issue_item';
import { PipelineRootItemModel } from './items/pipeline_root_item_model';

import { SecurityResultsItemModel } from './items/security/security_results_item_model';

import { SecurityResultsType } from './items/security/constants';

import { onSidebarViewStateChange } from './sidebar_view_state';

export class CurrentBranchDataProvider
  implements vscode.TreeDataProvider<ItemModel | vscode.TreeItem>
{
  #eventEmitter = new vscode.EventEmitter<void>();

  onDidChangeTreeData = this.#eventEmitter.event;

  #state: TreeState = { type: 'invalid' };

  #pipelineItem?: PipelineRootItemModel;

  #mrState?: { mr: RestMr; item: MrItemModel };

  constructor() {
    onSidebarViewStateChange(() => this.refresh(this.#state), this);
    currentBranchRefresher.onStateChanged(e => this.refresh(e));
  }

  createPipelineItem(state: BranchState | TagState) {
    if (!state.pipeline) {
      return new vscode.TreeItem('No pipeline found');
    }
    this.#pipelineItem = new PipelineRootItemModel(
      state.projectInRepository,
      state.pipeline,
      state.jobs,
      state.type === 'tag' ? 'Tag Pipeline' : 'Pipeline',
    );
    return this.#pipelineItem;
  }

  disposeMrItem() {
    this.#mrState?.item.dispose();
    this.#mrState = undefined;
  }

  static getSecurityReportType(state: BranchState): SecurityResultsType {
    if (state.pipeline?.status === 'failed') {
      return 'PIPELINE_FAILED';
    }
    if (state.pipeline?.status === 'canceled') {
      return 'PIPELINE_CANCELED';
    }
    if (state.pipeline?.status === 'preparing') {
      return 'PIPELINE_PREPARING';
    }
    if (state.pipeline?.status === 'waiting_for_callback') {
      return 'PIPELINE_WAITING_FOR_CALLBACK';
    }
    if (state.pipeline?.status === 'waiting_for_resource') {
      return 'PIPELINE_WAITING_FOR_RESOURCE';
    }
    if (state.pipeline?.status === 'running') {
      return 'PIPELINE_RUNNING';
    }
    if (state.pipeline?.status === 'skipped') {
      return 'PIPELINE_SKIPPED';
    }
    if (state.securityFindings?.status === 'PARSING') {
      return 'PARSING';
    }
    if (state.securityFindings?.status === 'PARSED') {
      return 'COMPLETE';
    }
    if (!state.mr || !state.securityFindings?.report) {
      return 'NO_SCANS_FOUND';
    }
    if (state.securityFindings?.status === 'ERROR') {
      return 'PARSE_ERROR';
    }

    return 'ERROR';
  }

  static createSecurityFindingsItem(state: BranchState): ItemModel {
    return new SecurityResultsItemModel(
      state.projectInRepository,
      this.getSecurityReportType(state),
      state.securityFindings,
    );
  }

  createMrItem(state: BranchState): vscode.TreeItem | ItemModel {
    if (!state.userInitiated && this.#mrState && this.#mrState.mr.id === state.mr?.id)
      return this.#mrState.item;
    this.disposeMrItem();
    if (!state.mr) return new vscode.TreeItem('No merge request found');
    const item = new MrItemModel(state.mr, state.projectInRepository);
    this.#mrState = { mr: state.mr, item };
    return item;
  }

  static createClosingIssueItems(rootFsPath: string, issues: RestIssuable[]) {
    if (issues.length === 0) return [new vscode.TreeItem('No closing issue found')];
    return issues.map(issue => new IssueItem(issue, rootFsPath));
  }

  static renderInvalidState(state: InvalidState): vscode.TreeItem[] {
    if (state.error) {
      if (state.error instanceof DetachedHeadError) {
        return [new ErrorItem(state.error.message)];
      }
      return [new ErrorItem()];
    }
    return [];
  }

  async getChildren(item: ItemModel | undefined): Promise<(ItemModel | vscode.TreeItem)[]> {
    if (item) return item.getChildren();
    this.#pipelineItem?.dispose();
    this.#pipelineItem = undefined;
    if (this.#state.type === 'invalid') {
      this.disposeMrItem();
      return CurrentBranchDataProvider.renderInvalidState(this.#state);
    }
    if (this.#state.type === 'branch') {
      const mrItem = this.createMrItem(this.#state);
      const pipelineItem = this.createPipelineItem(this.#state);
      const closingIssuesItems = CurrentBranchDataProvider.createClosingIssueItems(
        this.#state.projectInRepository.pointer.repository.rootFsPath,
        this.#state.issues,
      );

      if (getLocalFeatureFlagService().isEnabled(FeatureFlag.SecurityScans)) {
        const securityFindingsItem = CurrentBranchDataProvider.createSecurityFindingsItem(
          this.#state,
        );
        return [pipelineItem, mrItem, ...closingIssuesItems, securityFindingsItem];
      }

      return [pipelineItem, mrItem, ...closingIssuesItems];
    }
    if (this.#state.type === 'tag') {
      this.disposeMrItem();
      const pipelineItem = this.createPipelineItem(this.#state);
      return [pipelineItem];
    }
    throw new Error('Unknown head ref state type');
  }

  getTreeItem(item: ItemModel | vscode.TreeItem) {
    if (item instanceof ItemModel) return item.getTreeItem();
    return item;
  }

  refresh(state: TreeState) {
    this.#state = state;
    this.#eventEmitter.fire();
  }
}

export const currentBranchDataProvider = new CurrentBranchDataProvider();
