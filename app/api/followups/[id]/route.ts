import { eq } from 'drizzle-orm';
import { ensureSchema, getDb } from '@/db';
import { activities, followUps } from '@/db/schema';

export const runtime = 'edge';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await context.params;
  const body = await request.json() as { status?: string; followUpAt?: string; action?: string };
  const now = new Date().toISOString();
  const db = getDb();
  const [current] = await db.select().from(followUps).where(eq(followUps.id, id));
  if (!current) return Response.json({ error: 'Follow-up not found.' }, { status: 404 });
  const changes: Partial<typeof followUps.$inferInsert> = { updatedAt: now };
  if (body.status) { changes.status = body.status; changes.completedAt = body.status === 'DONE' ? now : null; }
  if (body.followUpAt) { changes.followUpAt = body.followUpAt; changes.snoozeCount = current.snoozeCount + 1; }
  if (body.action === 'CHASED') changes.lastChasedAt = now;
  await db.update(followUps).set(changes).where(eq(followUps.id, id));
  await db.insert(activities).values({ id: crypto.randomUUID(), followUpId: id, type: body.action ?? (body.status ? 'STATUS_CHANGED' : 'UPDATED'), detail: body.status ?? body.followUpAt ?? null, createdAt: now });
  const [updated] = await db.select().from(followUps).where(eq(followUps.id, id));
  return Response.json(updated);
}
