import * as packageJson from '../../package.json';
import * as desktopPackageJson from '../../desktop.package.json';

type PropertyInfo = { name: string; order?: number };

const getConfigPropertiesForCategory = (categoryId: string): PropertyInfo[] => {
  const categoryConfig = {
    ...packageJson.contributes.configuration.find(c => c.id === categoryId)?.properties,
    ...desktopPackageJson.contributes.configuration.find(c => c.id === categoryId)?.properties,
  };

  return Object.entries(categoryConfig).map(([name, config]) => ({
    name,
    order: (config as { order?: number }).order,
  }));
};

const sortProperties = (properties: PropertyInfo[]): string[] => {
  return [...properties]
    .sort((a, b) => (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY))
    .map(p => p.name);
};

describe('config properties', () => {
  it('match defined order in duo category', () => {
    const expectedFirstProperties = [
      'gitlab.duoCodeSuggestions.enabled',
      'gitlab.duoChat.enabled',
      'gitlab.duoAgentPlatform.enabled',
      'gitlab.duoCodeSuggestions.enabledSupportedLanguages',
      'gitlab.duoAgentPlatform.connectionType',
      'gitlab.duoAgentPlatform.defaultNamespace',
      'gitlab.duoCodeSuggestions.additionalLanguages',
      'gitlab.duo.enabledWithoutGitlabProject',
      'gitlab.keybindingHints.enabled',
      'gitlab.duoCodeSuggestions.openTabsContext',
    ];

    const properties = getConfigPropertiesForCategory('duo');
    const sortedProperties = sortProperties(properties);
    const actualFirstProperties = sortedProperties.slice(0, expectedFirstProperties.length);

    expect(actualFirstProperties).toEqual(expectedFirstProperties);
  });

  it('match defined order in custom-certificates category', () => {
    const expectedFirstProperties = ['gitlab.ca', 'gitlab.cert', 'gitlab.certKey'];

    const properties = getConfigPropertiesForCategory('custom-certificates');
    const sortedProperties = sortProperties(properties);
    const actualFirstProperties = sortedProperties.slice(0, expectedFirstProperties.length);

    expect(actualFirstProperties).toEqual(expectedFirstProperties);
  });

  it('match defined order in other category', () => {
    const expectedFirstProperties = ['gitlab.debug'];

    const properties = getConfigPropertiesForCategory('other');
    const sortedProperties = sortProperties(properties);
    const actualFirstProperties = sortedProperties.slice(0, expectedFirstProperties.length);

    expect(actualFirstProperties).toEqual(expectedFirstProperties);
  });
});
