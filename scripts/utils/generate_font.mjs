import * as fs from 'node:fs';
import * as path from 'node:path';
import { webfont } from 'webfont';
import { root } from './run_utils.mjs';

const ICONS_PATH = path.resolve(root, 'src/assets/icons');
const FONT_PATH = 'assets/gitlab_icons.woff';

function getUnicodeCharacterFromConfigEntry(entry) {
  const character = parseInt(entry.default.fontCharacter.replace(/^\\/, ''), 16);

  if (Number.isNaN(character)) {
    throw new Error(`Invalid character code ${character}`);
  }

  return String.fromCodePoint(character);
}

export async function generateFont(packageJson, targetDirectory) {
  /*
   * the contributes.icons is an object like this one:
   * ```json
   * {
   * "gitlab-code-suggestions-disabled": {
   *   "description": "GitLab Code Suggestions Disabled",
   *   "default": {
   *     "fontPath": "./assets/gitlab_icons.woff",
   *     "fontCharacter": "\\eA03"
   *   }
   * }
   * ```
   */
  const icons = packageJson?.contributes?.icons;

  if (!icons) {
    return;
  }

  const resolvedFontPath = path.resolve(root, targetDirectory, FONT_PATH);

  const iconEntries = Object.entries(icons).filter(
    ([, configEntry]) =>
      path.resolve(root, targetDirectory, configEntry.default.fontPath) === resolvedFontPath,
  );

  const iconMap = Object.fromEntries(
    iconEntries.map(([iconName, configEntry]) => [
      iconName,
      getUnicodeCharacterFromConfigEntry(configEntry),
    ]),
  );

  const iconFiles = iconEntries.map(([iconName]) => {
    const iconFile = `${iconName}.svg`;
    const iconPath = path.join(ICONS_PATH, iconFile);
    if (!fs.existsSync(iconPath)) {
      throw new Error(`Icon not found: ${iconPath}`);
    }
    // The latest version of webfont depends on an older version of globby, which does not support
    // backslashes in input paths and causes no webfonts to be generated when developing on Windows.
    return iconPath.replace(/\\/g, '/');
  });

  const generatedFont = await webfont({
    files: iconFiles,
    formats: ['woff'],
    fontHeight: 1000,
    normalize: true,
    fixedWidth: true,
    centerHorizontally: true,
    glyphTransformFn: obj => ({
      ...obj,
      unicode: [iconMap[obj.name]],
    }),
  });

  fs.writeFileSync(resolvedFontPath, generatedFont.woff);
}
