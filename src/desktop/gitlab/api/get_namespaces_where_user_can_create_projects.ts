import { gql } from 'graphql-request';
import { GraphQLRequest } from '../../../common/platform/web_ide';
import { Node } from '../graphql/shared';

const searchNamespacesWhereUserCanCreateProjectsQuery = gql`
  query searchNamespacesWhereUserCanCreateProjects($search: String) {
    currentUser {
      id
      groups(permissionScope: CREATE_PROJECTS, search: $search) {
        nodes {
          id
          fullPath
          name
          visibility
          webUrl
        }
      }
      namespace {
        id
        fullPath
      }
    }
  }
`;

export interface GqlGroupWithPath {
  id: string;
  fullPath: string;
  name: string;
  visibility?: ProjectVisibility;
  webUrl: string;
}

export interface GqlNamespace {
  id: string;
  fullPath: string;
}

export interface GqlUserWithNamespaces {
  id: string;
  groups: Node<GqlGroupWithPath>;
  namespace: GqlNamespace;
}

export const getNamespacesWhereUserCanCreateProjects: (
  search: string,
) => GraphQLRequest<{ currentUser: GqlUserWithNamespaces }> = search => ({
  type: 'graphql',
  variables: { search },
  query: searchNamespacesWhereUserCanCreateProjectsQuery,
});
