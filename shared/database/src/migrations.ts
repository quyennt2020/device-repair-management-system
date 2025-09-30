import { PoolClient } from 'pg';
import { db } from './connection';

export interface Migration {
  id: string;
  name: string;
  up: (client: PoolClient) => Promise<void>;
  down: (client: PoolClient) => Promise<void>;
}

export class MigrationRunner {
  private migrations: Migration[] = [];

  constructor(migrations: Migration[]) {
    this.migrations = migrations.sort((a, b) => a.id.localeCompare(b.id));
  }

  public async createMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await db.query(query);
  }

  public async getExecutedMigrations(): Promise<string[]> {
    const result = await db.query('SELECT id FROM migrations ORDER BY id');
    return result.rows.map((row: any) => row.id);
  }

  public async runMigrations(): Promise<void> {
    await this.createMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();

    for (const migration of this.migrations) {
      if (!executedMigrations.includes(migration.id)) {
        console.log(`Running migration: ${migration.name}`);
        
        await db.transaction(async (client) => {
          await migration.up(client);
          await client.query(
            'INSERT INTO migrations (id, name) VALUES ($1, $2)',
            [migration.id, migration.name]
          );
        });

        console.log(`✅ Migration completed: ${migration.name}`);
      }
    }
  }

  public async rollbackMigration(migrationId: string): Promise<void> {
    const migration = this.migrations.find(m => m.id === migrationId);
    if (!migration) {
      throw new Error(`Migration not found: ${migrationId}`);
    }

    console.log(`Rolling back migration: ${migration.name}`);
    
    await db.transaction(async (client) => {
      await migration.down(client);
      await client.query('DELETE FROM migrations WHERE id = $1', [migrationId]);
    });

    console.log(`✅ Migration rolled back: ${migration.name}`);
  }
}