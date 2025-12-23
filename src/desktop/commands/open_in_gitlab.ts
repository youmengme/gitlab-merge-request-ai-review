import * as vscode from 'vscode';
import { MrItemModel } from '../tree_view/items/mr_item_model';
import { IssueItem } from '../tree_view/items/issue_item';
import { JobItemModel } from '../tree_view/items/job_item_model';
import { PipelineItemModel } from '../tree_view/items/pipeline_item_model';
import { openUrl } from './openers';

type WebUrlOpenable = IssueItem | MrItemModel | JobItemModel | PipelineItemModel;

const getWebUrl = (item: WebUrlOpenable): string => {
  switch (true) {
    case item instanceof IssueItem:
      return item.issue.web_url;
    case item instanceof MrItemModel:
      return item.mr.web_url;
    case item instanceof JobItemModel:
      return item.job.target_url ?? item.job.web_url ?? '';
    case item instanceof PipelineItemModel:
      return item.pipeline.web_url;
    default:
      throw new Error('Invalid item type');
  }
};

/**
 * Command will open corresponding Issue/MR in browser
 */
export const openInGitLab = async (item: WebUrlOpenable): Promise<void> => {
  await openUrl(getWebUrl(item));
};

/**
 * Command will copy corresponding Issue/MR url to clipboard
 */
export const copyLinkToClipboard = async (item: WebUrlOpenable): Promise<void> => {
  await vscode.env.clipboard.writeText(getWebUrl(item));
};
