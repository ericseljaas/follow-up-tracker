export const runtime = 'edge';

const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function zonedDateTimeToIso(date: Date, hour: number, minute: number, timeZone: string) {
  const tentative = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(tentative);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
  return new Date(tentative.getTime() - (represented - tentative.getTime())).toISOString();
}

function inferDate(input: string, timeZone: string) {
  const localParts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(localParts.year), Number(localParts.month) - 1, Number(localParts.day)));
  if (/tomorrow/i.test(input)) date.setUTCDate(date.getUTCDate() + 1);
  else {
    const match = weekdays.findIndex((day) => new RegExp(`\\b${day}\\b`, 'i').test(input));
    if (match >= 0) { let distance = (match - date.getUTCDay() + 7) % 7; if (distance === 0) distance = 7; date.setUTCDate(date.getUTCDate() + distance); }
    else if (/next week/i.test(input)) date.setUTCDate(date.getUTCDate() + 7);
    else date.setUTCDate(date.getUTCDate() + 5);
  }
  const timeMatch = input.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  let hour = timeMatch ? Number(timeMatch[1]) % 12 : 9;
  if (timeMatch?.[3].toLowerCase() === 'pm') hour += 12;
  const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0;
  return zonedDateTimeToIso(date, hour, minute, timeZone);
}

function cleanName(value?: string) { return value?.replace(/\b(?:about|regarding|on|for|to)\b.*$/i, '').trim() || null; }

export async function POST(request: Request) {
  const { text, source = 'MANUAL', timeZone = 'America/Denver' } = await request.json() as { text?: string; source?: string; timeZone?: string };
  if (!text?.trim()) return Response.json({ error: 'Tell me what you want to follow up on.' }, { status: 400 });
  const input = text.trim();
  const waitingMatch = input.match(/(?:I asked|waiting (?:for|on)|chase|check with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  const customerMatch = input.match(/(?:at|for|about(?: the)?|customer)\s+([A-Z][A-Za-z0-9&.-]+)(?:\s+(?:upload|account|expansion|issue|problem))?/i);
  const contactMatch = input.match(/(?:update|reply to|email|tell)\s+([A-Z][a-z]+)(?:\s+at\s+([A-Z][A-Za-z0-9&.-]+))?/);
  const waiting = Boolean(waitingMatch) || /delegat|she said|he said|they said|owe me|waiting/i.test(input);
  const account = (contactMatch?.[2] ?? customerMatch?.[1] ?? null)?.replace(/[.,;:]$/, '') ?? null;
  const topic = input.replace(/^add (?:a )?follow[- ]?up:?\s*/i, '').replace(/^remind me (?:to )?/i, '').split(/\.\s+|\bremind me\b|\bonce I\b/i)[0].trim();
  const customerImpact = /customer|client|update|reply|respond|proposal|problem|issue/i.test(input) ? 'HIGH' : account ? 'MEDIUM' : 'NONE';
  return Response.json({
    description: topic.charAt(0).toUpperCase() + topic.slice(1), status: waiting ? 'WAITING' : 'MY_ACTION', accountName: account,
    actionOwner: cleanName(waitingMatch?.[1]) ?? 'Me', customerContact: contactMatch?.[1] ?? null,
    nextAction: contactMatch ? `${contactMatch[0].charAt(0).toUpperCase()}${contactMatch[0].slice(1)}`.replace(/[.,;:]$/, '') : topic,
    followUpAt: inferDate(input, timeZone), priority: /urgent|critical|asap|blocking|problem|issue/i.test(input) || customerImpact === 'HIGH' ? 'HIGH' : 'NORMAL',
    customerImpact, source, notes: input, confidence: waitingMatch || account ? 'high' : 'medium',
  });
}
