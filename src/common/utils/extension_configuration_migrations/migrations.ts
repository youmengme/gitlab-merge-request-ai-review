import { log } from '../../log';
import { renameAiAssistToDuo } from './rename_ai_assist_to_duo';

export type ConfigurationMigration = () => Promise<void>;

const MIGRATIONS: Array<ConfigurationMigration> = [renameAiAssistToDuo];

export async function runExtensionConfigurationMigrations() {
  for (const [index, migration] of MIGRATIONS.entries()) {
    try {
      // Run migrations one at a time to avoid concurrently accessing/mutating the config
      // eslint-disable-next-line no-await-in-loop
      await migration();
    } catch (error) {
      log.error(`Configuration migration ${index + 1}/${MIGRATIONS.length} failed`, error);
    }
  }
}
