#!/usr/bin/env node
/* eslint-disable no-console */

import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { coerce, lte, gt } from 'semver';

// helper function to distinguish debugging logs from output logs included in the changelog
const debug = (...args) => console.error(...args);

const LS_CHANGELOG_URL =
  'https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp/-/raw/main/CHANGELOG.md';

// Skipping first two elements (path to node.js executable and path to the script) to get the actual arguments
const [PREV_VSC_GIT_TAG, NEXT_VSC_GIT_TAG] = process.argv.slice(2);

if (!PREV_VSC_GIT_TAG || !NEXT_VSC_GIT_TAG) {
  console.error('Error: VS Code git tag is missing');
  process.exit(0);
}

debug(`Previous gitlab-vscode-extension version: ${PREV_VSC_GIT_TAG}`);
debug(`New gitlab-vscode-extension version: ${NEXT_VSC_GIT_TAG}`);

// Extract previous LS version
let PREV_LS_VERSION;
try {
  const prevPackageLock = execSync(`git show "${PREV_VSC_GIT_TAG}:package-lock.json"`, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
  });
  const prevPackageLockJson = JSON.parse(prevPackageLock);
  PREV_LS_VERSION = coerce(
    prevPackageLockJson.packages['node_modules/@gitlab-org/gitlab-lsp'].version,
  );
} catch (error) {
  console.error('Error: Failed to extract previous LS version', error);
  process.exit(0);
}

// Extract next LS version
let NEXT_LS_VERSION;
try {
  const packageLock = JSON.parse(readFileSync('./package-lock.json', 'utf-8'));
  NEXT_LS_VERSION = coerce(packageLock.packages['node_modules/@gitlab-org/gitlab-lsp'].version);
} catch (error) {
  console.error('Error: Failed to extract next LS version', error);
  process.exit(0);
}

if (!PREV_LS_VERSION || !NEXT_LS_VERSION) {
  console.error('Error: Failed to extract LS versions from package-lock.json');
  process.exit(0);
}

debug(`Previous gitlab-lsp Version: ${PREV_LS_VERSION}`);
debug(`Next gitlab-lsp Version: ${NEXT_LS_VERSION}`);

// Get the versions between PREV_LS_VERSION and NEXT_LS_VERSION
let LS_VERSIONS;
try {
  const versionsOutput = execSync('npm view @gitlab-org/gitlab-lsp versions --json', {
    encoding: 'utf-8',
  });
  const allVersions = JSON.parse(versionsOutput);
  LS_VERSIONS = allVersions.filter(v => {
    const parsedVersion = coerce(v);
    return (
      parsedVersion && gt(parsedVersion, PREV_LS_VERSION) && lte(parsedVersion, NEXT_LS_VERSION)
    );
  });
} catch (error) {
  console.error('Failed to fetch LS versions from npm registry');
  process.exit(0);
}

// When there is no version diff, exit
if (LS_VERSIONS.length === 0) {
  debug('No gitlab-lsp updates to pull');
  process.exit(0);
}

// Create temporary directory
const TEMP_DIR = mkdtempSync(join(tmpdir(), 'ls-changelog-'));

function cleanUp() {
  debug('Cleaning up temporary files...');
  rmSync(TEMP_DIR, { recursive: true, force: true });
}

async function fetchWithTimeout(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

process.on('exit', cleanUp);
process.on('SIGINT', () => {
  cleanUp();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanUp();
  process.exit(0);
});

// Download changelog
const LS_CHANGELOG_FILE = join(TEMP_DIR, 'lsp-changelog.md');
try {
  const response = await fetchWithTimeout(LS_CHANGELOG_URL);
  const changelog = await response.text();
  writeFileSync(LS_CHANGELOG_FILE, changelog);
} catch (error) {
  console.error(`Error: Failed to download changelog from ${LS_CHANGELOG_URL}`);
  process.exit(0);
}

// Extract changelog entries for each version
function extractChangelogForVersion(changelogContent, version) {
  const lines = changelogContent.split('\n');
  const result = [];
  let matchingVer = false;

  for (const line of lines) {
    // Check if this is a version header
    if (line.startsWith('## [')) {
      // Stop if we already processed the matching version
      if (matchingVer) break;

      // Check if the current line contains the version we are looking for in markdown link format
      // e.g ## [1.2.3](https://example.com)
      if (line.includes(`[${version}](`)) {
        matchingVer = true;
      }
    }

    if (matchingVer) {
      // Add extra # to decrease the header level
      if (line.startsWith('#')) {
        result.push(`#${line}`);
      } else {
        result.push(line);
      }
    }
  }

  return result.join('\n');
}

const changelogContent = readFileSync(LS_CHANGELOG_FILE, 'utf-8');

// Prepare changelog entries for Language Server releases
console.log(
  `### Language Server Release [${PREV_LS_VERSION}...${NEXT_LS_VERSION}](https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp/-/compare/v${PREV_LS_VERSION}...v${NEXT_LS_VERSION})`,
);

for (const version of LS_VERSIONS) {
  debug(`Extracting changelog for version: ${version}`);
  const versionChangelog = extractChangelogForVersion(changelogContent, version);
  console.log(versionChangelog);
  console.log('');
}
