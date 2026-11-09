// Dreams: a guided "New dream" wizard (one question per step), a detail view that says what moves the bar, and an edit form.
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { useYami, uid } from '@/src/data/store';
import type { Dream, StatId } from '@/src/domain/types';
import { CLEARS_PER_STEP, MAX_ACTIVE_DREAMS, activeStats, dreamProgress, milestoneBlock, statLabel } from '@/src/domain/progress';
import { MAX_MILESTONES, MAX_QUESTS } from '@/src/domain/economy';
import { ymd } from '@/src/domain/time';
import { ModalScreen, Field } from '@/src/ui/ModalScreen';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { Bar, Dots, Row, Segmented } from '@/src/ui/parts';
import { T } from '@/src/ui/Text';
import { enter } from '@/src/ui/motion';
import { font, space } from '@/src/ui/tokens';
import { fmtDate } from '@/src/ui/format';
import { useColors } from '@/src/ui/theme';
import { QuestDraftEditor, blankDraft, type Draft } from './setup';

const MIN_MILESTONES = 2;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateOk = (d: string) => !d || (DATE.test(d) && !isNaN(new Date(`${d}T12:00:00`).getTime()));

/** 'YYYY-MM-DD' n months from today. */
export function plusMonths(n: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() + n, from.getDate(), 12);
  return ymd(d);
}
const QUICK_DATES: { label: string; months: number }[] = [
  { label: '1 month', months: 1 }, { label: '3 months', months: 3 }, { label: '6 months', months: 6 }, { label: '1 year', months: 12 },
];

/** Example milestones for the dream the player typed. Plain keyword rules, then a generic ladder. */
export function milestoneExamples(title: string): string[] {
  const t = title.toLowerCase();
  const RULES: [RegExp, string[]][] = [
    [/\b(run|5k|10k|marathon|jog)/, ['Run 1 km without stopping', 'Run 3 km', 'Run the full distance']],
    [/\b(quran|hifz|memori[sz]e|juz|surah)/, ['Memorise the first page', 'Finish the first surah', 'Revise everything so far']],
    [/\b(read|book|novel)/, ['Pick the book and a daily page count', 'Reach the halfway mark', 'Finish the last chapter']],
    [/\b(save|money|pay off|debt|buy)/, ['Save the first 10%', 'Reach the halfway mark', 'Hit the full amount']],
    [/\b(lose|weight|kg|fit|gym|strong|muscle|athletic)/, ['Train 3 times in one week', 'Hit the first checkpoint', 'Hold it for a month']],
    [/\b(learn|language|course|exam|study|pass|degree)/, ['Finish the first lesson', 'Pass a practice test', 'Take the real thing']],
    [/\b(ship|launch|build|app|site|website|business|startup)/, ['Write down what version 1 is', 'Get a first working version', 'Show it to 5 people', 'Launch it']],
  ];
  const hit = RULES.find(([re]) => re.test(t));
  return hit ? hit[1] : ['The first small step', 'A real checkpoint', 'Halfway there', title.trim() ? `${title.trim()}, done` : 'The finish line'];
}

const WIZARD = ['what', 'why', 'when', 'milestones', 'quests'] as const;
type WStep = (typeof WIZARD)[number];
const QUESTION: Record<WStep, { title: string; sub: string }> = {
  what: { title: 'What do you want?', sub: 'Say the result, not the effort. Short and concrete works best.' },
  why: { title: 'Why does it matter?', sub: 'You will read this on the hard days. Then pick the stat it grows.' },
  when: { title: 'By when?', sub: 'Optional. A date lets Yami tell you if you are on pace.' },
  milestones: { title: 'Break it into milestones', sub: `${MIN_MILESTONES} to ${MAX_MILESTONES} checkpoints. You confirm them one day at a time.` },
  quests: { title: 'Which daily quests move it forward?', sub: 'Clearing a linked quest fills the bar toward the next milestone. Pick any, or add one.' },
};

