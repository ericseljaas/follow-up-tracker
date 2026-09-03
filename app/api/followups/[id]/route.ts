import { eq } from 'drizzle-orm';
import { ensureSchema, getDb } from '@/db';
import { activities, followUps, type NewFollowUp } from '@/db/schema';

export const runtime = 'edge';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await context.params;
  const body = await request.json() as Partial<NewFollowUp> & { action?: string };
  const now = new Date().toISOString();
  const db = getDb();
  const [current] = await db.select().from(followUps).where(eq(followUps.id, id));
  if (!current) return Response.json({ error: 'Follow-up not found.' }, { status: 404 });
  const changes: Partial<typeof followUps.$inferInsert> = { updatedAt: now };
  if ('description' in body) {
    if (!body.description?.trim()) return Response.json({ error: 'Description is required.' }, { status: 400 });
    changes.description = body.description.trim();
  }
  if (body.status) { changes.status = body.status; changes.completedAt = body.status === 'DONE' ? now : null; }
  if (body.followUpAt) {
    changes.followUpAt = body.followUpAt;
    if (body.action === 'SNOOZED') changes.snoozeCount = current.snoozeCount + 1;
  }
  const editableFields = ['accountName', 'actionOwner', 'customerContact', 'nextAction', 'priority', 'customerImpact', 'source', 'sourceUrl', 'notes'] as const;
  for (const field of editableFields) {
    if (field in body) changes[field] = body[field] ?? null;
  }
  if (body.action === 'CHASED') changes.lastChasedAt = now;
  await db.update(followUps).set(changes).where(eq(followUps.id, id));
  await db.insert(activities).values({ id: crypto.randomUUID(), followUpId: id, type: body.action ?? (body.status ? 'STATUS_CHANGED' : 'EDITED'), detail: body.action ? null : 'Entry details updated', createdAt: now });
  const [updated] = await db.select().from(followUps).where(eq(followUps.id, id));
  return Response.json(updated);
}
