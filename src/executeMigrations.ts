import { showError, showInfo } from "./foundry/notifications";
import { getSetting, setSetting } from "./foundry/settings";
import getMessage from './foundry/getMessage';
import getGame from "./foundry/getGame";
import { logInfo } from "./util/logger";

type MigrateFn = () => Promise<void>;

const migrationModules = import.meta.glob<true, '', { default: MigrateFn }>('./migrations/*.ts', { eager: true });
const sortedMigrationModuleNames = Object.keys(migrationModules).sort();

function getMigrationVersionFromModuleName(moduleName: string) {
    return moduleName.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
}

export default async function executeMigrations(): Promise<void> {
    // Handle initial migration version. If there are no kanka journal entries yet, we set the latest migration as executed.
    // If there already are some, we set a specific version as already executed as it is the last one that existed before the
    // migrationVersion setting was introduced. If there already is a valid migrationVersion setting, we do nothing.
    if (!getSetting('migrationVersion')) {
        const hasJournalEntries = Array.from(getGame().journal.values()).some((e: any) => e.getFlag('kanka-foundry', 'id'));
        console.log('Kanka', hasJournalEntries)
        if (hasJournalEntries) {
            await setSetting('migrationVersion', '2024-07-28');
        } else {
            await setSetting('migrationVersion', getLatestMigrationVersion());
        }
    }

    const currentMigrationVersion = getSetting('migrationVersion');
    const newestMigrationVersion = getLatestMigrationVersion();

    const relevantMigrations = sortedMigrationModuleNames.filter(key => getMigrationVersionFromModuleName(key) > currentMigrationVersion);
    if (relevantMigrations.length === 0) return;

    try {
        showInfo('migration.started');

        for (const key of relevantMigrations) {
            logInfo(`Executing migration ${key}`);
            const version = getMigrationVersionFromModuleName(key);
            await migrationModules[key].default();
            await setSetting('migrationVersion', version);
        }

        showInfo('migration.finished');
    } catch (error) {
        showError('migration.failed', { error: (error as Error).message });
    }

}

export function getLatestMigrationVersion() {
    return getMigrationVersionFromModuleName(sortedMigrationModuleNames[sortedMigrationModuleNames.length - 1]);
}