export function DreamWizard() {
  const colors = useColors();
  const p = useYami(s => s.profile);
  const stats = activeStats(p);
  const [i, setI] = useState(0);
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [stat, setStat] = useState<StatId>(stats[0] ?? 'deen');
  const [due, setDue] = useState('');
  const [steps, setSteps] = useState<string[]>(['', '', '']);
  const [linked, setLinked] = useState<string[]>([]);
  const [pending, setPending] = useState<Draft[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState('');
  const step = WIZARD[i];
  const filled = steps.map(t => t.trim()).filter(Boolean);
  const examples = milestoneExamples(title);
  const roomForQuests = p.quests.length + pending.length < MAX_QUESTS;

  const create = () => {
    const d: Dream = {
      id: uid(), title: title.trim(), why: why.trim(), stat, due: due || undefined,
      milestones: filled.map(t => ({ id: uid(), title: t })), createdAt: Date.now(), active: true,
    };
    const st = useYami.getState();
    if (!st.addDream(d)) { setErr(`${MAX_ACTIVE_DREAMS} dreams are already active. Finish one first.`); return; }
    p.quests.filter(q => linked.includes(q.id)).forEach(q => st.upsertQuest({ ...q, dreamId: d.id }));
    pending.forEach(q => st.upsertQuest({ ...q, id: uid(), title: q.title.trim(), dreamId: d.id }));
    router.replace({ pathname: '/dream', params: { id: d.id } });
  };
  const next = () => {
    if (step === 'what' && !title.trim()) { setErr('Name the dream first.'); return; }
    if (step === 'when' && !dateOk(due)) { setErr('Use YYYY-MM-DD, like 2027-06-01.'); return; }
    if (step === 'milestones' && filled.length < MIN_MILESTONES) { setErr(`Add at least ${MIN_MILESTONES} milestones.`); return; }
    setErr('');
    if (i === WIZARD.length - 1) create(); else setI(i + 1);
  };

  return (
    <ModalScreen title="New dream" kana="夢">
      <Animated.View key={step} entering={enter(0)}>
        <Window title={`Step ${i + 1} of ${WIZARD.length}`} meta={<Dots n={WIZARD.length} i={i} />}>
          <T v="display" style={{ fontSize: 17, lineHeight: 26 }} testID="dw-question">{QUESTION[step].title}</T>
          <T style={{ color: colors.white2, marginTop: space.s2 }}>{QUESTION[step].sub}</T>
          <View style={{ gap: space.s3, marginTop: space.s4 }}>
            {step === 'what' && (
              <Field label="Dream" value={title} placeholder="e.g. Run a 5K" maxLength={60} autoFocus testID="dw-title"
                onChangeText={t => { setTitle(t); setErr(''); }} />
            )}
            {step === 'why' && (<>
              <Field label="Why it matters (optional)" value={why} placeholder="e.g. To keep up with my kids" multiline maxLength={140} testID="dw-why" onChangeText={setWhy} />
              <T v="label">It grows</T>
              <Segmented label="Stat" value={stat} onChange={setStat} options={stats.map(k => ({ v: k, label: statLabel(p, k).slice(0, 6) }))} />
              <T style={{ fontSize: 12, color: colors.white3 }}>Each milestone you confirm pays +100 XP to this stat.</T>
            </>)}
            {step === 'when' && (<>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}>
                {QUICK_DATES.map(q => {
                  const v = plusMonths(q.months);
                  return <Button key={q.label} small variant={due === v ? 'seal' : 'ghost'} label={q.label} testID={`dw-in-${q.months}`} onPress={() => { setDue(v); setErr(''); }} />;
                })}
                <Button small variant={!due ? 'seal' : 'ghost'} label="No date" onPress={() => { setDue(''); setErr(''); }} />
              </View>
              <Field label="Target date" value={due} placeholder="YYYY-MM-DD" maxLength={10} keyboardType="numbers-and-punctuation" testID="dw-due"
                onChangeText={t => { setDue(t); setErr(''); }} />
              {due && dateOk(due) ? <T style={{ fontSize: 13, color: colors.white2 }}>Target: {fmtDate(new Date(`${due}T12:00:00`).getTime())} {new Date(`${due}T12:00:00`).getFullYear()}</T> : null}
            </>)}
            {step === 'milestones' && (<>
              {steps.map((t, n) => (
                <Field key={n} label={`Milestone ${n + 1}`} value={t} placeholder={examples[n] ? `e.g. ${examples[n]}` : ''} maxLength={60} testID={`dw-ms-${n}`}
                  onChangeText={v => { const x = [...steps]; x[n] = v; setSteps(x); setErr(''); }} />
              ))}
              <Button small variant="ghost" label="Add a milestone" disabled={steps.length >= MAX_MILESTONES} onPress={() => setSteps([...steps, ''])} />
            </>)}
            {step === 'quests' && (<>
              {p.quests.map(q => {
                const on = linked.includes(q.id);
                return <Button key={q.id} small variant={on ? 'seal' : 'ghost'} label={on ? `✓ ${q.title}` : q.title} testID={`dw-link-${q.id}`}
                  onPress={() => setLinked(on ? linked.filter(x => x !== q.id) : [...linked, q.id])} />;
              })}
              {pending.map((q, n) => (
                <Button key={`new-${n}`} small variant="seal" label={`✓ ${q.title} (new)`} onPress={() => setPending(pending.filter((_, k) => k !== n))} />
              ))}
              {!p.quests.length && !pending.length && <T style={{ fontSize: 13, color: colors.white3 }}>You have no quests yet. Add one that moves this dream forward.</T>}
              {draft ? (
                <View style={{ gap: space.s3, padding: space.s3, borderWidth: 1, borderColor: colors.blue2 }}>
                  <QuestDraftEditor draft={draft} onChange={setDraft} stats={stats} statName={k => statLabel(p, k)} placeholder={`e.g. ${examples[0]}`} testID="dw-new-quest" />
                  <Row>
                    <Button small label="Add quest" style={{ flex: 1 }} testID="dw-add-quest" disabled={!draft.title.trim()}
                      onPress={() => { setPending([...pending, draft]); setDraft(null); }} />
                    <Button small variant="ghost" label="Cancel" onPress={() => setDraft(null)} />
                  </Row>
                </View>
              ) : roomForQuests ? (
                <Button small variant="ghost" label="New quest for this dream" testID="dw-new" onPress={() => setDraft(blankDraft(stat))} />
              ) : <T style={{ fontSize: 12, color: colors.white3 }}>You have {MAX_QUESTS} quests, the most allowed.</T>}
            </>)}
          </View>
          {err ? <T style={{ fontSize: 13, color: colors.purpleSoft, marginTop: space.s3 }} testID="dw-error">{err}</T> : null}
          <Row style={{ marginTop: space.s5, justifyContent: 'space-between' }}>
            {i > 0 ? <Button small variant="ghost" label="Back" onPress={() => { setErr(''); setI(i - 1); }} /> : <View />}
            <Button label={i === WIZARD.length - 1 ? 'Create dream' : 'Next'} testID="dw-next" onPress={next} />
          </Row>
        </Window>
      </Animated.View>
    </ModalScreen>
  );
}

