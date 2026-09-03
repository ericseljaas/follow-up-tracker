import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const followUps = sqliteTable('follow_ups', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  status: text('status').notNull(),
  accountName: text('account_name'),
  actionOwner: text('action_owner').notNull(),
  customerContact: text('customer_contact'),
  nextAction: text('next_action'),
  followUpAt: text('follow_up_at').notNull(),
  priority: text('priority').notNull().default('NORMAL'),
  customerImpact: text('customer_impact').notNull().default('NONE'),
  source: text('source').notNull().default('MANUAL'),
  sourceUrl: text('source_url'),
  notes: text('notes'),
  snoozeCount: integer('snooze_count').notNull().default(0),
  lastChasedAt: text('last_chased_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  completedAt: text('completed_at'),
}, (table) => [
  index('idx_follow_ups_status_due').on(table.status, table.followUpAt),
  index('idx_follow_ups_owner').on(table.actionOwner),
]);

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(),
  followUpId: text('follow_up_id').notNull(),
  type: text('type').notNull(),
  detail: text('detail'),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_activities_follow_up').on(table.followUpId, table.createdAt)]);

export type FollowUp = typeof followUps.$inferSelect;
export type NewFollowUp = typeof followUps.$inferInsert;
