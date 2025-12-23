import * as packageJson from '../../desktop.package.json';
import { USER_COMMANDS } from './command_names';

describe('user commands', () => {
  it('should match exactly commands defined in package.json', () => {
    const packageJsonCommands = packageJson.contributes.commands.map(c => c.command);
    const constantCommands = Object.values(USER_COMMANDS);
    expect(packageJsonCommands.sort()).toEqual(constantCommands.sort());
  });
});