/** Plain-words pace line. */
export function paceText(daysLeft: number | undefined, onPace: boolean | undefined, achieved: boolean): string {
  if (achieved) return 'Achieved.';
  if (daysLeft === undefined) return 'No target date. Add one with Edit to see your pace.';
  if (daysLeft < 0) return `${-daysLeft} days past the target date. Set a new date, or push through.`;
  const days = daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;
  return onPace ? `${days}. You are on pace.` : `${days}. You are behind pace: confirm a milestone soon to catch up.`;
}

export function DreamDetail({ dream, onEdit }: { dream: Dream; onEdit: () => void }) {
  const colors = useColors();
  const p = useYami(s => s.profile);
  const completeMilestone = useYami(s => s.completeMilestone);
  const [confirm, setConfirm] = useState<string | null>(null);
  const pr = dreamProgress(p, dream);
  const next = dream.milestones.find(m => !m.doneAt);
  const block = milestoneBlock(p, dream.id, Date.now());
  const quests = p.quests.filter(q => q.dreamId === dream.id);
  const pct = Math.round(pr.value * 100);

  return (
    <ModalScreen title="Dream" kana="夢" right={<Button small variant="ghost" label="Edit" testID="dd-edit" onPress={onEdit} />}>
      <Window>
        <T style={{ fontFamily: font.textSemi, fontSize: 20, color: colors.white }} testID="dd-title">{dream.title}</T>
        {dream.why ? <T style={{ fontSize: 13, color: colors.white3, marginTop: 4 }}>Why: {dream.why}</T> : null}
        <Row style={{ alignItems: 'baseline', marginTop: space.s4 }}>
          <T v="num" style={{ fontSize: 44, lineHeight: 52 }} testID="dd-pct">{pct}%</T>
          <T style={{ color: colors.white3 }}>{pr.done} of {pr.total} milestones</T>
        </Row>
        <Bar value={pr.value} h={10} color={colors.blue} style={{ marginTop: space.s2 }} />
        <T style={{ marginTop: space.s3, fontFamily: font.textSemi }} testID="dd-next">
          {dream.achievedAt ? `Achieved on ${fmtDate(dream.achievedAt)}.` : next ? `Next milestone: ${next.title}` : 'Every milestone is done.'}
        </T>
        <T style={{ fontSize: 13, color: pr.onPace === false ? colors.purpleSoft : colors.white2, marginTop: 4 }} testID="dd-pace">
          {paceText(pr.daysLeft, pr.onPace, !!dream.achievedAt)}
        </T>
      </Window>

      {!dream.achievedAt && (
        <Window title="What moves the bar">
          <View style={{ gap: space.s2 }}>
            <Row><T style={{ flex: 1 }}>Linked quest clears</T><T v="num" style={{ fontSize: 14 }}>{pr.clears} / {CLEARS_PER_STEP}</T></Row>
            <Bar value={pr.clears / CLEARS_PER_STEP} h={4} color={colors.blue2} />
            <T style={{ fontSize: 13, color: colors.white2 }}>
              Each clear of a linked quest fills the bar toward the next milestone, up to {CLEARS_PER_STEP} clears. Confirming the milestone completes the step.
            </T>
            {quests.length ? quests.map(q => <T key={q.id} style={{ fontSize: 14 }}>· {q.title}</T>) : (<>
              <T style={{ fontSize: 13, color: colors.white3 }}>No quests linked yet, so your days don’t count toward it.</T>
              <Button small variant="ghost" label="Link quests" onPress={onEdit} />
            </>)}
          </View>
        </Window>
      )}

      <Window title="Milestones" meta={`${pr.done} / ${pr.total}`}>
        <View style={{ gap: space.s2 }}>
          {!dream.achievedAt && (
            <T style={{ fontSize: 12, color: colors.white3 }} testID="dd-rule">
              One milestone a day, starting the day after you made the dream. Each pays +100 XP to {statLabel(p, dream.stat)} and +20 Shards; the last one +100 Shards and a title.
            </T>
          )}
          {block && !dream.achievedAt ? <T style={{ fontSize: 13, color: colors.purpleSoft }} testID="dd-block">{block}</T> : null}
          {dream.milestones.map(m => {
            const isNext = m.id === next?.id;
            return (
              <Row key={m.id} style={{ minHeight: 48, borderTopWidth: 1, borderTopColor: colors.line }}>
                <View style={{ width: 12, height: 12, backgroundColor: m.doneAt ? colors.blue : 'transparent', borderWidth: 1, borderColor: isNext ? colors.blue : colors.blue2 }} />
                <T style={{ flex: 1, color: m.doneAt ? colors.white3 : colors.white, fontFamily: isNext ? font.textSemi : font.text }}>{m.title}</T>
                {m.doneAt ? <T style={{ fontSize: 12, color: colors.blue }}>{fmtDate(m.doneAt)}</T>
                  : confirm === m.id ? <Button small variant="seal" label="Confirm" testID={`dd-confirm-${m.id}`} onPress={() => { completeMilestone(dream.id, m.id); setConfirm(null); }} />
                  : <Button small variant="ghost" label="Done" disabled={!!block} testID={`dd-done-${m.id}`} onPress={() => setConfirm(m.id)} />}
              </Row>
            );
          })}
        </View>
      </Window>
    </ModalScreen>
  );
}

