# Developer Certificate of Origin + License

By contributing to GitLab Inc., You accept and agree to the following terms and
conditions for Your present and future Contributions submitted to GitLab Inc.
Except for the license granted herein to GitLab Inc. and recipients of software
distributed by GitLab Inc., You reserve all right, title, and interest in and to
Your Contributions. All Contributions are subject to the following DCO + License
terms.

[DCO + License](https://gitlab.com/gitlab-org/dco/blob/master/README.md)

All Documentation content that resides under the [docs/ directory](/docs) of this
repository is licensed under Creative Commons:
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

_This notice should stay as the first item in the CONTRIBUTING.md file._

---

## Contributing to GitLab Workflow

Thank you for your interest in contributing to GitLab Workflow! This guide details how to contribute
to this extension in a way that is easy for everyone. These are mostly guidelines, not rules.
Use your best judgement, and feel free to propose changes to this document in a merge request.

## Code of Conduct

We want to create a welcoming environment for everyone who is interested in contributing. Visit our [Code of Conduct page](https://about.gitlab.com/community/contribute/code-of-conduct/) to learn more about our commitment to an open and welcoming environment.

## Getting Started

### Reporting Issues

Create a [new issue from the "Default"(bug) template](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/new?issuable_template=Default) and follow the instructions in the template.

### Proposing Features

Create a [new issue from the "Feature Proposal" template](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/new?issuable_template=Feature%20Proposal) and follow the instructions in the template.

### Your First Code Contribution?

Read about the extension architecture in [`architecture.md`](docs/developer/architecture.md). This document explains how we structure our code, and helps you orient yourself in the codebase.

If your merge request is trivial (fixing typos, fixing a bug with 20 lines of code), create a merge request.

If your merge request is large, create an issue first. See [Reporting Issues](#reporting-issues) and [Proposing Features](#proposing-features). In the issue, the project maintainers can help you scope the work and make you more efficient.

For newcomers to the project, you can take a look at
[issues labeled as `Accepting merge requests`](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues?label_name[]=Accepting%20merge%20requests).

Consider joining our [community fork](https://gitlab.com/gitlab-community/gitlab-org/gitlab-vscode-extension) by following the [request process](https://gitlab.com/gitlab-community/meta#request-access-to-community-forks).

### Configuring Development Environment

For general information how to develop and debug VS Code Extensions, please see the [official documentation](https://code.visualstudio.com/api).

The following instructions will help you run the GitLab Workflow Extension locally.

Please review our [Coding guidelines](docs/developer/coding-guidelines.md) before writing new code.

#### Step - 1 : Installation Prerequisites

We're assuming that you already have [Visual Studio Code](https://code.visualstudio.com/) installed along
with [GitLab Workflow](https://marketplace.visualstudio.com/items?itemName=GitLab.gitlab-workflow) installed
and configured, if not, do that first! If already done, proceed ahead.

- [Git](https://git-scm.com/)
- [NodeJS](https://nodejs.org/en/)
  - Version is specified in [`.tool-versions`](.tool-versions)
  - We use the same major node version as VS Code
  - Please use [`mise`](https://mise.jdx.dev/) to manage your node version
- [Npm](https://www.npmjs.com/get-npm) (installed automatically by the `mise`)

#### Step - 2 : Fork and Clone

- Use your GitLab account to [fork](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/forks/new) this project
  - Don't know how forking works? Refer to [this guide](https://docs.gitlab.com/user/project/repository/forking_workflow/).
  - Don't have GitLab account? [Create one](https://gitlab.com/users/sign_up)! It is free and it is awesome!
- Visit your forked project (usually URL is `https://gitlab.com/<your user name>/gitlab-vscode-extension`).
- Set up pull mirroring to keep your fork up to date.
  - [How do I mirror repositories?](https://docs.gitlab.com/user/project/repository/mirror/pull/#configure-pull-mirroring)
  - Use `https://gitlab.com/gitlab-org/gitlab-vscode-extension.git` as the **Git repository URL**.
  - Mirroring the main repository is important to avoid false negatives of the commit linting, which is caused by an outdated `main` branch in forks. [#288](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/288) tracks the progress to resolve that bug.
- Go to your project overview and copy the SSH or HTTPS URL to clone the project into your system.
  - Don't know how to clone a project? Refer to [this guide](https://docs.gitlab.com/topics/git/commands/#clone-a-repository).

#### Step - 3 : Install dependencies

Once project is cloned, open terminal within the project folder and run following;

```shell
npm install
```

This command will install all necessary dependencies to run and debug extension in developer mode.

#### Step - 4 : Running the extension in Desktop VS Code

Open the extension project in VS Code (e.g. by running `code .` in the project folder).

To run the extension in development mode, start the background build and watch script
by either:

- **Starting an extension host** (a new VS Code window running the extension, it manages the extension build):
  1. Run the `View: Show Run and Debug` command (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>).
  1. Ensure the `Run Extension` command is selected.
  1. Select the green play icon, or press <kbd>F5</kbd>.
- **Starting the background build and watch script manually** by opening a terminal window in
  the project folder and running this command:

  ```shell
  npm run watch:desktop
  ```

Then, run the extension in development mode:

1. Run the `View: Show Run and Debug` command (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>).
1. Ensure the `Run Extension (without build)` command is selected.
1. Select the green play icon, or press <kbd>F5</kbd>.

When you start the background build and watch script manually, you can reload the extension without stopping and restarting the whole extension host:

1. Run the `Developer: Reload window` command (<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>), or press <kbd>Cmd</kbd> + <kbd>R</kbd>.

You can read through the [Running and debugging your extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension#run-the-extension) section of the official documentation.

#### Step - 5 : Running the Extension in WebIDE

WebIDE is browser-only VS Code that's packaged with every GitLab instance.

If you changed any code in the `src/browser` or `src/common` test the changes in WebIDE by [setting up the WebIDE locally](https://gitlab.com/gitlab-org/gitlab-web-ide/-/blob/main/docs/contributing/development-environment-setup.md#setup) and [setting up integrating with GitLab Workflow VS Code extension](https://gitlab.com/gitlab-org/gitlab-web-ide/-/blob/main/docs/contributing/development-environment-setup.md#setup-integrating-with-gitlab-workflow-vs-code-extension).

#### Step - 6 : Troubleshooting

Logs can be found by running `Developer: Show Logs ...` command (using `cmd+shift+p`) and selecting `Extension Host`.

You can always use debugger when you are running the extension in development mode.

#### Step - 7 : Run tests

To run tests in the terminal, run the following command from within the project folder:

```shell
npm test
```

The integration tests might not run if you have a VS Code instance already open. In that case either close all VS Code windows or run the tests from VS Code:

To run tests from the VS Code, use the `Unit Tests` and `Integration Tests` [launch configurations](https://code.visualstudio.com/Docs/editor/debugging#_launch-configurations) in the [Run view](https://code.visualstudio.com/Docs/editor/debugging#_run-view).

To run E2E tests, see [`test/e2e/README.md`](test/e2e/README.md).

See also [how to write automated tests](docs/developer/writing-tests.md).

#### Step - 8 : Run linter

To run linters, open terminal within the project folder and run following;

```shell
npm run autofix # Automatically formats your code using prettier and fixes eslint errors
npm run lint
```

#### Step - 9 : Add documentation

If you added or changed a feature, add the documentation to the README.

The majority of the user documentation is directly in [`README.md`](README.md), because that file is rendered in:

- The [extension marketplace page](https://marketplace.visualstudio.com/items?itemName=GitLab.gitlab-workflow).
- The extension overview directly in VS Code.

To add documentation that includes a new image:

1. Add images into the `docs/assets` folder, and commit the changes.
1. Edit the README file, and insert full permalinks to your new images.
   The permalinks contain the commit SHA from your first commit, and are
   in the form of:

   ```plaintext
   https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/raw/<COMMIT_SHA>/docs/assets/imagename.png
   ```

1. Commit your text changes.

For more examples, refer to the `gif` images in the README file.

### Adding a new feature

If you are contributing a new feature, these are the things to consider:

#### Do you need multiple MRs to complete the feature?

If you need multiple MRs, then you have to hide the partial functionality behind a feature flag. See our [feature flag documentation](docs/developer/feature-flags.md).

#### Should WebIDE support the feature?

WebIDE is a browser version of VS Code that ships with every GitLab instance. If you want the new feature to run in WebIDE, you need to put it in the `src/common` folder. See the ["Environments" section of the architecture documentation](docs/developer/architecture.md#environments).

### Opening Merge Requests

Steps to opening a merge request to contribute code to GitLab Workflow is similar to any other open source project.
You develop in a separate branch of your own fork and the merge request should have a related issue open in the project.
Any Merge Request you wish to open in order to contribute to GitLab Workflow, be sure you have followed through the steps from [Configuring Development Environment](#configuring-development-environment).

If you're introducing a breaking change:

- Clearly highlight these details in your merge request
- Include information on additional required integration changes (e.g., for the WebIDE project)
- Provide special release instructions, if necessary
- Provide instructions for rolling back the change in the event of an incident, if your change would complicate that

### Working with feature flags

Please see [Feature Flags guide](docs/developer/feature-flags.md) for details.

### Working with older versions of GitLab

Please see [Working with older GitLab versions](docs/developer/working-with-older-gitlab-versions.md) for details.
