import { asc, eq } from 'drizzle-orm';
import { ensureSchema, getDb } from '@/db';
import { activities, followUps, type NewFollowUp } from '@/db/schema';

export const runtime = 'edge';

function atOffset(days: number, hour = 15) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

async function seedIfEmpty() {
  const db = getDb();
  const existing = await db.select({ id: followUps.id }).from(followUps).limit(1);
  if (existing.length) return;
  const now = new Date().toISOString();
  const seeds: NewFollowUp[] = [
    { id: crypto.randomUUID(), description: 'Get engineering answer on Acme upload failures', status: 'WAITING', accountName: 'Acme', actionOwner: 'Amanda Chen', customerContact: 'Mike', nextAction: 'Update Mike at Acme', followUpAt: atOffset(-2), priority: 'HIGH', customerImpact: 'HIGH', source: 'MEETING', notes: 'Blocking an update to Mike at Acme', createdAt: atOffset(-6), updatedAt: now },
    { id: crypto.randomUUID(), description: 'Send revised expansion proposal to Northstar', status: 'MY_ACTION', accountName: 'Northstar', actionOwner: 'Me', customerContact: 'Rachel', nextAction: 'Send revised proposal', followUpAt: atOffset(0, 16), priority: 'HIGH', customerImpact: 'HIGH', source: 'EMAIL', notes: 'Customer asked for revised terms on Monday', createdAt: atOffset(-3), updatedAt: now },
    { id: crypto.randomUUID(), description: 'Confirm CDL expansion timeline', status: 'WAITING', accountName: 'CDL', actionOwner: 'Keith Morgan', nextAction: 'Review expansion timing', followUpAt: atOffset(0, 15), priority: 'NORMAL', customerImpact: 'MEDIUM', source: 'CALL', notes: 'Waiting since yesterday’s pipeline review', createdAt: atOffset(-1), updatedAt: now },
    { id: crypto.randomUUID(), description: 'Reply with security questionnaire timeline', status: 'CUSTOMER_FOLLOW_UP', accountName: 'Summit Health', actionOwner: 'Me', customerContact: 'Priya', nextAction: 'Email Priya with the confirmed timeline', followUpAt: atOffset(1, 10), priority: 'NORMAL', customerImpact: 'MEDIUM', source: 'SLACK', createdAt: atOffset(-2), updatedAt: now },
  ];
  await db.insert(followUps).values(seeds);
}

export async function GET() {
  await ensureSchema();
  await seedIfEmpty();
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
