import { gql } from 'graphql-request';
import { GraphQLRequest } from '../../../common/platform/web_ide';

export interface GqlProjectAccessLevel {
  project: {
    /** maxAccessLevel is the **users** maximum access level (permissions) in this project */
    maxAccessLevel: { integerValue: number };
  };
}

const queryGetAccessLevel = gql`
  query GetProject($namespaceWithPath: ID!) {
    project(fullPath: $namespaceWithPath) {
      maxAccessLevel {
        integerValue
      }
    }
  }
`;

export const getProjectAccessLevel: (
  namespaceWithPath: string,
) => GraphQLRequest<GqlProjectAccessLevel> = namespaceWithPath => ({
  type: 'graphql',
  query: queryGetAccessLevel,
  variables: { namespaceWithPath },
});
