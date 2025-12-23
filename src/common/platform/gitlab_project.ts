export interface GitLabProject {
  gqlId: string;

  restId: number;

  name: string;

  description: string;

  namespaceWithPath: string;

  webUrl: string;

  // TODO: This is used only in one spot, probably a good idea to remove it from this main class
  groupRestId?: number;
}
