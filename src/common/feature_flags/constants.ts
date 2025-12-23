// Add your feature flag here
export enum FeatureFlag {
  // used for testing purposes
  TestFlag = 'testflag',
  RemoteSecurityScans = 'remoteSecurityScans',
  EditFileDiagnosticsResponse = 'editFileDiagnosticsResponse',
  SecurityScans = 'securityScansFlag',
  ForceCodeSuggestionsViaMonolith = 'forceCodeSuggestionsViaMonolith',
  LanguageServer = 'languageServer',
  CodeSuggestionsClientDirectToGateway = 'codeSuggestionsClientDirectToGateway',
  StreamCodeGenerations = 'streamCodeGenerations',
  CodeSuggestionsLicensePolicy = 'codeSuggestionsLicensePolicy',
  LanguageServerWebviews = 'languageServerWebviews',
  DuoWorkflowBinary = 'duoWorkflowBinary',
  DuoWorkflowSearch = 'duoWorkflowSearch',
  UseDuoChatUiForFlow = 'useDuoChatUiForFlow',
  FixWithDuoQuickChatCodeActions = 'fixWithDuoQuickChatCodeActions',
  LsCredentialsSync = 'lsCredentialsSync',
  FormatEdits = 'formatEdits',
  LsRepositories = 'useLanguageServerRepositories',
  DuoAgentPlatformNext = 'duoAgentPlatformNext',
}

// Set the feature flag default value here
export const FEATURE_FLAGS_DEFAULT_VALUES = {
  [FeatureFlag.RemoteSecurityScans]: true,
  [FeatureFlag.EditFileDiagnosticsResponse]: true,
  [FeatureFlag.SecurityScans]: true,
  [FeatureFlag.ForceCodeSuggestionsViaMonolith]: false,
  [FeatureFlag.TestFlag]: false,
  [FeatureFlag.LanguageServer]: true,
  [FeatureFlag.CodeSuggestionsClientDirectToGateway]: true,
  [FeatureFlag.StreamCodeGenerations]: true,
  [FeatureFlag.CodeSuggestionsLicensePolicy]: true,
  [FeatureFlag.LanguageServerWebviews]: true,
  [FeatureFlag.DuoWorkflowBinary]: false,
  [FeatureFlag.DuoWorkflowSearch]: false,
  [FeatureFlag.UseDuoChatUiForFlow]: false,
  [FeatureFlag.FixWithDuoQuickChatCodeActions]: true,
  [FeatureFlag.LsCredentialsSync]: true,
  [FeatureFlag.FormatEdits]: false,
  [FeatureFlag.LsRepositories]: false,
  [FeatureFlag.DuoAgentPlatformNext]: false,
};

// PLEASE NOTE: We can only query 20 flags at a time so this list shouldn't grow past that.
// https://gitlab.com/gitlab-org/gitlab/-/blob/933b5643feebe1feb471be2652d98497c17bc65b/app/graphql/resolvers/app_config/gitlab_instance_feature_flags_resolver.rb#L7
export enum InstanceFeatureFlag {
  DuoAgenticChat = 'duo_agentic_chat',
  DuoWorkflow = 'duo_workflow',
}

// The milestone where a feature flag was added. Early versions
// most likely did not have the feature at all so we can default
// to hiding it from the user.
export const InstanceFeatureFlagIntroduced = {
  // https://gitlab.com/gitlab-org/gitlab/-/issues/542441
  [InstanceFeatureFlag.DuoAgenticChat]: '18.0.0',
  // https://gitlab.com/gitlab-org/gitlab/-/issues/468627
  [InstanceFeatureFlag.DuoWorkflow]: '17.2.0',
};

// The milestone where a feature flag was enabled by default. Later
// instance versions should use a application setting, group setting,
// project setting, user preference etc. to disable the functionality
// which we should prefer to a feature flag when available.
export const InstanceFeatureFlagRollout = {
  // https://gitlab.com/gitlab-org/gitlab/-/issues/542441
  [InstanceFeatureFlag.DuoAgenticChat]: '18.2.0',
  // https://gitlab.com/gitlab-org/gitlab/-/issues/468627
  [InstanceFeatureFlag.DuoWorkflow]: '18.2.0',
};

export const INSTANCE_FEATURE_FLAGS = Object.values(InstanceFeatureFlag);
