import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { DatabaseSync } from 'node:sqlite';
import { normalizePath } from '../../scanner/safety/ProtectedPaths';
import { HashCacheStats } from '../../../shared/types';

export interface CachedFileRecord {
  path: string;
  sizeBytes: number;
  mtimeMs: number;
  sha256: string;
  lastVerifiedAt: number;
}

export class HashCacheDatabase {
  private db: DatabaseSync | null = null;
  private dbPath: string;
  private cacheHitsTotal = 0;
  private cacheMissesTotal = 0;

  constructor(customPath?: string) {
    if (customPath) {
      if (fs.existsSync(customPath) && fs.statSync(customPath).isDirectory()) {
        this.dbPath = path.join(customPath, 'hash_cache.db');
      } else {
        this.dbPath = customPath;
      }
    } else {
      const userData = app ? app.getPath('userData') : path.join(os.homedir(), '.cleanup');
      if (!fs.existsSync(userData)) {
        try {
          fs.mkdirSync(userData, { recursive: true });
        } catch {
          // Fallback
        }
      }
      this.dbPath = path.join(userData, 'hash_cache.db');
    }

    this.initDatabase();
  }

  private initDatabase(): void {
    try {
      const parentDir = path.dirname(this.dbPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      this.db = new DatabaseSync(this.dbPath);
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS file_hashes (
          path TEXT PRIMARY KEY,
          sizeBytes INTEGER NOT NULL,
          mtimeMs INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          lastVerifiedAt INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_file_hashes_size ON file_hashes(sizeBytes);
      `);
    } catch (err) {
      console.warn('Failed to initialize SQLite hash cache, falling back to disabled cache:', err);
      this.db = null;
    }
  }

  /**
   * Retrieves a cached SHA-256 hash ONLY if the file size and mtime match exactly.
   * If the file was changed or deleted, the cached entry is invalidated.
   */
  public getValidHash(filePath: string, sizeBytes: number, mtimeMs: number): string | null {
    if (!this.db) return null;

    const normalized = normalizePath(filePath);

    try {
      const stmt = this.db.prepare(
        'SELECT sha256, sizeBytes, mtimeMs FROM file_hashes WHERE path = ?'
      );
      const row = stmt.get(normalized) as { sha256: string; sizeBytes: number; mtimeMs: number } | undefined;

      if (!row) {
        this.cacheMissesTotal++;
        return null;
      }

      // Exact match verification
      if (Number(row.sizeBytes) === Number(sizeBytes) && Number(row.mtimeMs) === Number(mtimeMs)) {
        // Confirm file still physically exists on disk
        if (fs.existsSync(normalized)) {
          this.cacheHitsTotal++;
          // Update lastVerifiedAt
          const updateStmt = this.db.prepare('UPDATE file_hashes SET lastVerifiedAt = ? WHERE path = ?');
          updateStmt.run(Date.now(), normalized);
          return row.sha256;
        } else {
          // File missing on disk -> invalidate entry
          this.deleteEntry(normalized);
          this.cacheMissesTotal++;
          return null;
        }
      }

      // Changed file -> invalidate entry
      this.deleteEntry(normalized);
      this.cacheMissesTotal++;
      return null;
    } catch {
      this.cacheMissesTotal++;
      return null;
    }
  }

  /**
   * Caches or updates a validated SHA-256 hash for a file.
   */
  public setHash(filePath: string, sizeBytes: number, mtimeMs: number, sha256: string): void {
    if (!this.db || !filePath || !sha256) return;

    const normalized = normalizePath(filePath);

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO file_hashes (path, sizeBytes, mtimeMs, sha256, lastVerifiedAt)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(normalized, sizeBytes, mtimeMs, sha256, Date.now());
    } catch (err) {
      console.warn('Failed to cache hash in SQLite:', err);
    }
  }

  public deleteEntry(filePath: string): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare('DELETE FROM file_hashes WHERE path = ?');
      stmt.run(normalizePath(filePath));
    } catch {
      // Ignore
    }
  }

  /**
   * Prunes database records for files that no longer exist or are outside allowed scan roots.
   * NEVER deletes user files on disk; only removes database index entries.
   */
  public pruneStaleEntries(allowedRoots: string[]): { prunedCount: number } {
    if (!this.db) return { prunedCount: 0 };

    const normalizedRoots = allowedRoots.map(normalizePath);
    let prunedCount = 0;

    try {
      const stmt = this.db.prepare('SELECT path FROM file_hashes');
      const allRows = stmt.all() as { path: string }[];

      const deleteStmt = this.db.prepare('DELETE FROM file_hashes WHERE path = ?');

      for (const row of allRows) {
        const p = row.path;
        const exists = fs.existsSync(p);
        const insideRoot = normalizedRoots.some((r) => p.startsWith(r));

        if (!exists || !insideRoot) {
          deleteStmt.run(p);
          prunedCount++;
        }
      }
    } catch (err) {
      console.warn('Cache prune error:', err);
    }

    return { prunedCount };
  }

  public getStats(): HashCacheStats {
    let entryCount = 0;
    let dbSizeBytes = 0;

    if (this.db) {
      try {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM file_hashes');
        const row = stmt.get() as { count: number } | undefined;
        entryCount = row ? row.count : 0;
      } catch {
        // Ignore
      }

      try {
        if (fs.existsSync(this.dbPath)) {
          dbSizeBytes = fs.statSync(this.dbPath).size;
        }
      } catch {
        // Ignore
      }
    }

    return {
      entryCount,
      dbSizeBytes,
      cacheHitsTotal: this.cacheHitsTotal,
      cacheMissesTotal: this.cacheMissesTotal,
    };
  }

  public clear(): void {
    if (!this.db) return;
    try {
      this.db.exec('DELETE FROM file_hashes;');
      this.db.exec('VACUUM;');
      this.cacheHitsTotal = 0;
      this.cacheMissesTotal = 0;
    } catch (err) {
      console.warn('Failed to clear hash cache:', err);
    }
  }

  public close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // Ignore
      }
      this.db = null;
    }
  }
}

export const defaultHashCache = new HashCacheDatabase();
