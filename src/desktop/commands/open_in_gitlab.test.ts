import * as vscode from 'vscode';
import { mr, pipeline, job, issue, projectInRepository } from '../test_utils/entities';
import { IssueItem } from '../tree_view/items/issue_item';
import { MrItemModel } from '../tree_view/items/mr_item_model';
import { PipelineItemModel } from '../tree_view/items/pipeline_item_model';
import { JobItemModel } from '../tree_view/items/job_item_model';
import { openInGitLab, copyLinkToClipboard } from './open_in_gitlab';
import * as openers from './openers';

const openUrlSpy = jest.spyOn(openers, 'openUrl');

describe('open in gitlab command', () => {
  it('correctly opens issue', async () => {
    const issueItem = new IssueItem(issue, '');
    await openInGitLab(issueItem);
    expect(openUrlSpy).toHaveBeenCalledWith(issue.web_url);
  });

  it('correctly opens mr', async () => {
    const mrModel = new MrItemModel(mr, projectInRepository);
    await openInGitLab(mrModel);
    expect(openUrlSpy).toHaveBeenCalledWith(mr.web_url);
  });

  it('correctly opens pipeline', async () => {
    const pipelineModel = new PipelineItemModel(projectInRepository, pipeline, [job]);
    await openInGitLab(pipelineModel);
    expect(openUrlSpy).toHaveBeenCalledWith(pipeline.web_url);
  });

  it('correctly opens job', async () => {
    const jobModel = new JobItemModel(projectInRepository, job);
    await openInGitLab(jobModel);
    expect(openUrlSpy).toHaveBeenCalledWith(job.web_url);
  });

  it('correctly copies issue link', async () => {
    const issueItem = new IssueItem(issue, '');
    const clipboardSpy = jest.spyOn(vscode.env.clipboard, 'writeText');
    await copyLinkToClipboard(issueItem);
    expect(clipboardSpy).toHaveBeenCalledWith(issue.web_url);
  });

  it('correctly copies mr link', async () => {
    const mrModel = new MrItemModel(mr, projectInRepository);
    const clipboardSpy = jest.spyOn(vscode.env.clipboard, 'writeText');
    await copyLinkToClipboard(mrModel);
    expect(clipboardSpy).toHaveBeenCalledWith(mr.web_url);
  });

  it('correctly copies pipeline link', async () => {
    const pipelineModel = new PipelineItemModel(projectInRepository, pipeline, [job]);
    const clipboardSpy = jest.spyOn(vscode.env.clipboard, 'writeText');
    await copyLinkToClipboard(pipelineModel);
    expect(clipboardSpy).toHaveBeenCalledWith(pipeline.web_url);
  });

  it('correctly copies issue link', async () => {
    const jobModel = new JobItemModel(projectInRepository, job);
    const clipboardSpy = jest.spyOn(vscode.env.clipboard, 'writeText');
    await copyLinkToClipboard(jobModel);
    expect(clipboardSpy).toHaveBeenCalledWith(job.web_url);
  });
});
