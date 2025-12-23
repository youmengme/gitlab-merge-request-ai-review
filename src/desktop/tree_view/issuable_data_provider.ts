import * as vscode from 'vscode';
import { ExtensionState } from '../extension_state';
import { gitExtensionWrapper } from '../git/git_extension_wrapper';
import { getProjectRepository } from '../gitlab/gitlab_project_repository';
import { extensionConfigurationService } from '../../common/utils/extension_configuration_service';
import { onSidebarViewStateChange } from './sidebar_view_state';
import { ItemModel } from './items/item_model';
import { MultipleProjectsItem } from './items/multiple_projects_item';
import { NoProjectItem } from './items/no_project_item';
import { ProjectItemModel } from './items/project_item_model';

export class IssuableDataProvider implements vscode.TreeDataProvider<ItemModel | vscode.TreeItem> {
  #eventEmitter = new vscode.EventEmitter<void>();

  #children: ItemModel[] = [];

  #extensionState: ExtensionState;

  onDidChangeTreeData = this.#eventEmitter.event;

  // FIXME: we should add all the dependencies in the constructor (avoid using singletons)
  constructor(extensionState: ExtensionState) {
    this.#extensionState = extensionState;
    this.#extensionState.onDidChangeValid(this.refresh, this);
    getProjectRepository().onProjectChange(this.refresh, this);
    onSidebarViewStateChange(this.refresh, this);
  }

  async getChildren(el: ItemModel | undefined): Promise<(ItemModel | vscode.TreeItem)[]> {
    if (el) return el.getChildren();

    this.#children.forEach(ch => ch.dispose());
    if (!this.#extensionState.isValid()) return []; // show welcome screen
    const { customQueries } = extensionConfigurationService.getConfiguration();
    const children = gitExtensionWrapper.gitRepositories.map(r => {
      const selected = getProjectRepository().getSelectedOrDefaultForRepository(r.rootFsPath);
      if (selected) {
        const shouldExpandItem = gitExtensionWrapper.gitRepositories.length === 1;
        return new ProjectItemModel(selected, customQueries, shouldExpandItem);
      }
      if (getProjectRepository().repositoryHasAmbiguousProjects(r.rootFsPath)) {
        return new MultipleProjectsItem(r);
      }
      return new NoProjectItem(r);
    });
    this.#children = children.filter((c): c is ProjectItemModel => c instanceof ProjectItemModel);
    return children;
  }

  getParent(): null {
    return null;
  }

  getTreeItem(item: vscode.TreeItem | ItemModel) {
    if (item instanceof ItemModel) return item.getTreeItem();
    return item;
  }

  refresh(): void {
    this.#eventEmitter.fire();
  }
}
