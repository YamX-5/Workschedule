import { useState } from 'react';
import { Share, View } from 'react-native';
import { router } from 'expo-router';
import { useYami, uid } from '@/src/data/store';
import { STAT_IDS, THEME_IDS, type AppCategory, type Protocol, type Quest } from '@/src/domain/types';
import { JudgmentRules, QuestEditor } from '@/src/features/protocol';
import { ModalScreen, Field } from '@/src/ui/ModalScreen';
import { Window } from '@/src/ui/Window';
import { Button } from '@/src/ui/Button';
import { Row, Segmented } from '@/src/ui/parts';
import { T } from '@/src/ui/Text';
import { space } from '@/src/ui/tokens';
import { fmtDate, fmtMin } from '@/src/ui/format';
import { THEMES, useColors, type Theme } from '@/src/ui/theme';
import { Press } from '@/src/ui/Press';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function ProtocolScreen() {
  const colors = useColors();
  const p = useYami(s => s.profile);
  const st = useYami.getState();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'fall' | null>(null);
  const [statMsg, setStatMsg] = useState('');
  const [backup, setBackup] = useState('');
  const [backupMsg, setBackupMsg] = useState('');
  const pr = p.protocol;
  const up = (patch: Partial<Protocol>) => st.updateProtocol(patch);
  const statName = (k: (typeof STAT_IDS)[number]) => p.stats[k].name;
  const blank: Quest = { id: '', title: '', stat: 'mind', xp: 20, type: 'check', target: 1, days: [0, 1, 2, 3, 4, 5, 6], deadline: '23:00' };

  return (
    <ModalScreen title="Protocol" kana="規約" right={<Button small label="Done" onPress={() => router.back()} />}>
      <Window title="Theme" kana="テーマ" meta={THEMES[pr.theme].name}>
        <View style={{ flexDirection: 'row', gap: space.s2 }} accessibilityRole="radiogroup" accessibilityLabel="Theme">
          {THEME_IDS.map(id => <Swatch key={id} theme={THEMES[id]} on={pr.theme === id} onPress={() => up({ theme: id })} />)}
        </View>
      </Window>

      <Window title="Player" kana="プレイヤー">
        <View style={{ gap: space.s3 }}>
          <Field label="Name" value={p.name} onChangeText={name => st.setPlayer({ name })} />
          <T v="label">Title</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {p.titles.map(t => <Button key={t} small variant={p.title === t ? 'seal' : 'ghost'} label={t} onPress={() => st.setPlayer({ title: t })} />)}
          </View>
          <T style={{ fontSize: 12, color: colors.white3 }}>Achieve a Dream to unlock a new title.</T>
        </View>
      </Window>

      <Window title="Limits" kana="制限" meta="watched apps only">
        <View style={{ gap: space.s4 }}>
          <Stepper label="Daily phone cap" value={fmtMin(pr.capMin)} onMinus={() => up({ capMin: Math.max(60, pr.capMin - 15) })} onPlus={() => up({ capMin: Math.min(240, pr.capMin + 15) })} />
          <T style={{ fontSize: 13, color: colors.white3 }}>Urge delay 15s from {fmtMin(pr.capMin - 30)} · 30s from {fmtMin(pr.capMin - 15)}</T>
          <Stepper label="Necessity reserve" value={`${pr.reserveMin} min`} onMinus={() => up({ reserveMin: Math.max(0, pr.reserveMin - 5) })} onPlus={() => up({ reserveMin: Math.min(60, pr.reserveMin + 5) })} />
          <T style={{ fontSize: 13, color: colors.white3 }}>Opens after the cap, only with a stated reason. The seal lifts at Fajr, not midnight.</T>
        </View>
      </Window>

      <Window title="Night" kana="夜">
        <Row style={{ gap: space.s3 }}>
          <TimeField label="Wind-down" value={pr.windDown} onValid={windDown => up({ windDown })} />
          <TimeField label="Sleep by" value={pr.sleepTarget} onValid={sleepTarget => up({ sleepTarget })} />
          <TimeField label="Fajr alarm" value={pr.fajrAlarm} onValid={fajrAlarm => up({ fajrAlarm })} />
        </Row>
      </Window>

      <Window title="Stats" kana="能力値" meta="at least 3 on">
        <View style={{ gap: space.s3 }}>
          {STAT_IDS.map(k => (
            <Row key={k}>
              <View style={{ flex: 1 }}><Field label={k.toUpperCase()} value={p.stats[k].name} onChangeText={n => st.renameStat(k, n.toUpperCase().slice(0, 10))} /></View>
              <Button small variant={p.stats[k].enabled ? 'seal' : 'ghost'} label={p.stats[k].enabled ? 'On' : 'Off'}
                onPress={() => setStatMsg(st.toggleStat(k) ? '' : 'Keep at least 3 stats on.')} style={{ marginTop: 20 }} />
            </Row>
          ))}
          {statMsg ? <T style={{ fontSize: 12, color: colors.purpleSoft }}>{statMsg}</T> : null}
        </View>
      </Window>

      <Window title="Quests" kana="クエスト">
        <View style={{ gap: space.s2 }}>
          {p.quests.map(q => editing === q.id
            ? <QuestEditor key={q.id} quest={q} statName={statName} onCancel={() => setEditing(null)}
                onSave={nq => { st.upsertQuest(nq); setEditing(null); }} onDelete={() => { st.deleteQuest(q.id); setEditing(null); }} />
            : (
              <Row key={q.id} style={{ minHeight: 48, borderTopWidth: 1, borderTopColor: colors.line }}>
                <View style={{ flex: 1 }}>
                  <T>{q.title}</T>
                  <T style={{ fontSize: 12, color: colors.white3 }}>+{q.xp} {statName(q.stat)} · {q.type}{q.type !== 'check' ? ` ${q.target}` : ''} · by {q.deadline}</T>
                </View>
                <Button small variant="ghost" label="Edit" onPress={() => setEditing(q.id)} />
              </Row>
            ))}
          {editing === 'new'
            ? <QuestEditor quest={blank} statName={statName} onCancel={() => setEditing(null)} onSave={nq => { st.upsertQuest({ ...nq, id: uid() }); setEditing(null); }} />
            : <Button small variant="ghost" label="Add quest" onPress={() => setEditing('new')} />}
        </View>
      </Window>

      <Window title="Judgment" kana="審判">
        <View style={{ gap: space.s3 }}>
          <JudgmentRules preset={pr.preset} onChange={preset => up({ preset })} />
          <Toggle label="Never miss twice" sub="Missing the same quest 2 days in a row: −20% XP on that stat for a day" on={pr.neverMissTwice} onPress={() => up({ neverMissTwice: !pr.neverMissTwice })} />
          <Toggle label="Grace window until Fajr" sub="Late reports still earn 50% XP" on={pr.graceUntilFajr} onPress={() => up({ graceUntilFajr: !pr.graceUntilFajr })} />
          <T v="label">Remind me before a deadline</T>
          <Segmented<60 | 30 | 10> label="Reminder lead" value={pr.reminderLeadMin} onChange={reminderLeadMin => up({ reminderLeadMin })}
            options={[{ v: 60, label: '60 min' }, { v: 30, label: '30 min' }, { v: 10, label: '10 min' }]} />
        </View>
      </Window>

      <Window title="Apps" kana="アプリ">
        <View style={{ gap: space.s3 }}>
          {Object.entries(pr.apps).map(([app, cat]) => (
            <View key={app} style={{ gap: 6 }}>
              <T style={{ fontWeight: '600' }}>{app}</T>
              <Segmented<AppCategory> label={app} value={cat} onChange={c => up({ apps: { ...pr.apps, [app]: c } })}
                options={[{ v: 'watched', label: 'Watched' }, { v: 'work', label: 'Work' }, { v: 'always', label: 'Always' }]} />
              {app === 'Instagram' && <T style={{ fontSize: 12, color: colors.white3 }}>Reply to academy DMs from Meta Business Suite, a Work app. The feed stays Watched.</T>}
            </View>
          ))}
          <T style={{ fontSize: 13, color: colors.white3 }}>Work windows: {pr.workWindows.map(w => `${w.from}–${w.to}`).join(' · ')}</T>
        </View>
      </Window>

      <Window title="Prayer" kana="礼拝">
        <View style={{ gap: space.s3 }}>
          <Field label="City" value={pr.city} onChangeText={city => up({ city })} />
          <Row style={{ gap: space.s3 }}>
            <CoordField label="Latitude" value={pr.coords.lat} onValid={lat => up({ coords: { ...pr.coords, lat } })} />
            <CoordField label="Longitude" value={pr.coords.lng} onValid={lng => up({ coords: { ...pr.coords, lng } })} />
          </Row>
          <Segmented label="Calculation method" value={pr.calcMethod} onChange={calcMethod => up({ calcMethod })}
            options={[{ v: 'MuslimWorldLeague', label: 'MWL' }, { v: 'Egyptian', label: 'Egypt' }, { v: 'UmmAlQura', label: 'Umm al-Qura' }]} />
        </View>
      </Window>

      <Window title="Data" kana="記録">
        <View style={{ gap: space.s3 }}>
          <T style={{ fontSize: 13, color: colors.white3 }}>Scars: {p.scars} · Falls: {p.fallRecord.map(f => `day ${f.day} (${fmtDate(f.at)})`).join(', ') || 'none'}</T>
          <Button small variant="seal" label="Export backup" onPress={() => {
            Share.share({ message: JSON.stringify(p) }).catch(() => setBackupMsg('Sharing is not available here.'));
          }} />
          <T style={{ fontSize: 12, color: colors.white3 }}>Saves everything as text. Send it to yourself (WhatsApp, email) once a week.</T>
          <Field label="Restore from backup" value={backup} onChangeText={t => { setBackup(t); setBackupMsg(''); }} placeholder="Paste backup text" multiline />
          <Button small variant="ghost" label="Restore" disabled={!backup.trim()} onPress={() => {
            setBackupMsg(st.importProfile(backup.trim()) ? 'Restored.' : 'That is not a Yami backup. Nothing changed.');
          }} />
          {backupMsg ? <T style={{ fontSize: 12, color: colors.blue }}>{backupMsg}</T> : null}
          <Button small variant="ghost" label="Replay intro" onPress={() => router.push('/onboarding')} />
          {confirm === 'fall'
            ? <Button small variant="danger" label="Confirm: fall to day 1" onPress={() => { st.triggerFall(); setConfirm(null); }} />
            : <Button small variant="ghost" label="Simulate a Fall" onPress={() => setConfirm('fall')} />}
          {confirm === 'reset'
            ? <Button small variant="danger" label="Confirm: erase everything" onPress={() => { st.reset(); setConfirm(null); router.replace('/onboarding'); }} />
            : <Button small variant="ghost" label="Reset all data" onPress={() => setConfirm('reset')} />}
        </View>
      </Window>
    </ModalScreen>
  );
}

