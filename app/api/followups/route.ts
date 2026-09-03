import { asc, eq, inArray } from 'drizzle-orm';
import { ensureSchema, getDb } from '@/db';
import { activities, appState, followUps, type NewFollowUp } from '@/db/schema';

export const runtime = 'edge';

const placeholderDescriptions = [
  'Get engineering answer on Acme upload failures',
  'Send revised expansion proposal to Northstar',
  'Confirm CDL expansion timeline',
  'Reply with security questionnaire timeline',
];

async function clearPlaceholderDataOnce() {
  const db = getDb();
  const [completed] = await db.select().from(appState).where(eq(appState.key, 'placeholder_cleanup_v1'));
  if (completed) return;
  const now = new Date().toISOString();
  const placeholders = await db.select({ id: followUps.id }).from(followUps).where(inArray(followUps.description, placeholderDescriptions));
  if (placeholders.length) {
    const ids = placeholders.map((item) => item.id);
    await db.delete(activities).where(inArray(activities.followUpId, ids));
    await db.delete(followUps).where(inArray(followUps.id, ids));
  }
  await db.insert(appState).values({ key: 'placeholder_cleanup_v1', value: 'completed', updatedAt: now });
}

export async function GET() {
  await ensureSchema();
  await clearPlaceholderDataOnce();
  return Response.json(await getDb().select().from(followUps).orderBy(asc(followUps.followUpAt)));
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json() as Partial<NewFollowUp>;
  if (!body.description?.trim() || !body.followUpAt) return Response.json({ error: 'Description and follow-up date are required.' }, { status: 400 });
  const now = new Date().toISOString();
  const item: NewFollowUp = {
    id: crypto.randomUUID(), description: body.description.trim(), status: body.status ?? 'MY_ACTION', accountName: body.accountName || null,
    actionOwner: body.actionOwner || 'Me', customerContact: body.customerContact || null, nextAction: body.nextAction || null,
    followUpAt: body.followUpAt, priority: body.priority ?? 'NORMAL', customerImpact: body.customerImpact ?? 'NONE', source: body.source ?? 'MANUAL',
    sourceUrl: body.sourceUrl || null, notes: body.notes || null, snoozeCount: 0, createdAt: now, updatedAt: now,
  };
  const db = getDb();
  await db.insert(followUps).values(item);
  await db.insert(activities).values({ id: crypto.randomUUID(), followUpId: item.id, type: 'CREATED', detail: `Created from ${item.source}`, createdAt: now });
  const [created] = await db.select().from(followUps).where(eq(followUps.id, item.id));
  return Response.json(created, { status: 201 });
}
