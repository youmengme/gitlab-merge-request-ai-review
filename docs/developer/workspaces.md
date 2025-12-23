---
stage: AI-powered
group: Editor Extensions
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://about.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

# Use workspaces to develop the GitLab VS Code extension

GitLab team members can use [Workspaces](https://docs.gitlab.com/user/workspace/) to develop
the GitLab extension for VS Code.

To create a new workspace:

1. Go to the [GitLab extension for VS Code project](https://gitlab.com/gitlab-org/gitlab-vscode-extension).
1. From the **Branches** dropdown list, select the branch you want to work on.
1. Select **Edit** and from the dropdown list, select **New workspace**.
1. On the **New workspace** form, select **Create workspace**.
1. When the workspace is created, select the option to open it in VS Code for the Web.

When you first open the workspace, a VS Code task automatically starts to install `asdf`
and `npm` dependencies. This process takes a few minutes to complete.

After the installation completes, you can begin development in your workspace!
