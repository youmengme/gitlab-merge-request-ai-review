export type EnabledCallback = () => boolean;

export const IDE_EXTENSION_VERSION_SCHEMA_URL =
  'iglu:com.gitlab/ide_extension_version/jsonschema/1-0-0';

export const GITLAB_STANDARD_SCHEMA_URL = 'iglu:com.gitlab/gitlab_standard/jsonschema/1-0-9';

export const EXTENSION_EVENT_SOURCE = 'gitlab-vscode';

export type IdeExtensionContext = {
  schema: string;
  data: {
    ide_name?: string | null;
    ide_vendor?: string | null;
    ide_version?: string | null;
    extension_name?: string | null;
    extension_version?: string | null;
  };
};
export type SnowplowOptions = {
  appId: string;
  endpoint: string;
  timeInterval: number;
  maxItems: number;
  enabled: EnabledCallback;
  ideExtensionContext: IdeExtensionContext;
};

export const snowplowBaseOptions: Omit<SnowplowOptions, 'enabled' | 'ideExtensionContext'> = {
  appId: 'gitlab_ide_extension',
  endpoint: 'https://snowplowprd.trx.gitlab.net',
  timeInterval: 5000,
  maxItems: 10,
};