/** A tiny preview of a theme: its page colour with foreground, accent and deep-tone stripes. */
function Swatch({ theme, on, onPress }: { theme: Theme; on: boolean; onPress: () => void }) {
  const colors = useColors();
  const t = theme.c;
  return (
    <Press testID={`theme-${theme.id}`} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${theme.name} theme`}
      onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View style={{ alignSelf: 'stretch', height: 64, padding: 6, gap: 4, justifyContent: 'flex-end', backgroundColor: t.black, borderWidth: on ? 2 : 1, borderColor: on ? colors.blue : colors.line }}>
        <View style={{ height: 14, backgroundColor: t.purple }} />
        <View style={{ height: 4, width: '80%', backgroundColor: t.white }} />
        <View style={{ height: 4, width: '50%', backgroundColor: t.blue }} />
      </View>
      <T style={{ fontSize: 11, letterSpacing: 0.6, color: on ? colors.white : colors.white3 }} numberOfLines={1}>{theme.name}</T>
    </Press>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <Row>
      <T v="label" style={{ flex: 1 }}>{label}</T>
      <Button small variant="ghost" label="−" onPress={onMinus} style={{ width: 48 }} />
      <T v="num" style={{ minWidth: 84, textAlign: 'center' }}>{value}</T>
      <Button small variant="ghost" label="+" onPress={onPlus} style={{ width: 48 }} />
    </Row>
  );
}

function Toggle({ label, sub, on, onPress }: { label: string; sub: string; on: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Row>
      <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>{label}</T><T style={{ fontSize: 12, color: colors.white3 }}>{sub}</T></View>
      <Button small variant={on ? 'seal' : 'ghost'} label={on ? 'On' : 'Off'} onPress={onPress} />
    </Row>
  );
}

function TimeField({ label, value, onValid }: { label: string; value: string; onValid: (v: string) => void }) {
  const [v, setV] = useState(value);
  return <Field label={label} value={v} maxLength={5} error={HHMM.test(v) ? undefined : 'HH:MM'} onChangeText={t => { setV(t); if (HHMM.test(t)) onValid(t); }} />;
}

function CoordField({ label, value, onValid }: { label: string; value: number; onValid: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  return <Field label={label} value={v} keyboardType="numbers-and-punctuation" onChangeText={t => { setV(t); const n = parseFloat(t); if (!isNaN(n) && Math.abs(n) <= 180) onValid(n); }} />;
}
