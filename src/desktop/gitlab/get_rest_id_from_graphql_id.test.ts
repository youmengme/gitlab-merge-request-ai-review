import { getRestIdFromGraphQLId } from '../../common/gitlab/api/get_rest_id_from_graphql_id';

describe('getRestIdFromGraphQLId', () => {
  it.each`
    graphQLId                         | restId
    ${'gid://gitlab/Project/5261717'} | ${5261717}
    ${'gid://gitlab/DiffNote/1'}      | ${1}
    ${'gid://gitlab/Issue/35284557'}  | ${35284557}
  `('converts $graphQLId to $restId', ({ graphQLId, restId }) => {
    expect(getRestIdFromGraphQLId(graphQLId)).toBe(restId);
  });

  it('throws error when it cannot parse the id', () => {
    expect(() => getRestIdFromGraphQLId('invalid id')).toThrowError(/invalid id can't be parsed/);
  });
});
