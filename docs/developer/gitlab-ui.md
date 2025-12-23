# GitLab UI

[GitLab UI](https://gitlab.com/gitlab-org/gitlab-ui) is a web UI component library that implements Pajamas, our
design system. This extension makes use of some GitLab UI components in webviews.

## Vue2 vs Vue3

Our Vue2 webviews (located in `./webviews/vue2`) use GitLab UI.

Make any updates to the `@gitlab/ui` package version in this vue2 nested `package.json`.

## IDE theme integration

As VS Code allows configuring custom themes, we override the style of the GitLab UI components to match the current theme.

To do this, we use the global VS Code theme CSS variables. (See [styles.scss](https://gitlab.com/gitlab-org/gitlab-vscode-extension/blob/main/webviews/vue2/gitlab_duo_chat/src/styles.scss).) You can find a reference of all available variables in the [Theme Color](https://code.visualstudio.com/api/references/theme-color) page in the VS Code documentation.

## Test local builds in the extension

If you are making changes in `@gitlab/ui` and need to preview them in the extension, use [`yalc`](https://github.com/wclr/yalc) to link a local build of the package. `yalc` is a tool which acts like a local NPM repository for linking and sharing package builds between projects.

### From the GitLab UI project directory

1. Make your required component changes.
1. Run the following to create a `@gitlab/ui` build, and publish it to `yalc`:

   ```shell
   yarn run build && npx yalc publish
   ```

   If `npx` prompts you to install `yalc`, select `y`.

### From the VS Code project directory

1. Switch to the `vue2` directory:

   ```shell
   cd webviews/vue2
   ```

1. Link the locally published `@gitlab/ui` package you just published:

   ```shell
   npx yalc add @gitlab/ui
   ```

1. Switch back to the project root, and ensure you have updated packages installed:

   ```shell
   cd ../../ && npm install
   ```

1. Run the extension as you typically would, like `npm run build:desktop`. See [`CONTRIBUTING.md`](../../CONTRIBUTING.md#configuring-development-environment) for details.

The local `@gitlab/ui` build is now used in your local extension development host.

When making further changes in GitLab UI:

1. Re-build the `@gitlab-ui` package and push the latest changes to the local `yalc` repository:

   ```shell
   yarn run build && npx yalc publish --push
   ```

1. Restart your extension development host

   > [!warning]
   > The extension `watch:desktop` script does not detect changes to `node_modules`, so you should restart the watcher.

When your testing is complete:

1. Switch to the `vue2` directory:

   ```shell
   cd webviews/vue2
   ```

1. Unlink the `yalc` package:

   ```shell
   npx yalc remove @gitlab/ui
   ```
