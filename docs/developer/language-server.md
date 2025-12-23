---
stage: AI-powered
group: Editor Extensions
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://about.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

# Language server development and debugging

This document explains how to run the Workflow Extension and the
[GitLab Language Server](https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp)
side-by-side. It covers both debug mode, and how to see your changes in
Language Server in the extension.

## See all communication between VS Code and the LS

1. Add this setting `"gitlab-lsp.trace.server": "verbose",` to your `settings.json`.
1. See the messages in "GitLab Language Server" output panel.

See the [official documentation](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#logging-support-for-language-server) for details.

## Update your VS Code settings

To work with Language Server, add these properties to your VS Code's user or
workspace settings (`settings.json`):

```json
{
  "gitlab.featureFlags.languageServer": true,
  "gitlab.duoCodeSuggestions.enabled": true
}
```

## Link the Language Server node module

### Watch Mode (recommended)

Run the Language Server project in [the watch mode](https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp#watch-mode) to get the updates in the extension on every file change.

### Using yalc

Use [`yalc`](https://github.com/wclr/yalc) to link to your local language server project, rather than using the published NPM module.
Avoid using `npm link` as it causes issues where the language server is using a different version of the npm dependency
than the extension.

Prerequisites:

- Install `yalc` globally running `npm i yalc -g`

1. Go to a folder where you cloned the
   [GitLab Language Server](https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp) project.
1. Run `npm run bundle` to create the Language Server bundle file used by the Workflow extension.
1. Run `asdf install`
1. Run `yalc publish`
1. Go to the folder with the Workflow Extension project
1. Run `yalc add @gitlab-org/gitlab-lsp`
1. Run `npm install`

## Run both projects

1. (For yalc only) After every change to the Language Server project, run `npm run bundle` to
   bundle the latest Language Server version and `yalc push` to update the LS dependency in the extension.
1. [Start the extension](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/8a6f12ba3ec92ac059856f7e663eb6dc37b6d668/CONTRIBUTING.md#step---4--running-the-extension-in-desktop-vs-code)
   in debug mode.
1. [Connect debugger to the running Language server](https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp/-/blob/main/README.md#debug-the-server)
1. Profit!
1. (For yalc only) After you're done with testing run `yalc remove @gitlab-org/gitlab-lsp`.

## Create a VSCode build using an unpublished Language Server artifact

If you need to create a VSCode build using an unpublished Language Server artifact, but don't want to do it
locally (such as to check something on CI/CD):

1. Push your Language Server changes.
1. Create the merge request, and wait for the pipeline to succeed.
1. In the pipeline, select the `deploy` stage.
1. Select the `build_package_for_integration` job.
1. Search the job output for the success message which includes the package artifact, for example:

   ```log
   Package successfully built. To install it in another project, e.g. in the VS Code extension, run:

   npm install https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp/-/jobs/7870513256/artifacts/raw/gitlab-lsp.debounce-local-file-search.tgz
   ```

1. In VSCode, update your `package.json` -> `@gitlab-org/gitlab-lsp` version number with the artifact URL. For example:

   ```diff
   -    "@gitlab-org/gitlab-lsp": "^6.7.2",
   +    "@gitlab-org/gitlab-lsp": "https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp/-/jobs/7870513256/artifacts/raw/gitlab-lsp.debounce-local-file-search.tgz",
   ```

1. To ensure the `package-lock.json` is updated, run `npm install`.
1. Commit and push the branch.
1. Create a merge request, if one doesn't already exist, and wait for its pipeline to complete.
1. In the `Package` -> `package-test` job, download the `vsix` file from pipeline artifacts.

You can install the `vsix` extension package locally. It includes the Language Server artifact.

Remember: for any branches you want merged, revert to an actual published version first.
