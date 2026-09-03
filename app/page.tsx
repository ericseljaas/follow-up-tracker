'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, Bell, CalendarClock, Check, ChevronDown, Clock3, Command,
  LoaderCircle, Mic, MoreHorizontal, Search, Send, Sparkles, UserRound, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Status = 'MY_ACTION' | 'WAITING' | 'CUSTOMER_FOLLOW_UP' | 'DONE';
type Filter = 'COCKPIT' | 'TODAY' | 'OVERDUE' | 'WAITING' | 'CUSTOMER_FOLLOW_UP' | 'UPCOMING' | 'DONE' | 'FRIDAY' | 'ALL';

type FollowUp = {
  id: string; description: string; status: Status; accountName: string | null; actionOwner: string;
  customerContact: string | null; nextAction: string | null; followUpAt: string; priority: string;
  customerImpact: string; source: string; sourceUrl: string | null; notes: string | null;
  snoozeCount: number; lastChasedAt: string | null; createdAt: string; updatedAt: string; completedAt: string | null;
};

type Draft = Omit<FollowUp, 'id' | 'snoozeCount' | 'lastChasedAt' | 'createdAt' | 'updatedAt' | 'completedAt' | 'sourceUrl'> & { confidence?: string };

const statusLabels: Record<Status, string> = { MY_ACTION: 'My action', WAITING: 'Waiting', CUSTOMER_FOLLOW_UP: 'Customer follow-up', DONE: 'Done' };

