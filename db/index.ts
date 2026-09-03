import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb() {
  if (!env.DB) throw new Error('Database binding DB is unavailable.');
  return drizzle(env.DB, { schema });
}

export async function ensureSchema() {
  if (!env.DB) throw new Error('Database binding DB is unavailable.');
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS follow_ups (
      id TEXT PRIMARY KEY NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      account_name TEXT,
      action_owner TEXT NOT NULL,
      customer_contact TEXT,
      next_action TEXT,
      follow_up_at TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      customer_impact TEXT NOT NULL DEFAULT 'NONE',
      source TEXT NOT NULL DEFAULT 'MANUAL',
      source_url TEXT,
      notes TEXT,
      snooze_count INTEGER NOT NULL DEFAULT 0,
      last_chased_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_follow_ups_status_due ON follow_ups(status, follow_up_at)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_follow_ups_owner ON follow_ups(action_owner)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY NOT NULL,
      follow_up_id TEXT NOT NULL,
      type TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_activities_follow_up ON activities(follow_up_id, created_at)'),
  ]);
}
