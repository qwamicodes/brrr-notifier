import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type ClaimResult = 'claimed' | 'completed' | 'in_progress'

export interface SalesEventStore {
  claim(eventId: string): ClaimResult
  complete(eventId: string): void
  release(eventId: string): void
}

const RETENTION_SECONDS = 90 * 24 * 60 * 60
const STALE_CLAIM_SECONDS = 5 * 60

export class SqliteSalesEventStore implements SalesEventStore {
  private readonly database: Database

  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true })
    }

    this.database = new Database(path, { create: true, strict: true })
    this.database.run('PRAGMA journal_mode = WAL')
    this.database.run(`
      CREATE TABLE IF NOT EXISTS sales_webhook_events (
        event_id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('processing', 'completed')),
        claimed_at INTEGER NOT NULL,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS sales_webhook_events_completed_at_idx
        ON sales_webhook_events(completed_at);
    `)
  }

  claim(eventId: string): ClaimResult {
    const now = Math.floor(Date.now() / 1000)
    this.database
      .query('DELETE FROM sales_webhook_events WHERE completed_at < ?')
      .run(now - RETENTION_SECONDS)

    const inserted = this.database
      .query(
        `INSERT OR IGNORE INTO sales_webhook_events
          (event_id, status, claimed_at, completed_at)
         VALUES (?, 'processing', ?, NULL)`,
      )
      .run(eventId, now)

    if (inserted.changes === 1) {
      return 'claimed'
    }

    const existing = this.database
      .query('SELECT status, claimed_at FROM sales_webhook_events WHERE event_id = ?')
      .get(eventId) as { status: 'processing' | 'completed'; claimed_at: number } | null

    if (existing?.status === 'completed') {
      return 'completed'
    }

    if (existing && existing.claimed_at <= now - STALE_CLAIM_SECONDS) {
      const reclaimed = this.database
        .query(
          `UPDATE sales_webhook_events
             SET claimed_at = ?
           WHERE event_id = ? AND status = 'processing' AND claimed_at = ?`,
        )
        .run(now, eventId, existing.claimed_at)

      if (reclaimed.changes === 1) {
        return 'claimed'
      }
    }

    return 'in_progress'
  }

  complete(eventId: string): void {
    const completedAt = Math.floor(Date.now() / 1000)
    this.database
      .query(
        `UPDATE sales_webhook_events
            SET status = 'completed', completed_at = ?
          WHERE event_id = ? AND status = 'processing'`,
      )
      .run(completedAt, eventId)
  }

  release(eventId: string): void {
    this.database
      .query("DELETE FROM sales_webhook_events WHERE event_id = ? AND status = 'processing'")
      .run(eventId)
  }
}
