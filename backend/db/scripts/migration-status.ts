import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { databasePath, ensureDatabaseDirectory } from '../../src/db/config.js';
import { discoverMigrations, migrationsDirectory } from './migrate.js';

export interface MigrationStatus { version: string; state: 'applied' | 'pending' | 'checksum-mismatch' | 'missing'; }

export function migrationStatus({ path = databasePath(), directory = migrationsDirectory } = {}): MigrationStatus[] {
  const migrations = discoverMigrations(directory);
  if (!existsSync(path)) return migrations.map(migration => ({ version: migration.version, state: 'pending' }));
  const database = new Database(ensureDatabaseDirectory(path), { readonly: true });
  try {
    const migrationsTable = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get();
    if (!migrationsTable) return migrations.map(migration => ({ version: migration.version, state: 'pending' }));
    const applied = new Map((database.prepare('SELECT version, checksum FROM schema_migrations').all() as Array<{ version: string; checksum: string }>).map(row => [row.version, row.checksum]));
    const available = new Set(migrations.map(migration => migration.version));
    const known = migrations.map(migration => ({ version: migration.version, state: !applied.has(migration.version) ? 'pending' as const : applied.get(migration.version) === migration.checksum ? 'applied' as const : 'checksum-mismatch' as const }));
    const missing = [...applied.keys()].filter(version => !available.has(version)).map(version => ({ version, state: 'missing' as const }));
    return [...known, ...missing];
  } finally {
    database.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const migration of migrationStatus()) process.stdout.write(`${migration.state.padEnd(17)} ${migration.version}\n`);
}
