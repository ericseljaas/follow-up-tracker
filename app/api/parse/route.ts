export const runtime = 'edge';

const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function inferDate(input: string) {
  const now = new Date();
  if (/tomorrow/i.test(input)) now.setDate(now.getDate() + 1);
  else {
    const match = weekdays.findIndex((day) => new RegExp(`\\b${day}\\b`, 'i').test(input));
    if (match >= 0) { let distance = (match - now.getDay() + 7) % 7; if (distance === 0) distance = 7; now.setDate(now.getDate() + distance); }
    else if (/next week/i.test(input)) now.setDate(now.getDate() + 7);
  }
  now.setHours(9, 0, 0, 0);
  return now.toISOString();
}

function cleanName(value?: string) { return value?.replace(/\b(?:about|regarding|on|for|to)\b.*$/i, '').trim() || null; }

export async function POST(request: Request) {
  const { text, source = 'MANUAL' } = await request.json() as { text?: string; source?: string };
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
    followUpAt: inferDate(input), priority: /urgent|critical|asap|blocking|problem|issue/i.test(input) || customerImpact === 'HIGH' ? 'HIGH' : 'NORMAL',
    customerImpact, source, notes: input, confidence: waitingMatch || account ? 'high' : 'medium',
  });
}
