import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { ExtensionState } from '../extension_state';
import { RepositoryClient } from '../../common/language_server/repository_client';
import { getLocalFeatureFlagService } from '../../common/feature_flags/local_feature_flag_service';
import { AccountService } from '../accounts/account_service';
import { IssuableDataProviderFactory } from './issuable_data_provider_factory';
import { IssuableDataProvider } from './issuable_data_provider';
import { LSIssuableDataProvider } from './ls_issuable_data_provider';

jest.mock('../../common/feature_flags/local_feature_flag_service');
jest.mock('./issuable_data_provider');
jest.mock('./ls_issuable_data_provider');

describe('IssuableDataProviderFactory', () => {
  let mockExtensionState: ExtensionState;
  let mockRepositoryClient: RepositoryClient;
  let mockAccountService: AccountService;

  beforeEach(() => {
    mockExtensionState = createFakePartial<ExtensionState>({});
    mockRepositoryClient = createFakePartial<RepositoryClient>({});
    mockAccountService = createFakePartial<AccountService>({});

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create LSIssuableDataProvider when LsRepositories feature flag is enabled and repositoryClient is provided', () => {
      jest.mocked(getLocalFeatureFlagService).mockReturnValue({
        isEnabled: jest.fn().mockReturnValue(true),
      });

      const result = IssuableDataProviderFactory.create(
        mockExtensionState,
        mockAccountService,
        mockRepositoryClient,
      );

      expect(LSIssuableDataProvider).toHaveBeenCalledWith(
        mockExtensionState,
        mockAccountService,
        mockRepositoryClient,
      );
      expect(IssuableDataProvider).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(LSIssuableDataProvider);
    });

    it('should create IssuableDataProvider when LsRepositories feature flag is disabled', () => {
      jest.mocked(getLocalFeatureFlagService).mockReturnValue({
        isEnabled: jest.fn().mockReturnValue(false),
      });
      const result = IssuableDataProviderFactory.create(
        mockExtensionState,
        mockAccountService,
        mockRepositoryClient,
      );

      expect(IssuableDataProvider).toHaveBeenCalledWith(mockExtensionState);
      expect(LSIssuableDataProvider).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(IssuableDataProvider);
    });

    it('should create IssuableDataProvider when LsRepositories feature flag is enabled but repositoryClient is not provided', () => {
      jest.mocked(getLocalFeatureFlagService).mockReturnValue({
        isEnabled: jest.fn().mockReturnValue(true),
      });

      const result = IssuableDataProviderFactory.create(mockExtensionState, mockAccountService);

      expect(IssuableDataProvider).toHaveBeenCalledWith(mockExtensionState);
      expect(LSIssuableDataProvider).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(IssuableDataProvider);
    });

    it('should create IssuableDataProvider when both feature flag is disabled and repositoryClient is not provided', () => {
      jest.mocked(getLocalFeatureFlagService).mockReturnValue({
        isEnabled: jest.fn().mockReturnValue(false),
      });

      const result = IssuableDataProviderFactory.create(mockExtensionState, mockAccountService);

      expect(IssuableDataProvider).toHaveBeenCalledWith(mockExtensionState);
      expect(LSIssuableDataProvider).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(IssuableDataProvider);
    });
  });
});
