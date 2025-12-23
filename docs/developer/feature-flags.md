---
stage: AI-powered
group: Editor Extensions
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://about.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

# Feature flags

Feature flags define a way to control unstable or experimental features of the extension. We use simple configuration object to define enabled feature flags.

## Enabling or disabling feature flag

Open your `settings.json` and add configuration property similar to example below:

```json
"gitlab": {
    "featureFlags": {
        "snippets": true,
        "vulnerabilities": false
    }
}
```

## Working with feature flags while contributing to the extension

### Defining a feature flag

Add your feature flag to the `common/feature_flags/constants.ts` module. You can
also set a default value for the feature flag which allows enabling the feature
flag by default in future releases:

```typescript
// Add your feature flag here
export enum FeatureFlag {
  Snippets = 'snippets',
}

// Set the feature flag default value here
export const FEATURE_FLAGS_DEFAULT_VALUES = {
  [FeatureFlag.Snippets]: true,
};
```

### Checking if a feature flag is enabled

Example of checking feature flag state in the source code

```typescript
import { isEnabled, FeatureFlag } from 'common/feature_flags';

if (isEnabled(FeatureFlag.Snippets)) {
  // snippets are enabled
}
```

Example of checking feature flag state in `package.json`

```json
{
  "command": "gl.createSnippet",
  "when": "gitlab.featureFlags.snippets"
}
```
