import * as vscode from 'vscode';
import { ExtensionState } from '../extension_state';
import { RepositoryClient } from '../../common/language_server/repository_client';
import { FeatureFlag } from '../../common/feature_flags/constants';
import { getLocalFeatureFlagService } from '../../common/feature_flags/local_feature_flag_service';
import { log } from '../../common/log';
import { AccountService } from '../accounts/account_service';
import { IssuableDataProvider } from './issuable_data_provider';
import { LSIssuableDataProvider } from './ls_issuable_data_provider';
import { ItemModel } from './items/item_model';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class IssuableDataProviderFactory {
  static create(
    extensionState: ExtensionState,
    accountService: AccountService,
    repositoryClient?: RepositoryClient,
  ): vscode.TreeDataProvider<ItemModel | vscode.TreeItem> {
    const useLanguageServerRepos = getLocalFeatureFlagService().isEnabled(
      FeatureFlag.LsRepositories,
    );

    if (useLanguageServerRepos && repositoryClient) {
      log.debug('[IssuableDataProviderFactory] Using Language Server-based repository provider');
      return new LSIssuableDataProvider(extensionState, accountService, repositoryClient);
    }
    log.debug('[IssuableDataProviderFactory] Using Git extension-based repository provider');
    return new IssuableDataProvider(extensionState);
  }
}
