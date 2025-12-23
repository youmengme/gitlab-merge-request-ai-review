# Development environment

## Setting up

We use [mise](https://mise.jdx.dev/) to manage our development environment. In order to get started, please [install mise CLI](https://mise.jdx.dev/getting-started.html#installing-mise-cli)

Once `mise` is installed, you can start using it. If you open the project folder in your terminal, you may see a warning message if any tools are missing on your machine:

```shell
mise WARN  missing: node@18.19.0
```

In order to install missing tools run the following command:

```shell
mise install
```

## Environment variables

In order to run some scripts you may need to have specific environment variables set up. A convenient place to manage it is `mise.local.toml` file, as it is not committed to `git`. You can use contents of `example.mise.local.toml` as a reference.
To set up your environment variables add any you need in the `[env]` section.
For example:

```toml
[env]
TEST_GITLAB_TOKEN="<your-test-token"
```

Once you've changed this file, you can apply the changes by running the following command:

```shell
mise set
```

The environment variables will be applied to your shell when you `cd` into a project directory, so typically you don't have to worry about it.

## Local overrides

Tools and env variables defined in `mise.local.toml` will override any defined in `./mise/config.toml`. This may be helpful if you work on something related to upgrading tools versions or need to change environment variables.

## Editor extensions

There is a [Mise VSCode](https://marketplace.visualstudio.com/items?itemName=hverlin.mise-vscode) extension available. It does not have a lot of downloads, but it allows your editor to integrate with `mise`. You can check if all the tools are installed, see the environment variables, etc.
For example:

![Mise VSCode extension](./assets/Screenshot%202025-03-18%20at%2013.39.01.png)

## Scripts and tasks

Right now all development-related scripts are either defined in `package.json` file, or located in `./scripts` folder.
This [will be changed in the future](https://gitlab.com/groups/gitlab-org/-/epics/17149) and will be managed by `mise` as well.
For now, `mise` adds `./node_modules/.bin` folder to the `path` so you can access installed `npm` tools by simply running the command, for example

```shell
jest --config jest.unit.config.ts
```
