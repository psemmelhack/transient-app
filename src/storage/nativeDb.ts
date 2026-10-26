import * as SQLite from 'expo-sqlite';

let database: SQLite.SQLiteDatabase | null = null;

/** One on-device database for saved transients and the last style. */
export function nativeDb(): SQLite.SQLiteDatabase {
  if (!database) {
    database = SQLite.openDatabaseSync('transient.db');
    database.execSync(`
      CREATE TABLE IF NOT EXISTS transients (
        id TEXT PRIMARY KEY NOT NULL,
        capturedAt TEXT NOT NULL,
        json TEXT NOT NULL,
        png BLOB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }
  return database;
}