export default function Home() {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [capture, setCapture] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>('COCKPIT');
  const [message, setMessage] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ text: string; items: FollowUp[] } | null>(null);
  const [listening, setListening] = useState(false);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [greeting, setGreeting] = useState('Welcome back');
  const [todayLabel, setTodayLabel] = useState('Your daily briefing');

  async function loadItems() {
    try {
      const response = await fetch('/api/followups');
      if (!response.ok) throw new Error('Unable to load follow-ups');
      setItems(await response.json());
    } catch {
      setMessage('Your follow-ups could not be loaded. Please refresh.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    void loadItems();
    setGreeting(getGreeting());
    setTodayLabel(new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()));
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday); endToday.setDate(endToday.getDate() + 1);
  const open = items.filter((item) => item.status !== 'DONE');
  const overdue = open.filter((item) => new Date(item.followUpAt) < startToday);
  const today = open.filter((item) => new Date(item.followUpAt) >= startToday && new Date(item.followUpAt) < endToday);
  const waiting = open.filter((item) => item.status === 'WAITING');
  const customer = open.filter((item) => item.status === 'CUSTOMER_FOLLOW_UP');

  const visibleItems = useMemo(() => {
    const current = new Date();
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    const end = new Date(start); end.setDate(end.getDate() + 1);
    let list = items;
    if (filter === 'COCKPIT') list = items.filter((item) => item.status !== 'DONE' && (new Date(item.followUpAt) < end || item.priority === 'CRITICAL'));
    if (filter === 'TODAY') list = items.filter((item) => item.status !== 'DONE' && new Date(item.followUpAt) >= start && new Date(item.followUpAt) < end);
    if (filter === 'OVERDUE') list = items.filter((item) => item.status !== 'DONE' && new Date(item.followUpAt) < start);
    if (filter === 'WAITING' || filter === 'CUSTOMER_FOLLOW_UP' || filter === 'DONE') list = items.filter((item) => item.status === filter);
    if (filter === 'UPCOMING') list = items.filter((item) => item.status !== 'DONE' && new Date(item.followUpAt) >= end);
    if (filter === 'FRIDAY') list = items.filter((item) => item.status !== 'DONE' && (item.snoozeCount > 0 || Date.now() - new Date(item.updatedAt).getTime() > 7 * 86400000 || item.customerImpact === 'HIGH'));
    if (filter === 'ALL') list = items;
    return [...list].sort((a, b) => attentionScore(b) - attentionScore(a));
  }, [items, filter]);

  async function parseCapture(source = 'MANUAL') {
    if (!capture.trim()) return;
    setParsing(true);
    try {
      const response = await fetch('/api/parse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: capture, source, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
      if (!response.ok) throw new Error('Could not interpret follow-up');
      setDraft(await response.json());
    } catch { setMessage('I could not interpret that. Try a shorter phrase.'); }
    finally { setParsing(false); }
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    try {
      const response = await fetch('/api/followups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft) });
      if (!response.ok) throw new Error('Could not save follow-up');
      const created = await response.json();
      setItems((current) => [...current, created]);
      setCapture(''); setDraft(null); setMessage('Follow-up captured. I’ll keep it on your radar.');
    } catch { setMessage('That follow-up could not be saved.'); }
    finally { setSaving(false); }
  }

  async function updateItem(id: string, patch: Record<string, string | null>) {
    const response = await fetch(`/api/followups/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
    if (!response.ok) { setMessage('That change could not be saved.'); return false; }
    const updated = await response.json();
    setItems((current) => current.map((item) => item.id === id ? updated : item));
    return true;
  }

  function snooze(item: FollowUp) {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
    void updateItem(item.id, { followUpAt: tomorrow.toISOString(), action: 'SNOOZED' });
    setMessage('Snoozed until tomorrow morning.');
  }

  function advance(item: FollowUp) {
    const nextStatus = item.status === 'WAITING' && item.customerContact ? 'CUSTOMER_FOLLOW_UP' : 'DONE';
    void updateItem(item.id, { status: nextStatus });
    setMessage(nextStatus === 'DONE' ? 'Follow-up completed.' : `Ready for your update to ${item.customerContact}.`);
  }

  function startVoice() {
    type SpeechEvent = { results: { 0: { 0: { transcript: string } } }[] };
    type SpeechRecognizer = { lang: string; interimResults: boolean; onresult: (event: SpeechEvent) => void; onend: () => void; onerror: () => void; start: () => void };
    type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognizer; webkitSpeechRecognition?: new () => SpeechRecognizer };
    const BrowserRecognizer = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!BrowserRecognizer) { setMessage('Voice capture is not available in this browser.'); return; }
    const recognition = new BrowserRecognizer(); recognition.lang = 'en-US'; recognition.interimResults = false;
    recognition.onresult = (event) => { setCapture(event.results[0][0].transcript); setListening(false); };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setMessage('I could not hear that. Please try again.'); };
    setListening(true); recognition.start();
  }

  function askAssistant(prompt = question) {
    const q = prompt.trim().toLowerCase();
    let matches = open;
    let text = 'These are the open items most likely to need your attention.';
    if (q.includes('overdue')) { matches = overdue; text = `${matches.length} ${matches.length === 1 ? 'item is' : 'items are'} overdue.`; }
    else if (q.includes('customer')) { matches = open.filter((item) => item.status === 'CUSTOMER_FOLLOW_UP' || item.customerImpact === 'HIGH'); text = `${matches.length} open items have direct customer impact.`; }
    else if (q.includes('waiting') || q.includes('delegat')) { matches = waiting; text = `You are waiting on ${matches.length} open commitments.`; }
    else {
      const person = items.find((item) => q.includes(item.actionOwner.toLowerCase().split(' ')[0]));
      if (person) { matches = open.filter((item) => item.actionOwner === person.actionOwner); text = `${person.actionOwner} owns ${matches.length} open ${matches.length === 1 ? 'commitment' : 'commitments'}.`; }
      else matches = [...open].sort((a, b) => attentionScore(b) - attentionScore(a)).slice(0, 5);
    }
    setAnswer({ text, items: matches.slice(0, 5) }); setQuestion(prompt);
  }

  const title = filter === 'COCKPIT' ? 'Needs attention' : filter === 'FRIDAY' ? 'Friday review' : filter === 'ALL' ? 'All follow-ups' : filter.split('_').map(capitalize).join(' ').replace('Done', 'Completed');
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Command className="size-[18px]" strokeWidth={2.2} /></div><div><p className="text-[15px] font-semibold leading-none tracking-[-0.02em]">Follow Through</p><p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Executive cockpit</p></div></div>
          <div className="flex items-center gap-1.5"><Button variant="ghost" size="icon" aria-label="Search" onClick={() => setAssistantOpen(true)}><Search /></Button><Button variant="ghost" size="icon" aria-label="Notifications" className="relative"><Bell /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[var(--signal)] ring-2 ring-background" /></Button><div className="ml-2 hidden items-center gap-2 border-l border-border pl-4 sm:flex"><div className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold">ES</div><ChevronDown className="size-3.5 text-muted-foreground" /></div></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] grid-cols-1 gap-8 px-5 py-7 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden lg:block"><Nav filter={filter} setFilter={setFilter} counts={{ open: open.length, waiting: waiting.length, customer: customer.length }} /></aside>
        <section className="min-w-0">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden"><MobileFilter label="Cockpit" active={filter === 'COCKPIT'} onClick={() => setFilter('COCKPIT')} /><MobileFilter label={`Waiting ${waiting.length}`} active={filter === 'WAITING'} onClick={() => setFilter('WAITING')} /><MobileFilter label={`Customers ${customer.length}`} active={filter === 'CUSTOMER_FOLLOW_UP'} onClick={() => setFilter('CUSTOMER_FOLLOW_UP')} /><MobileFilter label="Upcoming" active={filter === 'UPCOMING'} onClick={() => setFilter('UPCOMING')} /></div>
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{todayLabel}</p><h1 className="text-[clamp(1.9rem,4vw,2.8rem)] font-semibold leading-none tracking-[-0.045em]">{greeting}, Eric.</h1><p className="mt-2 text-sm text-muted-foreground">{overdue.length ? `${overdue.length} overdue ${overdue.length === 1 ? 'follow-up needs' : 'follow-ups need'} your attention.` : 'You are caught up. Keep the next commitment on your radar.'}</p></div>
            <Button variant="outline" className="h-9 self-start rounded-xl px-3 shadow-xs sm:self-auto" onClick={() => setAssistantOpen(true)}><Sparkles className="text-[var(--signal)]" /> Ask your follow-ups</Button>
          </div>

          <section className="capture-panel mb-8 overflow-hidden rounded-[22px] border bg-card p-2 shadow-[0_18px_60px_-38px_rgba(17,37,34,0.5)]">
            {!draft ? <>
              <Textarea value={capture} onChange={(event) => setCapture(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void parseCapture(); }} aria-label="Add a follow-up" placeholder="Tell me what you need to remember…" className="min-h-24 resize-none border-0 bg-transparent px-4 pt-3 text-[15px] leading-relaxed shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0" />
              <div className="flex items-center justify-between gap-3 border-t border-border/70 px-2 pt-2"><div className="flex items-center gap-1.5"><Button variant={listening ? 'secondary' : 'ghost'} size="icon" className="rounded-xl" aria-label="Capture by voice" onClick={startVoice}><Mic className={listening ? 'animate-pulse text-[var(--danger)]' : ''} /></Button><span className="hidden text-xs text-muted-foreground sm:inline">{listening ? 'Listening… speak naturally.' : 'Try: “Chase Keith Tuesday about CDL expansion.”'}</span></div><Button className="h-9 rounded-xl px-4" disabled={!capture.trim() || parsing} onClick={() => void parseCapture()}>{parsing ? <><LoaderCircle className="animate-spin" /> Organizing</> : <>Organize follow-up <ArrowUpRight /></>}</Button></div>
            </> : <CaptureConfirmation draft={draft} setDraft={setDraft} onCancel={() => setDraft(null)} onSave={() => void saveDraft()} saving={saving} />}
          </section>

          <section className="mb-8 grid gap-3 sm:grid-cols-3"><Metric label="Overdue" value={String(overdue.length)} detail={overdue.some((item) => item.customerImpact === 'HIGH') ? 'Customer impact' : 'Needs attention'} tone="urgent" onClick={() => setFilter('OVERDUE')} /><Metric label="Due today" value={String(today.length)} detail={`${today.filter((item) => item.status === 'MY_ACTION').length} need your action`} tone="today" onClick={() => setFilter('TODAY')} /><Metric label="Waiting on others" value={String(waiting.length)} detail={waiting.length ? `Oldest is ${oldestDays(waiting)} days` : 'Nothing outstanding'} tone="waiting" onClick={() => setFilter('WAITING')} /></section>

          <section>
            <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2.5"><h2 className="text-lg font-semibold tracking-[-0.025em]">{title}</h2><Badge variant="secondary" className="bg-secondary text-muted-foreground">{visibleItems.length}</Badge></div>{filter !== 'ALL' && <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setFilter('ALL')}>View all</Button>}</div>
            <div className="overflow-hidden rounded-[18px] border bg-card">
              {loading ? <div className="grid min-h-40 place-items-center text-sm text-muted-foreground"><LoaderCircle className="mb-2 animate-spin" />Loading your cockpit…</div> : visibleItems.length ? visibleItems.map((item, index) => <FollowUpRow key={item.id} item={item} last={index === visibleItems.length - 1} onSnooze={() => snooze(item)} onAdvance={() => advance(item)} onEdit={() => setEditing(item)} onChase={() => { void updateItem(item.id, { action: 'CHASED' }); setMessage(`Chase recorded for ${item.actionOwner}.`); }} />) : <EmptyState filter={filter} />}
            </div>
          </section>
        </section>
      </div>

      {message && <output aria-live="polite" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background shadow-xl">{message}</output>}
      <AssistantDialog open={assistantOpen} setOpen={setAssistantOpen} question={question} setQuestion={setQuestion} answer={answer} ask={askAssistant} />
      {editing && <EditDialog key={editing.id} item={editing} onClose={() => setEditing(null)} onSave={async (patch) => { const saved = await updateItem(editing.id, patch); if (saved) { setEditing(null); setMessage('Follow-up updated.'); } }} />}
    </main>
  );
}

function Nav({ filter, setFilter, counts }: { filter: Filter; setFilter: (filter: Filter) => void; counts: { open: number; waiting: number; customer: number } }) {
  return <nav className="sticky top-24 space-y-1" aria-label="Primary navigation"><NavItem label="Cockpit" count={String(counts.open)} active={filter === 'COCKPIT'} onClick={() => setFilter('COCKPIT')} /><NavItem label="Waiting" count={String(counts.waiting)} active={filter === 'WAITING'} onClick={() => setFilter('WAITING')} /><NavItem label="Customer follow-up" count={String(counts.customer)} active={filter === 'CUSTOMER_FOLLOW_UP'} onClick={() => setFilter('CUSTOMER_FOLLOW_UP')} /><NavItem label="Upcoming" active={filter === 'UPCOMING'} onClick={() => setFilter('UPCOMING')} /><NavItem label="Completed" active={filter === 'DONE'} onClick={() => setFilter('DONE')} /><div className="my-5 border-t border-border" /><NavItem label="Friday review" active={filter === 'FRIDAY'} onClick={() => setFilter('FRIDAY')} /><NavItem label="All follow-ups" active={filter === 'ALL'} onClick={() => setFilter('ALL')} /></nav>;
}

function NavItem({ label, count, active, onClick }: { label: string; count?: string; active?: boolean; onClick: () => void }) { return <button onClick={onClick} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${active ? 'bg-secondary font-semibold text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'}`}><span>{label}</span>{count && <span className="text-xs tabular-nums">{count}</span>}</button>; }
function MobileFilter({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) { return <Button variant={active ? 'secondary' : 'outline'} size="sm" className="shrink-0 rounded-full" onClick={onClick}>{label}</Button>; }

function Metric({ label, value, detail, tone, onClick }: { label: string; value: string; detail: string; tone: string; onClick: () => void }) { return <button onClick={onClick} className="rounded-2xl border bg-card p-4 text-left transition-transform hover:-translate-y-0.5 hover:shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p><span className={`status-dot ${tone}`} /></div><div className="mt-3 flex items-baseline gap-2"><strong className="text-3xl font-semibold tracking-[-0.05em]">{value}</strong><span className="text-xs text-muted-foreground">{detail}</span></div></button>; }

function CaptureConfirmation({ draft, setDraft, onCancel, onSave, saving }: { draft: Draft; setDraft: (draft: Draft) => void; onCancel: () => void; onSave: () => void; saving: boolean }) {
  const localDate = new Date(new Date(draft.followUpAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return <div className="p-3 sm:p-4"><div className="mb-4 flex items-start justify-between"><div><div className="mb-1 flex items-center gap-2"><Sparkles className="size-4 text-[var(--signal)]" /><p className="text-sm font-semibold">Here’s what I heard</p><Badge variant="secondary">{draft.confidence ?? 'medium'} confidence</Badge></div><p className="text-xs text-muted-foreground">Review the details, then save it to your cockpit.</p></div><Button variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Cancel"><X /></Button></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Follow-up" wide><Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field><Field label="Status"><select className="field-control" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}>{Object.entries(statusLabels).filter(([value]) => value !== 'DONE').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Action owner"><Input value={draft.actionOwner} onChange={(e) => setDraft({ ...draft, actionOwner: e.target.value })} /></Field><Field label="Account"><Input value={draft.accountName ?? ''} placeholder="Optional" onChange={(e) => setDraft({ ...draft, accountName: e.target.value || null })} /></Field><Field label="Customer contact"><Input value={draft.customerContact ?? ''} placeholder="Optional" onChange={(e) => setDraft({ ...draft, customerContact: e.target.value || null })} /></Field><Field label="Next check"><Input type="datetime-local" value={localDate} onChange={(e) => setDraft({ ...draft, followUpAt: new Date(e.target.value).toISOString() })} /></Field></div><div className="mt-4 flex justify-end gap-2 border-t border-border/70 pt-3"><Button variant="ghost" onClick={onCancel}>Keep editing text</Button><Button onClick={onSave} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Check />} Save follow-up</Button></div></div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? 'sm:col-span-2' : ''}><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{label}</span>{children}</label>; }

function FollowUpRow({ item, last, onSnooze, onAdvance, onChase, onEdit }: { item: FollowUp; last: boolean; onSnooze: () => void; onAdvance: () => void; onChase: () => void; onEdit: () => void }) {
  const overdue = item.status !== 'DONE' && new Date(item.followUpAt) < new Date(new Date().setHours(0, 0, 0, 0));
  const tone = overdue ? 'urgent' : item.status === 'WAITING' ? 'waiting' : 'today';
  const Icon = overdue ? Clock3 : item.status === 'WAITING' ? UserRound : CalendarClock;
  return <article className={`group grid gap-3 p-4 transition-colors hover:bg-secondary/35 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5 ${last ? '' : 'border-b'}`}><div className={`status-icon ${tone}`}><Icon className="size-4" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className={`truncate text-sm font-semibold tracking-[-0.01em] ${item.status === 'DONE' ? 'text-muted-foreground line-through' : ''}`}>{item.description}</h3>{item.accountName && <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{item.accountName}</span>}{item.priority === 'HIGH' && <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--danger)]">High</span>}</div><div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span className="font-medium text-foreground/75">{item.actionOwner}</span><span aria-hidden="true">·</span><span className={overdue ? 'font-semibold text-[var(--danger)]' : ''}>{relativeDate(item.followUpAt)}</span>{item.notes && <><span aria-hidden="true">·</span><span className="max-w-lg truncate">{item.notes}</span></>}</div></div><div className="flex items-center gap-1 justify-self-end">{item.status === 'WAITING' && <Button variant="ghost" size="sm" className="rounded-lg" onClick={onChase}><Send /> Chased</Button>} {item.status !== 'DONE' && <><Button variant="outline" size="sm" className="rounded-lg" onClick={onSnooze}><Clock3 /> Snooze</Button><Button variant="ghost" size="icon-sm" aria-label={item.status === 'WAITING' && item.customerContact ? 'Move to customer follow-up' : 'Mark done'} onClick={onAdvance}><Check /></Button></>}<Button variant="ghost" size="icon-sm" aria-label="Edit follow-up" onClick={onEdit}><MoreHorizontal /></Button></div></article>;
}

function EditDialog({ item, onClose, onSave }: { item: FollowUp; onClose: () => void; onSave: (patch: Record<string, string | null>) => Promise<void> }) {
  const [form, setForm] = useState({ ...item });
  const [saving, setSaving] = useState(false);
  const localDate = toLocalDateTime(form.followUpAt);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true);
    await onSave({ description: form.description, status: form.status, accountName: form.accountName, actionOwner: form.actionOwner, customerContact: form.customerContact, nextAction: form.nextAction, followUpAt: form.followUpAt, priority: form.priority, customerImpact: form.customerImpact, source: form.source, sourceUrl: form.sourceUrl, notes: form.notes });
    setSaving(false);
  }
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/15 p-4 backdrop-blur-sm" role="presentation" onMouseDown={onClose}><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="edit-title" className="my-6 w-full max-w-2xl rounded-2xl bg-popover p-5 text-popover-foreground shadow-2xl ring-1 ring-foreground/10" onMouseDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-start justify-between"><div><h2 id="edit-title" className="text-lg font-semibold">Edit follow-up</h2><p className="mt-1 text-sm text-muted-foreground">Update any detail or change when this should return to your attention.</p></div><Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close"><X /></Button></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Follow-up" wide><Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field><Field label="Status"><select className="field-control" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Priority"><select className="field-control" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></Field><Field label="Action owner"><Input value={form.actionOwner} onChange={(e) => setForm({ ...form, actionOwner: e.target.value })} /></Field><Field label="Account"><Input value={form.accountName ?? ''} onChange={(e) => setForm({ ...form, accountName: e.target.value || null })} /></Field><Field label="Customer contact"><Input value={form.customerContact ?? ''} onChange={(e) => setForm({ ...form, customerContact: e.target.value || null })} /></Field><Field label="Reminder"><Input type="datetime-local" value={localDate} onChange={(e) => setForm({ ...form, followUpAt: new Date(e.target.value).toISOString() })} /></Field><Field label="Next action" wide><Input value={form.nextAction ?? ''} onChange={(e) => setForm({ ...form, nextAction: e.target.value || null })} /></Field><Field label="Notes" wide><Textarea value={form.notes ?? ''} className="min-h-24" onChange={(e) => setForm({ ...form, notes: e.target.value || null })} /></Field></div><div className="mt-5 flex justify-end gap-2 border-t pt-4"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Check />} Save changes</Button></div></form></div>;
}

function AssistantDialog({ open, setOpen, question, setQuestion, answer, ask }: { open: boolean; setOpen: (open: boolean) => void; question: string; setQuestion: (value: string) => void; answer: { text: string; items: FollowUp[] } | null; ask: (prompt?: string) => void }) {
  const prompts = ['What is overdue?', 'What customer follow-ups do I owe?', 'Show me everything Amanda owes me.'];
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/15 p-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="assistant-title" className="w-full max-w-xl rounded-2xl bg-popover p-5 text-popover-foreground shadow-2xl ring-1 ring-foreground/10" onMouseDown={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><div className="mb-3 grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="size-4" /></div><h2 id="assistant-title" className="text-lg font-semibold">Ask your follow-ups</h2><p className="mt-1 text-sm text-muted-foreground">Ask about commitments, people, customers, or what deserves attention next.</p></div><Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close assistant"><X /></Button></div><div className="mt-5 flex flex-wrap gap-2">{prompts.map((prompt) => <Button key={prompt} variant="secondary" size="sm" className="rounded-full" onClick={() => ask(prompt)}>{prompt}</Button>)}</div>{answer && <div className="mt-4 rounded-xl bg-secondary/70 p-4"><p className="text-sm font-medium">{answer.text}</p><div className="mt-3 space-y-2">{answer.items.length ? answer.items.map((item) => <div key={item.id} className="rounded-lg bg-card px-3 py-2 text-xs"><p className="font-semibold">{item.description}</p><p className="mt-0.5 text-muted-foreground">{item.actionOwner} · {relativeDate(item.followUpAt)}</p></div>) : <p className="text-xs text-muted-foreground">Nothing matches that question.</p>}</div></div>}<form onSubmit={(e) => { e.preventDefault(); ask(); }} className="mt-5 flex gap-2"><Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What should I chase before I leave?" aria-label="Ask a question" /><Button type="submit" size="icon" aria-label="Ask"><ArrowUpRight /></Button></form></section></div>;
}

function EmptyState({ filter }: { filter: Filter }) { return <div className="grid min-h-44 place-items-center p-6 text-center"><div><div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="size-5" /></div><p className="text-sm font-semibold">Nothing needs attention here</p><p className="mt-1 text-xs text-muted-foreground">{filter === 'DONE' ? 'Completed follow-ups will appear here.' : 'Your cockpit is clear for this view.'}</p></div></div>; }

function relativeDate(value: string) { const date = new Date(value); const today = new Date(); const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()); const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()); const days = Math.round((target.getTime() - start.getTime()) / 86400000); if (days < -1) return `${Math.abs(days)} days overdue`; if (days === -1) return 'Yesterday'; if (days === 0) return `Today at ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)}`; if (days === 1) return 'Tomorrow'; return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date); }
function toLocalDateTime(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function attentionScore(item: FollowUp) { if (item.status === 'DONE') return -100; const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(item.followUpAt).getTime()) / 86400000)); return daysOverdue * 10 + (item.customerImpact === 'HIGH' ? 25 : 0) + (item.priority === 'CRITICAL' ? 30 : item.priority === 'HIGH' ? 15 : 0) + item.snoozeCount * 7 + (item.status === 'CUSTOMER_FOLLOW_UP' ? 12 : 0); }
function oldestDays(items: FollowUp[]) { return Math.max(0, ...items.map((item) => Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000))); }
function capitalize(value: string) { return value.charAt(0) + value.slice(1).toLowerCase(); }
function getGreeting() { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; }
