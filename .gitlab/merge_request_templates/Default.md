## Description

<!---
This MR needs to produce conventional commit(s) in the main branch.
Ensure one of the following:
- the MR title is a conventional commit message and the MR is set to squash
- the MR is not set to squash and all MR commits have valid conventional commit messages

Docs: https://gitlab.com/gitlab-org/gitlab-vscode-extension/blob/main/docs/developer/commits.md?plain=0#commit-conventions
-->

<!--- Describe your changes in detail -->

## Related Issues

<!--- This project only accepts merge requests related to open issues
If suggesting a new feature or change, please discuss it in an issue first
If fixing a bug, there should be an issue describing it with steps to reproduce -->

Resolves #[issue_number]

## How has this been tested?

<!--- Please describe in detail how you tested your changes. -->
<!--- Include details of your testing environment, and the tests you ran to -->
<!--- see how your change affects other areas of the code, etc. -->

- [ ] If `src/browser` or `src/common` has been modified, please consider interoperability with the Web IDE. See [Running the Extension in WebIDE.](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/CONTRIBUTING.md?ref_type=heads#step---5--running-the-extension-in-webide)
- [ ] Consider an [end-to-end test](https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/blob/main/test/e2e/README.md) for significant new features that aren't covered by integration tests.

## Screenshots (if appropriate)

### What CHANGELOG entry will this MR create?

<!--- What types of changes does your code introduce? Put an `x` in all the boxes that apply: -->

- [ ] `fix: ` Bug fix fixes - a user-facing issue in production - included in changelog
- [ ] `feature: ` New feature - a user-facing change which adds functionality - included in changelog
- [ ] `BREAKING CHANGE:` (fix or feature that would cause existing functionality to change) - should bump major version, mentioned in the changelog
- [ ] None - other non-user-facing changes

/label ~"devops::ai-powered" ~"group::editor extensions" ~"Category:Editor Extensions" ~"Editor Extensions::VS Code" ~"section::dev"
/assign me
