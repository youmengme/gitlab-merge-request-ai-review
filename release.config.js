/* eslint-disable no-template-curly-in-string */
const isPrerelease = process.env.IS_PRERELEASE === 'true' || process.argv.includes('--prerelease');
const releaseType = isPrerelease ? 'pre-release' : 'release';
const headerPartial = `{{#if isPatch~}}  ##{{~else~}}  #{{~/if}} **${releaseType}**  {{#if @root.linkCompare~}}  [{{version}}](  {{~#if @root.repository~}}    {{~#if @root.host}}      {{~@root.host}}/    {{~/if}}    {{~#if @root.owner}}      {{~@root.owner}}/    {{~/if}}    {{~@root.repository}}  {{~else}}    {{~@root.repoUrl}}  {{~/if~}}  /compare/{{previousTag}}...{{currentTag}}){{~else}}  {{~version}}{{~/if}}{{~#if title}} "{{title}}"{{~/if}}{{~#if date}} ({{date}}){{/if}}`;

module.exports = {
  branches: 'main',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          {
            type: 'refactor',
            release: 'patch',
          },
          {
            type: 'docs',
            scope: 'README',
            release: 'patch',
          },
          {
            type: 'test',
            release: 'patch',
          },
          {
            type: 'style',
            release: 'patch',
          },
          {
            type: 'perf',
            release: 'patch',
          },
          {
            type: 'ci',
            release: 'patch',
          },
          {
            type: 'build',
            release: 'patch',
          },
          {
            type: 'chore',
            release: 'patch',
          },
          {
            type: 'no-release',
            release: false,
          },
        ],
      },
    ],
    [
      {
        name: 'force-version-update',
        analyzeCommits: () => {
          // This custom plugin ensures we can always release a main release, even if there is no version-bumping commits provided
          // Semantic release gathers analyzeCommits responses from all the plugins and finds the highest version bump strategy.
          // By providing 'patch' as a version bump strategy for main releases, we can ensure that a release is always created.

          if (isPrerelease) {
            return null;
          }

          return 'patch';
        },
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        writerOpts: {
          headerPartial,
          commitPartial:
            '* {{#if scope}}**{{scope}}:** {{/if}}{{subject}}{{#if hash}} ([{{shortHash}}]({{@root.host}}/{{@root.owner}}/{{@root.repository}}/commit/{{hash}})){{/if}}{{#if author.name}} by {{author.name}}{{/if}}\n',
        },
        presetConfig: {
          types: [
            {
              type: 'feat',
              section: '✨ Features',
              hidden: false,
            },
            {
              type: 'fix',
              section: '🐛 Bug Fixes',
              hidden: false,
            },
            {
              type: 'docs',
              section: '📝 Documentation',
              hidden: false,
            },
            {
              type: 'style',
              section: '💈 Code-style',
              hidden: false,
            },
            {
              type: 'refactor',
              section: '⚡ Refactor',
              hidden: false,
            },
            {
              type: 'perf',
              section: '⏩ Performance',
              hidden: false,
            },
            {
              type: 'test',
              section: '✅ Tests',
              hidden: false,
            },
            {
              type: 'ci',
              section: '🔁 CI',
              hidden: false,
            },
            {
              type: 'chore',
              section: '🔁 Chore',
              hidden: false,
            },
          ],
        },
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    [
      '@semantic-release/npm',
      {
        npmPublish: false,
      },
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd: './scripts/semantic-release-prepare.sh',
        generateNotesCmd:
          './scripts/extract_ls_changelog.mjs ${lastRelease.gitTag} ${nextRelease.gitTag}',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'package-lock.json', 'CHANGELOG.md'],
        message: 'chore(release): ${nextRelease.version}\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/gitlab',
      {
        assets: [
          {
            path: 'dist-desktop/*.vsix',
            label: 'gitlab-workflow-${nextRelease.version}.vsix',
            target: 'generic_package',
            type: 'package',
          },
        ],
      },
    ],
    [
      'semantic-release-slack-bot',
      {
        notifyOnSuccess: false,
        notifyOnFail: false,
        markdownReleaseNotes: true,
        slackWebhookEnVar: 'SLACK_WEBHOOK',
        branchesConfig: [
          {
            pattern: 'main',
            notifyOnSuccess: true,
            notifyOnFail: true,
          },
        ],
        onSuccessTemplate: {
          text: '🚀🚀🚀 *GitLab Workflow* extension has been released 🚀🚀🚀 \n\n$release_notes',
        },
      },
    ],
  ],
};
