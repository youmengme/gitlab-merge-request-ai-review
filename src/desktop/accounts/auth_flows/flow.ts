import { Account } from '../../../common/platform/gitlab_account';

export interface Flow {
  readonly title: string;
  readonly description: string;
  supportsGitLabInstance(url: string): boolean;
  authenticate(url: string): Promise<Account | undefined>;
}
