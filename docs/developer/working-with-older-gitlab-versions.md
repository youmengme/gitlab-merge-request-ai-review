# Working with older versions of GitLab

The VS Code extensions supports older versions of GitLab. It's common to want to test such a scenario when making local changes. This page shows you how to do so.

## Using Release Environments (recommended - internal only)

GitLab Duo is available on [Release Environments](https://gitlab.com/gitlab-com/gl-infra/release-environments). Release Environments provide a number of maintained GitLab instances for certain older GitLab versions, intended for testing backports and other configurations where an older GitLab version is required.

Follow the instructions below to connect your local extension to a Release Environment with GitLab Duo enabled:

1. [Determine the version of GitLab to test](https://gitlab.com/gitlab-com/gl-infra/release-environments#how-to-determine-what-environments-are-available-and-how-to-access-them).
1. [Log in to the desired instance](https://gitlab.com/gitlab-org/release/docs/-/blob/master/runbooks/release-environment/get/connect-to-instance.md?ref_type=heads#connect-to-the-web-ui). This creates your user if it did not already exist.
1. First-time setup:
   1. Promote your user to an Admin if administrator access is required. For example, if you need to [change instance-level settings](https://gitlab.com/gitlab-org/release/docs/-/blob/master/runbooks/release-environment/get/connect-to-instance.md?ref_type=heads#gaining-admin-access).
   1. [Assign a GitLab Duo seat to your user](https://docs.gitlab.com/subscriptions/subscription-add-ons/#for-gitlab-self-managed). Release Environments have the [GitLab Duo Enterprise Add-On](https://gitlab.com/gitlab-org/release/docs/-/blob/master/runbooks/release-environment/get/gitlab-duo.md?ref_type=heads) and by default have no GitLab Duo seats, groups or projects configured.
   1. Create and configure a group and project.
      - Note: some GitLab Duo features [require a group namespace](https://docs.gitlab.com/development/ai_features/availability/). You may need to create a group before creating your project.
      - For certain features you may need to [enable experimental GitLab Duo features](https://docs.gitlab.com/user/gitlab_duo/turn_on_off/#on-gitlab-self-managed-2).
1. Authenticate within the VS Code extension.
   - Generate a Personal Access Token (PAT) for your user by navigating to `<the_instance_url>/-/user_settings/personal_access_tokens`.
   - **Command Palette** > **GitLab: Authenticate** > **Manually enter instance URL**. Use the URL of the instance from earlier.

These instances are managed by the Delivery group. If something seems broken with the environment, then the `#g_delivery` channel in Slack may be able to help.

## Using the local GitLab Development Kit

The GitLab Development Kit (GDK) does not support reverting an existing installation to previous versions without resetting the database. For this reason, create separate installations for the versions you want to test. This enables settings and test data to persist.

1. Decide which version of GitLab you want to test. Later steps in this process require a valid revision corresponding to that version.
1. On the [tags page](https://gitlab.com/gitlab-org/gitlab/-/tags/) of `gitlab-org/gitlab`, search for your desired version. For example, to test GitLab 17.4, you might take the `v17.4.6-ee` revision.

### Create the GDK folder and install the GDK

1. Follow [the one line step](https://gitlab.com/gitlab-org/gitlab-development-kit/-/blob/main/doc/index.md#one-line-installation) to create a GDK repository and install dependencies.
   - **Important:** To differentiate your GDK folders, give your GDK folder a unique name that includes your desired version. For example: `/dev/legacy_gdks/v17.4.6-ee`.

1. After the GDK is set up, go to the GDK directory.
1. Run `gdk config set gitlab.default_branch v17.4.6-ee`.
1. Run `gdk update`.
   - The `make gitlab-db-migrate` step is likely to fail at this point, because downgrading GitLab versions does not work for the database.
   - To resolve this, run `gdk reset-data` to clear all data. Your installation is new, so there's no data to lose.

Your GDK should now be set up with the older branch, and in a blank state. You may proceed with further setup, such as:

- [GitLab AI Gateway setup](https://gitlab.com/gitlab-org/gitlab-development-kit/-/blob/main/doc/howto/gitlab_ai_gateway.md)
- [GitLab Duo Workflow setup](https://gitlab.com/gitlab-org/gitlab-development-kit/-/blob/main/doc/howto/duo_workflow.md)

### Configure a unique URL for each instance (Optional)

When you add an account to the GitLab Workflow extension, the instance URL is used as the key to store the authentication token. To have multiple accounts corresponding to different GitLab versions, you need a unique URL for each GitLab instance.

You can set a [relative URL root](https://gitlab.com/gitlab-org/gitlab-development-kit/-/blob/main/doc/configuration.md#notable-settings) based on the revision (like `/v17_4_6-ee`). To do this:

1. Run `gdk config set relative_url_root /v17_4_6-ee`.
1. Run `gdk reconfigure`.

These commands update your instance URL to be `http://127.0.0.1:3000/v17_4_6-ee`.

Some other methods to set unique URLs per instance:

- The [`port` configuration option](https://gitlab.com/gitlab-org/gitlab-development-kit/-/blob/main/doc/configuration.md#notable-settings).
- [Local network binding](https://gitlab.com/gitlab-org/gitlab-development-kit/-/blob/main/doc/howto/local_network.md).
- [NGINX setup](https://gitlab.com/gitlab-org/gitlab-development-kit/-/blob/main/doc/howto/nginx.md).

### Connect to the GDK with your local GitLab Workflow extension

Assuming you have completed the basic setup:

1. Open VS Code with the GitLab Workflow extension installed.
1. Add a new account with the **GitLab: Authenticate** command.
1. Select **Manually enter instance URL**.
1. Enter your new GDK URL, for example `http://127.0.0.1:3000/v17_4_6-ee`.
1. Continue the setup steps with your preferred options.

### Enable advanced GDK features

Certain features require further GDK setup.

- [Enterprise License setup](https://gitlab.com/gitlab-org/gitlab-development-kit/-/blob/main/doc/index.md#use-gitlab-enterprise-features).
- [GitLab AI Gateway](https://gitlab.com/gitlab-org/gitlab-development-kit/-/blob/main/doc/howto/gitlab_ai_gateway.md).
- [GitLab Duo Workflow](https://gitlab.com/gitlab-org/gitlab-development-kit/-/blob/main/doc/howto/duo_workflow.md).

If you encounter errors, you may need to look at older versions of these docs to find compatible instructions.

## Troubleshooting

### Port conflicts between GDK instances

If you want to run multiple GDK instances at the same time, you may encounter port conflict errors.

To remedy this, you may either:

1. Ensure that you stop one GDK before starting another instance, OR
1. Follow [these instructions](https://gitlab.com/gitlab-org/gitlab-development-kit/-/blob/main/doc/configuration.md#run-gitlab-and-gitlab-foss-concurrently) to alter any conflicting ports.
