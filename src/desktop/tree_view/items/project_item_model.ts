import * as vscode from 'vscode';
import { CustomQuery } from '../../../common/gitlab/custom_query';
import { ProjectInRepository } from '../../gitlab/new_project';
import { CustomQueryItemModel } from './custom_query_item_model';
import { ItemModel } from './item_model';

export class ProjectItemModel extends ItemModel {
  readonly projectInRepository: ProjectInRepository;

  #customQueries: CustomQuery[];

  #startExpanded: boolean;

  constructor(
    projectInRepository: ProjectInRepository,
    customQueries: CustomQuery[],
    startExpanded = false,
  ) {
    super();
    this.projectInRepository = projectInRepository;
    this.#customQueries = customQueries;
    this.#startExpanded = startExpanded;
  }

  getTreeItem(): vscode.TreeItem {
    const label =
      this.projectInRepository.initializationType === 'selected'
        ? `${this.projectInRepository.project.name} (using ${this.projectInRepository.pointer.remote.name} remote)`
        : this.projectInRepository.project.name;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
    item.iconPath = new vscode.ThemeIcon('project');
    item.contextValue =
      this.projectInRepository.initializationType === 'selected' ? 'selected-project' : '';
    const { Expanded, Collapsed } = vscode.TreeItemCollapsibleState;
    item.collapsibleState = this.#startExpanded ? Expanded : Collapsed;
    const projectFolderPath =
      this.projectInRepository.pointer.repository.rawRepository.rootUri.path;
    item.tooltip = projectFolderPath;
    return item;
  }

  async getChildren(): Promise<ItemModel[]> {
    const children = this.#customQueries.map(
      q => new CustomQueryItemModel(q, this.projectInRepository),
    );
    this.setDisposableChildren(children);
    return children;
  }
}
