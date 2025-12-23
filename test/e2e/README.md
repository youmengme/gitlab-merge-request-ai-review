## End-to-End tests

Utilises the WebdriverIO [VS Code Extension Testing service](https://webdriver.io/docs/extension-testing/vscode-extensions/) to test the GitLab Workflow extension using a real
instance of VSCode and `gitlab.com`. These tests will launch the latest `stable` version of VSCode with the GitLab Workflow extension installed from source.

- [End-to-End tests](#end-to-end-tests)
  - [Instructions for running End-to-End tests locally](#instructions-for-running-end-to-end-tests-locally)
  - [Testing AI-assisted features](#testing-ai-assisted-features)
    - [Rate limiting of AI features](#rate-limiting-of-ai-features)
  - [Debugging End-to-End tests](#debugging-end-to-end-tests)
  - [Working with the VSCode DOM in End-to-End tests](#working-with-the-vscode-dom-in-end-to-end-tests)
  - [Testing against different VSCode versions](#testing-against-different-vscode-versions)
  - [Testing against different GitLab instances](#testing-against-different-gitlab-instances)
  - [Scheduled pipelines](#scheduled-pipelines)

### Instructions for running End-to-End tests locally

1. Clone this repository
2. `cd gitlab-vscode-extension`
3. `npm ci`
4. `npm run package`
5. _ensure vsix file generated_
6. `cd test/e2e`
7. `npm install`
8. Create a valid GitLab [PAT](https://docs.gitlab.com/user/profile/personal_access_tokens/#create-a-personal-access-token) with the `api` scope
9. `TEST_GITLAB_TOKEN=<PAT from previous step> npm run test:e2e` OR to run `E2E Tests` from the [Run view](https://code.visualstudio.com/Docs/editor/debugging#_run-view), add the PAT from the previous step to `TEST_GITLAB_TOKEN` in [launch.json](https://code.visualstudio.com/Docs/editor/debugging#_launch-configurations) before running.

Note: the first time `test:e2e` is run, VSCode will be downloaded.

After the tests finish, an Allure report will be generated in `test/e2e/allure-report`.
If run in a CI pipeline, the Allure report will be stored in job artifacts for 10 days.

### Testing AI-assisted features

To successfully test [AI-assisted features](https://gitlab.com/gitlab-org/gitlab-vscode-extension#ai-assisted-features) the personal access token set with `TEST_GITLAB_TOKEN` must have access to the AI-assisted features under test.

### Running duo_workflow.e2e.js locally

Currently, we can only execute [duo_workflow.e2e.js](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/test/e2e/specs/duo_workflow.e2e.js?ref_type=heads) locally due to some issues:

- When run in CI, GitLab Duo Agent Platform healthcheck refuses to recognize [gitlab-vscode-extension](https://gitlab.com/gitlab-org/gitlab-vscode-extension) as a Gitlab project. See [discussion](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/1940#note_2450087281) for more information.
- [Issue with vscode browser](https://github.com/webdriverio-community/wdio-vscode-service/issues/136#issuecomment-2638674692) - We can only run the test successfully using browser versions upto `1.92.2`. Any versions after this will result in the same issue of browser closing when triggering some events. To run this spec locally, **change** 'browserVersion:' in [wdio.conf.js](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/test/e2e/wdio.conf.js?ref_type=heads#L92) to '1.92.2'
  and unskip [describe block](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/test/e2e/specs/duo_workflow.e2e.js?ref_type=heads#L27).
- [Optional] - to execute this spec only when run `npm run test:e2e`, **append** `--spec specs/duo_workflow.e2e.js` to `"test:e2e": "wdio run ./wdio.conf.js"` in [package.json](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/test/e2e/package.json?ref_type=heads#L20).

#### Rate limiting of AI features

Please note that AI-assisted features are rate limited, so depending on how many times the end-to-end tests are run, it can cause the test user to hit a rate limit which can cause test failures.
Running the test locally with a different personal access token may help confirm if the failure is caused by rate limiting. There is currently two relevant rate limits:

- `ai_action` (includes GitLab Duo Chat requests) rate limit is 160 across an 8 hour interval
- `code_suggestions_api_endpoint` rate limit is 60 across a 1 minute interval

See this [issue](https://gitlab.com/gitlab-org/gitlab/-/issues/494140) and [GitLab.com-specific rate limits](https://docs.gitlab.com/user/gitlab_com/#rate-limits-on-gitlabcom) for more details. To workaround this issue this project has a dedicated test user.

### Debugging End-to-End tests

In CI, the end-to-end tests automatically retry once if they fail. It can be helpful to retry the job in case of a network or upstream intermittent failure. It may also help to view the latest [`main` pipeline results](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/pipelines?page=1&scope=all&ref=main), to confirm if the failures are also occurring against the `main` branch.

If failures persist, view the Allure report in the job artifacts `test/e2e/allure-report/` directory, which will contain videos of any test failures. A link to the report can be found at the end of the job log. Raw failure videos can be found in the `test/e2e/allure-results/` directory. Please note that failure videos are only captured when retrying a test.
The WebdriverIO logs are saved as an artifact of the `test-e2e` job in `test/e2e/wdio-logs/` which can be useful in determining the reason for the failure.

### Working with the VSCode DOM in End-to-End tests

When writing or debugging tests, Chrome Developer Tools can be used to view the underlying elements of VSCode.

To open Developer Tools in VSCode select `Help -> Toggle Developer Tools`, select the `Elements` tab to view the DOM.

Since some of the elements required to excercise the GitLab VSCode extension are nested under multiple iframes, they can be difficult to find. To jump to the element within the DOM, select the `Select an element in the page to inspect it` (top left of the Elements toolbar) button and then select the desired element.

For a detailed overview of WebdriverIO selector usage, see the [WebdriverIO Selectors documentation.](https://webdriver.io/docs/selectors/)

### Testing against different VSCode versions

By default the end-to-end tests are run against the current [stable](https://code.visualstudio.com/updates) version of VSCode. To run the tests against a specific version, or the current [insiders](https://code.visualstudio.com/insiders/) version of VSCode, use the `E2E_VSCODE_VERSION` environment variable.

```shell
E2E_VSCODE_VERSION=1.97.1 TEST_GITLAB_TOKEN=<PAT> npm run test:e2e # specific version

E2E_VSCODE_VERSION=insiders TEST_GITLAB_TOKEN=<PAT> npm run test:e2e # latest insiders
```

### Testing against different GitLab instances

By default the end-to-end tests are run against `https://gitlab.com`. To run the tests against a different GitLab instance, use the `E2E_GITLAB_HOST` environment variable.

```shell
E2E_GITLAB_HOST=https://staging.gitlab.com TEST_GITLAB_TOKEN=<PAT> npm run test:e2e # test against https://staging.gitlab.com
```

### Scheduled pipelines

Using the `main` branch, the end-to-end tests are run daily against GitLab.com in a scheduled pipeline. This is to monitor if upstream changes have caused failures in the extension.

There is also a scheduled pipeline using the `insiders` version of VSCode.

The latest result can be viewed on the [Pipeline schedules page.](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/pipeline_schedules)
