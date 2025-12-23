import { Disposable, TreeDataProvider, TreeItem, EventEmitter } from 'vscode';
import { ExtensionState } from '../extension_state';
import { extensionConfigurationService } from '../../common/utils/extension_configuration_service';
import { RepositoryClient } from '../../common/language_server/repository_client';
import { log } from '../../common/log';
import { gitExtensionWrapper } from '../git/git_extension_wrapper';
import { AccountService } from '../accounts/account_service';
import { onSidebarViewStateChange } from './sidebar_view_state';
import { ItemModel } from './items/item_model';
import { RepositoryStateTranslator } from './repository_state_translator';
import { ProjectItemModel } from './items/project_item_model';
import { MultipleProjectsItem } from './items/multiple_projects_item';
import { NoProjectItem } from './items/no_project_item';

/**
 * Language Server-powered IssuableDataProvider that uses the translator
 * to maintain compatibility with existing tree items while getting data from the LS.
 *
 * This approach keeps the original issuable_data_provider.ts unchanged while
 * allowing this LS version to use the same tree items (ProjectItemModel, etc.)
 * through translation and allow gradual migration to LS-provided repo data
 */
export class LSIssuableDataProvider implements TreeDataProvider<ItemModel | TreeItem> {
  #eventEmitter = new EventEmitter<void>();

  #children: ItemModel[] = [];

  #extensionState: ExtensionState;

  #repositoryClient: RepositoryClient;

  #translator: RepositoryStateTranslator;

  #subscriptions: Disposable[] = [];

  onDidChangeTreeData = this.#eventEmitter.event;

  constructor(
    extensionState: ExtensionState,
    accountService: AccountService,
    repositoryClient: RepositoryClient,
  ) {
    this.#extensionState = extensionState;
    this.#repositoryClient = repositoryClient;
    this.#translator = new RepositoryStateTranslator(
      gitExtensionWrapper,
      accountService,
      repositoryClient,
    );

    this.#subscriptions.push(
      this.#extensionState.onDidChangeValid(this.refresh, this),
      onSidebarViewStateChange(this.refresh, this),
      this.#translator.onRepositoriesChanged(() => this.refresh()),
    );
  }

  async getChildren(el: ItemModel | undefined): Promise<(ItemModel | TreeItem)[]> {
    if (el) return el.getChildren();

    this.#children.forEach(ch => ch.dispose());
    if (!this.#extensionState.isValid()) return []; // show welcome screen

    const { customQueries } = extensionConfigurationService.getConfiguration();

    try {
      const repositoryStates = await this.#repositoryClient.getRepositories();

      const children = repositoryStates
        .map(repositoryState => {
          switch (repositoryState.type) {
            case 'single':
            case 'selected': {
              const projectInRepository =
                this.#translator.translateToProjectInRepository(repositoryState);
              if (projectInRepository) {
                const shouldExpandItem = repositoryStates.length === 1;
                return new ProjectItemModel(projectInRepository, customQueries, shouldExpandItem);
              }
              log.warn('Could not translate repository state to ProjectInRepository');
              return null;
            }
            case 'multiple': {
              const gitRepository = this.#translator.mapToGitRepository(repositoryState.repository);
              if (!gitRepository) {
                log.warn('Could not map repository to GitRepository type');
                return null;
              }
              return new MultipleProjectsItem(gitRepository, repositoryState);
            }
            case 'none': {
              const gitRepository = this.#translator.mapToGitRepository(repositoryState.repository);
              if (!gitRepository) {
                log.warn('Could not map repository to GitRepository type');
                return null;
              }
              return new NoProjectItem(gitRepository);
            }
            default: {
              log.warn('Unknown repository state type');
              return null;
            }
          }
        })
        .filter(
          (item): item is ProjectItemModel | MultipleProjectsItem | NoProjectItem => item !== null,
        );

      this.#children = children.filter((c): c is ProjectItemModel => c instanceof ProjectItemModel);

      return children;
    } catch (error) {
      log.error('Failed to get repositories from LS:', error);
      return [];
    }
  }

  getParent(): null {
    return null;
  }

  getTreeItem(item: TreeItem | ItemModel) {
    if (item instanceof ItemModel) return item.getTreeItem();
    return item;
  }

  refresh(): void {
    this.#eventEmitter.fire();
  }

  dispose(): void {
    this.#children.forEach(ch => ch.dispose());
    this.#subscriptions.forEach(s => s.dispose());
  }
}
