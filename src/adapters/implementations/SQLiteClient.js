import initSqlJs from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SQLiteClient {
  constructor(options = {}) {
    this.dbPath = options.dbPath || join(process.cwd(), 'data', 'sales-agent-sdk.db');
    this.schemaPath = options.schemaPath || join(__dirname, 'sqlite-schema.sql');
    this.autoCreate = options.autoCreate ?? true;

    this.SQL = null;
    this.db = null;
  }

  async getDB() {
    if (this.db) {
      return this.db;
    }

    this.SQL = await initSqlJs();

    if (existsSync(this.dbPath)) {
      const bytes = readFileSync(this.dbPath);
      this.db = new this.SQL.Database(bytes);
      return this.db;
    }

    this.db = new this.SQL.Database();
    if (this.autoCreate) {
      const schema = readFileSync(this.schemaPath, 'utf8');
      this.db.exec(schema);
      await this.save();
    }

    return this.db;
  }

  async query(sql, params = []) {
    const db = await this.getDB();
    const result = db.exec(sql, params);

    if (!result.length) {
      return [];
    }

    const columns = result[0].columns;
    return result[0].values.map((row) => {
      const mapped = {};
      columns.forEach((column, index) => {
        mapped[column] = row[index];
      });
      return mapped;
    });
  }

  async queryOne(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows[0] || null;
  }

  async run(sql, params = []) {
    const db = await this.getDB();
    db.run(sql, params);
  }

  async lastInsertId() {
    const row = await this.queryOne('SELECT last_insert_rowid() AS id');
    return row ? row.id : null;
  }

  async tableExists(name) {
    const row = await this.queryOne(
      'SELECT name FROM sqlite_master WHERE type = ? AND name = ?',
      ['table', name]
    );
    return Boolean(row);
  }

  async save() {
    if (!this.db) {
      return;
    }

    const dir = dirname(this.dbPath);
    mkdirSync(dir, { recursive: true });

    const bytes = this.db.export();
    writeFileSync(this.dbPath, Buffer.from(bytes));
  }
}