export function DreamEdit({ dream, onDone }: { dream: Dream; onDone: () => void }) {
  const colors = useColors();
  const p = useYami(s => s.profile);
  const { updateDream, upsertQuest } = useYami.getState();
  const stats = activeStats(p);
  const [title, setTitle] = useState(dream.title);
  const [why, setWhy] = useState(dream.why);
  const [due, setDue] = useState(dream.due ?? '');
  const [stat, setStat] = useState<StatId>(dream.stat);
  const [steps, setSteps] = useState<string[]>([]);
  const [linked, setLinked] = useState<string[]>(p.quests.filter(q => q.dreamId === dream.id).map(q => q.id));
  const [err, setErr] = useState('');

  const save = () => {
    if (!title.trim()) { setErr('Name the dream'); return; }
    if (!dateOk(due)) return;
    const added = steps.map(t => t.trim()).filter(Boolean).map(t => ({ id: uid(), title: t }));
    updateDream({ ...dream, title: title.trim(), why: why.trim(), stat, due: due || undefined, milestones: [...dream.milestones, ...added] });
    p.quests.forEach(q => {
      const want = linked.includes(q.id);
      if (want && q.dreamId !== dream.id) upsertQuest({ ...q, dreamId: dream.id });
      if (!want && q.dreamId === dream.id) upsertQuest({ ...q, dreamId: undefined });
    });
    onDone();
  };

  return (
    <ModalScreen title="Edit dream" kana="夢" right={<Row><Button small variant="ghost" label="Cancel" onPress={onDone} /><Button small label="Save" testID="de-save" onPress={save} /></Row>}>
      <Window title="The dream">
        <View style={{ gap: space.s3 }}>
          <Field label="Dream" value={title} onChangeText={t => { setTitle(t); setErr(''); }} error={err || undefined} />
          <Field label="Why it matters" value={why} onChangeText={setWhy} multiline />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}>
            {QUICK_DATES.map(q => <Button key={q.label} small variant="ghost" label={q.label} onPress={() => setDue(plusMonths(q.months))} />)}
          </View>
          <Field label="Target date (optional)" value={due} onChangeText={setDue} placeholder="YYYY-MM-DD" maxLength={10}
            keyboardType="numbers-and-punctuation" error={dateOk(due) ? undefined : 'Use YYYY-MM-DD, like 2027-06-01'} />
          <T v="label">It grows</T>
          <Segmented label="Stat" value={stat} onChange={setStat} options={[...new Set([...stats, dream.stat])].map(k => ({ v: k, label: statLabel(p, k).slice(0, 6) }))} />
        </View>
      </Window>
      <Window title="Add milestones" meta={`${dream.milestones.length + steps.length} / ${MAX_MILESTONES}`}>
        <View style={{ gap: space.s2 }}>
          {steps.map((t, n) => (
            <Field key={n} label={`Milestone ${dream.milestones.length + n + 1}`} value={t} onChangeText={v => { const x = [...steps]; x[n] = v; setSteps(x); }} />
          ))}
          <Button small variant="ghost" label="Add a milestone" disabled={dream.milestones.length + steps.length >= MAX_MILESTONES} onPress={() => setSteps([...steps, ''])} />
        </View>
      </Window>
      <Window title="Daily quests toward it">
        <View style={{ gap: space.s2 }}>
          {p.quests.map(q => {
            const on = linked.includes(q.id);
            return <Button key={q.id} small variant={on ? 'seal' : 'ghost'} label={on ? `✓ ${q.title}` : q.title} onPress={() => setLinked(on ? linked.filter(x => x !== q.id) : [...linked, q.id])} />;
          })}
          {!p.quests.length && <T style={{ fontSize: 13, color: colors.white3 }}>No quests yet. Add them in Protocol.</T>}
        </View>
      </Window>
    </ModalScreen>
  );
}
