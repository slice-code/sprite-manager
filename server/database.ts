import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export const DATA_DIR = path.join(process.cwd(), 'data');
export const DB_PATH = path.join(DATA_DIR, 'sprite-manager.db');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

export interface CategoryRow {
  id: number;
  name: string;
}

export interface ProjectRow {
  id: number;
  name: string;
  description: string;
  categoryId: number | null;
  coverImagePath: string | null;
  version: number;
  status: 'active' | 'archived';
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  sheetWidth: number;
  sheetHeight: number;
  fps: number;
  isFavorite: number;
  type: '2d' | '3d';
  createdAt: number;
  updatedAt: number;
}

export interface ProjectImageRow {
  id: number;
  projectId: number;
  filePath: string;
  fileName: string;
  sortOrder: number;
  isSelected: number;
}

export interface ProjectSheetRow {
  id: number;
  projectId: number;
  version: number;
  filePath: string;
  reverseFilePath: string | null;
  sheetWidth: number;
  sheetHeight: number;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  createdAt: number;
}

export interface ProjectTagRow {
  id: number;
  projectId: number;
  tagName: string;
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      categoryId INTEGER REFERENCES categories(id),
      coverImagePath TEXT,
      version INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      frameWidth INTEGER NOT NULL DEFAULT 64,
      frameHeight INTEGER NOT NULL DEFAULT 64,
      frameCount INTEGER NOT NULL DEFAULT 0,
      sheetWidth INTEGER NOT NULL DEFAULT 0,
      sheetHeight INTEGER NOT NULL DEFAULT 0,
      fps INTEGER NOT NULL DEFAULT 10,
      isFavorite INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT '2d' CHECK(type IN ('2d', '3d')),
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      filePath TEXT NOT NULL,
      fileName TEXT NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      isSelected INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS project_sheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      filePath TEXT NOT NULL,
      sheetWidth INTEGER NOT NULL,
      sheetHeight INTEGER NOT NULL,
      frameCount INTEGER NOT NULL,
      frameWidth INTEGER NOT NULL,
      frameHeight INTEGER NOT NULL,
      fps INTEGER NOT NULL DEFAULT 10,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      tagName TEXT NOT NULL,
      UNIQUE(projectId, tagName)
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updatedAt);
    CREATE INDEX IF NOT EXISTS idx_project_images_project ON project_images(projectId, sortOrder);
    CREATE INDEX IF NOT EXISTS idx_project_sheets_project ON project_sheets(projectId, version);
    CREATE INDEX IF NOT EXISTS idx_project_tags_project ON project_tags(projectId);
  `);
  runMigrations(database);
}

function runMigrations(database: Database.Database) {
  const columns = database.prepare('PRAGMA table_info(project_sheets)').all() as { name: string }[];
  if (!columns.some((c) => c.name === 'reverseFilePath')) {
    database.exec('ALTER TABLE project_sheets ADD COLUMN reverseFilePath TEXT');
  }
  const projColumns = database.prepare('PRAGMA table_info(projects)').all() as { name: string }[];
  if (!projColumns.some((c) => c.name === 'type')) {
    database.exec("ALTER TABLE projects ADD COLUMN type TEXT NOT NULL DEFAULT '2d'");
  }
}

export function isDatabaseEmpty(): boolean {
  const database = getDb();
  const row = database.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  return row.count === 0;
}
