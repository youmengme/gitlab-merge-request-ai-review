const { setupServer } = require('msw/node');
const { http, graphql, HttpResponse } = require('msw');
const projectResponse = require('../fixtures/graphql/project.json');
const versionResponse = require('../fixtures/rest/version.json');
const userResponse = require('../fixtures/rest/user.json');
const { duoCodeSuggestionsAvailableResponse } = require('../fixtures/graphql/code_suggestions');
const { API_URL_PREFIX } = require('./constants');

const createJsonEndpoint = (path, response) =>
  http.get(`${API_URL_PREFIX}${path}`, () => HttpResponse.json(response, { status: 200 }));

const createJsonPostEndpoint = (path, response, apiUrlPrefix = API_URL_PREFIX) =>
  http.post(`${apiUrlPrefix}${path}`, () => HttpResponse.json(response, { status: 200 }));

const sortRequestQuery = search =>
  search
    .slice(search.indexOf('?') + 1)
    .split('&')
    .sort()
    .join('&');

const createQueryJsonEndpoint = (path, queryResponseMap) =>
  http.get(`${API_URL_PREFIX}${path}`, ({ request }) => {
    const sortedQueryResponseMap = Object.keys(queryResponseMap).reduce((acc, key) => {
      const parsedKey = new URLSearchParams(sortRequestQuery(key)).toString();
      return { ...acc, [parsedKey]: queryResponseMap[key] };
    }, {});

    const response = sortedQueryResponseMap[sortRequestQuery(new URL(request.url).search)];

    if (!response) {
      console.warn(`API call ${request.url} doesn't have a query handler.`);
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(response, { status: 200 });
  });

const createTextEndpoint = (path, response) =>
  http.get(`${API_URL_PREFIX}${path}`, () => HttpResponse.text(response, { status: 200 }));

const createQueryTextEndpoint = (path, queryResponseMap) =>
  http.get(`${API_URL_PREFIX}${path}`, ({ request }) => {
    const response = queryResponseMap[new URL(request.url).search];
    if (!response) {
      console.warn(`API call ${request.url} doesn't have a query handler.`);
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.text(response, { status: 200 });
  });

const createPostEndpoint = (path, response) =>
  http.post(`${API_URL_PREFIX}${path}`, () => HttpResponse.json(response, { status: 201 }));

const notFoundByDefault = http.get(/.*/, ({ request }) => {
  console.warn(`API call ${request.url} doesn't have a query handler.`);
  return new HttpResponse(null, { status: 404 });
});

const getServer = (handlers = []) => {
  const server = setupServer(
    graphql.query('GetProject', ({ variables }) => {
      if (variables.namespaceWithPath === 'gitlab-org/gitlab')
        return HttpResponse.json({ data: projectResponse }, { status: 200 });
      return HttpResponse.json({ data: { project: null } }, { status: 200 });
    }),
    graphql.query('suggestionsAvailable', () =>
      HttpResponse.json({ data: duoCodeSuggestionsAvailableResponse }),
    ),
    createJsonEndpoint('/version', versionResponse),
    createJsonEndpoint('/user', userResponse),
    ...handlers,
    notFoundByDefault,
  );
  server.listen({ onUnhandledRequest: 'warn' });
  return server;
};

module.exports = {
  getServer,
  createJsonEndpoint,
  createQueryJsonEndpoint,
  createTextEndpoint,
  createQueryTextEndpoint,
  createPostEndpoint,
  createJsonPostEndpoint,
};
