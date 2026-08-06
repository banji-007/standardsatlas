import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { StdData, RelData } from './MainIsland';
import '../../styles/mobile.css';

// --- Types ---
type MobileDoc = StdData['documents'][number];
type MobileVer = StdData['versions'][number];

export interface MobileStdData extends StdData {
  short: string;
  family: string;
}

export interface MobileFaq {
  number: number;
  title: string;
  updated: string | null;
  standards: string[];
  mapping_method: 'direct' | 'disambiguated' | 'inferred' | 'general' | 'excluded';
  source_url: string;
}

export interface MobileAppData {
  standards: MobileStdData[];
  relationships: RelData[];
  faqs: MobileFaq[];
  lastVerified: string;
}

type TabKey = 'today' | 'catalog' | 'map' | 'timeline' | 'faq';

interface State {
  tab: TabKey;
  query: string;
  status: string;
  sort: 'name' | 'status' | 'recent' | 'docs';
  selected: string | null;
  snap: 'half' | 'full';
  focus: string;
  trail: string[];
  tlDocs: boolean;
  tlFamily: string;
  tlStandard: string | null;
  tlOpen: string[];
  faqQuery: string;
  faqScope: string;
  faqLimit: number;
  docsOpen: string[] | null;
  fwOpen: boolean;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: Error) { return { err: e.message }; }
  render() {
    if (this.state.err) return (
      <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 9999, padding: 40, fontFamily: 'monospace', fontSize: 14, color: '#c00', whiteSpace: 'pre-wrap', overflowY: 'auto' }}>
        <b>React render error:</b>{'\n'}{this.state.err}
      </div>
    );
    return this.props.children;
  }
}

// --- Palette ---
// Status colors reuse the shared tokens (src/styles/tokens.css) directly.
// Document/relationship/event tag colors have no equivalent shared token
// (same situation as MainIsland.tsx's own local DT map), so they're kept
// local here, ported from the design's light theme.
const SM: Record<string, { label: string; c: string; bg: string; dot: string }> = {
  'active':           { label: 'Active',           c: 'var(--color-active)',           bg: 'var(--color-active-bg)',           dot: 'var(--color-active-dot)' },
  'under-review':     { label: 'Under review',     c: 'var(--color-under-review)',     bg: 'var(--color-under-review-bg)',     dot: 'var(--color-under-review-dot)' },
  'sunset-scheduled': { label: 'Sunset scheduled', c: 'var(--color-sunset-scheduled)', bg: 'var(--color-sunset-scheduled-bg)', dot: 'var(--color-sunset-scheduled-dot)' },
  'retired':          { label: 'Retired',          c: 'var(--color-retired)',          bg: 'var(--color-retired-bg)',          dot: 'var(--color-retired-dot)' },
  'forthcoming':      { label: 'Forthcoming',      c: 'var(--color-forthcoming)',      bg: 'var(--color-forthcoming-bg)',      dot: 'var(--color-forthcoming-dot)' },
};

const DT: Record<string, { label: string; order: number; c: string; bg: string }> = {
  'standard':       { label: 'Standard',       order: 0, c: '#1f5f5b', bg: '#e6f0ef' },
  'guidance':       { label: 'Guidance',       order: 1, c: '#3a4f9e', bg: '#e9ecfb' },
  'faq':            { label: 'FAQ',            order: 2, c: '#7a4f8e', bg: '#f1ebf4' },
  'saq':            { label: 'SAQ',            order: 3, c: '#8a6512', bg: '#f6ecd8' },
  'template':       { label: 'Template',       order: 4, c: '#6b6760', bg: '#ece9e3' },
  'supplemental':   { label: 'Supplemental',   order: 5, c: '#6b6760', bg: '#ece9e3' },
  'bulletin':       { label: 'Bulletin',       order: 6, c: '#9a6512', bg: '#fbf0db' },
  'report':         { label: 'Report',         order: 7, c: '#6b6760', bg: '#ece9e3' },
  'program-guide':  { label: 'Program guide',  order: 8, c: '#3a4f9e', bg: '#e9ecfb' },
};

const RT: Record<string, { label: string; c: string; bg: string }> = {
  converge:  { label: 'Converge',  c: '#b5562f', bg: '#f7e7df' },
  supersede: { label: 'Supersede', c: '#6b6760', bg: '#ece9e3' },
  associate: { label: 'Associate', c: '#3a4f9e', bg: '#e9ecfb' },
};

const RS: Record<string, { label: string; c: string; bg: string }> = {
  planned:       { label: 'Planned',      c: '#8a8377', bg: '#efe9dd' },
  'in-progress': { label: 'In progress',  c: '#9a6512', bg: '#fbf0db' },
  complete:      { label: 'Complete',     c: '#1f7a4d', bg: '#e7f3ec' },
};

const EV: Record<string, { c: string; bg: string }> = {
  'New version':   { c: '#1f5f5b', bg: '#e6f0ef' },
  'New FAQ':       { c: '#7a4f8e', bg: '#f1ebf4' },
  'New guidance':  { c: '#3a4f9e', bg: '#e9ecfb' },
  'New bulletin':  { c: '#9a6512', bg: '#fbf0db' },
  'Sunset':        { c: '#9a6512', bg: '#fbf0db' },
  'Convergence':   { c: '#b5562f', bg: '#f7e7df' },
  'Superseded':    { c: '#6b6760', bg: '#ece9e3' },
  'Alignment':     { c: '#3a4f9e', bg: '#e9ecfb' },
  'Under review':  { c: '#3a4f9e', bg: '#e9ecfb' },
};

const ACCENT = 'var(--pcia-accent)';
const INK = 'var(--pcia-ink)';
const INK2 = 'var(--pcia-ink2)';
const INK3 = 'var(--pcia-ink3)';
const INK4 = 'var(--pcia-ink4)';
const LINE = 'var(--pcia-line)';
const LINE2 = 'var(--pcia-line2)';
const SURFACE = 'var(--pcia-surface)';
const SURFACE2 = 'var(--pcia-surface2)';
const ACCENT_SOFT = 'var(--pcia-accent-soft)';
const ON_ACCENT = 'var(--pcia-on-accent)';
const BG = 'var(--pcia-bg)';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// --- Utilities ---
function nowMonth(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function fmt(d: string | null | undefined): string {
  if (!d) return 'TBD';
  const p = String(d).split('-');
  return MONTHS[(+p[1] || 1) - 1] + ' ' + p[0];
}
function monthsAway(d: string, now: string): number {
  const [ny, nm] = now.split('-').map(Number);
  const p = String(d).split('-');
  return ((+p[0]) - ny) * 12 + ((+p[1] || 1) - nm);
}
function rel(d: string, now: string): string {
  const ma = monthsAway(d, now);
  if (ma === 0) return 'this month';
  if (ma > 0) return ma >= 12 ? ('in ' + Math.round(ma / 12 * 10) / 10 + ' yr') : ('in ' + ma + ' mo');
  const a = Math.abs(ma);
  return a >= 12 ? (Math.round(a / 12 * 10) / 10 + ' yr ago') : (a + ' mo ago');
}
function sentence(t: string | undefined): string {
  if (!t) return '';
  const m = t.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : t).trim();
}
function clean(t: string | null | undefined): string {
  return String(t || '').replace(/\s*™/g, '').trim();
}
function abbrev(s: string | undefined): string {
  const w = String(s || '').replace(/PCI\s*/, '').split(/\s+/);
  return w.length > 1 ? w.map(x => x[0]).join('').slice(0, 4).toUpperCase() : String(s).slice(0, 4).toUpperCase();
}
function atlasOrder(std: MobileStdData[]): string[] {
  const fams: string[] = [];
  std.forEach(s => { if (fams.indexOf(s.family) < 0) fams.push(s.family); });
  fams.sort();
  const out: string[] = [];
  fams.forEach(f => std.filter(s => s.family === f).sort((a, b) => a.short.localeCompare(b.short)).forEach(s => out.push(s.slug)));
  return out;
}

function chip(active: boolean, c?: string | null, bg?: string | null): React.CSSProperties {
  return {
    padding: '7px 13px', borderRadius: 20, border: '1px solid ' + (active ? (c || ACCENT) : LINE),
    background: active ? (bg || ACCENT_SOFT) : SURFACE, color: active ? (c || ACCENT) : INK2,
    fontSize: 12.5, fontWeight: active ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none',
    transition: 'all .12s', minHeight: 44, display: 'inline-flex', alignItems: 'center',
  };
}

function readInitialState(standards: MobileStdData[]): State {
  let tab: TabKey = 'today';
  let selected: string | null = null;
  let focus = standards[0]?.slug || '';
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t === 'standards') tab = 'catalog';
    else if (t === 'map' || t === 'timeline' || t === 'faq' || t === 'faqs') tab = t === 'faqs' ? 'faq' : t;
    else if (t === 'today') tab = 'today';
    const open = params.get('open');
    if (open && standards.some(s => s.slug === open)) {
      selected = open;
      focus = open;
    }
  }
  return {
    tab, query: '', status: 'All', sort: 'name', selected, snap: 'half',
    focus, trail: [focus], tlDocs: false, tlFamily: 'All', tlStandard: null, tlOpen: [],
    faqQuery: '', faqScope: 'All', faqLimit: 25, docsOpen: null, fwOpen: false,
  };
}

export default function MobileApp({ data }: { data: MobileAppData }) {
  const std = data.standards;
  const rels = data.relationships;
  const faqs = data.faqs;
  const [state, setState] = useState<State>(() => readInitialState(std));
  const patch = useCallback((p: Partial<State>) => setState(s => ({ ...s, ...p })), []);
  const NOW = nowMonth();

  // ---- escape closes whichever sheet is open ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (state.selected) patch({ selected: null, snap: 'half' });
      else if (state.fwOpen) patch({ fwOpen: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.selected, state.fwOpen, patch]);

  if (!std.length) return <div style={{ padding: 24, fontFamily: 'monospace' }}>No data.</div>;

  const shortOf = (slug: string) => (std.find(x => x.slug === slug) || { short: slug }).short;

  // ---- stats ----
  const statTotal = std.length;
  const statActive = std.filter(s => s.status === 'active').length;
  const statSunset = std.filter(s => s.status === 'sunset-scheduled' || s.status === 'under-review').length;
  const statDocs = std.reduce((a, s) => a + (s.documents ? s.documents.length : 0), 0);
  const verifiedLine = 'Independent · verified ' + fmt(data.lastVerified || NOW);

  // ---- today feed ----
  interface FeedEvent { slug: string; short: string; type: string; date: string; note: string }
  const events: FeedEvent[] = [];
  std.forEach(s => {
    (s.versions || []).forEach((v: MobileVer) => {
      if (v.published) events.push({ slug: s.slug, short: s.short, type: 'New version', date: v.published, note: 'Version ' + v.version + ' published.' });
      if (v.retired && v.status === 'sunset-scheduled') events.push({ slug: s.slug, short: s.short, type: 'Sunset', date: v.retired, note: 'v' + v.version + ' scheduled to sunset.' });
    });
    if (s.status === 'under-review') events.push({ slug: s.slug, short: s.short, type: 'Under review', date: s.last_verified || data.lastVerified, note: 'Standard under active development and review.' });
    const docs = (s.documents || []).filter((d: MobileDoc) => d.published).slice().sort((a, b) => (b.published as string).localeCompare(a.published as string));
    const nd = docs[0];
    if (nd && nd.published && nd.published >= '2025-06') {
      const t = nd.type === 'faq' ? 'New FAQ' : nd.type === 'guidance' ? 'New guidance' : nd.type === 'bulletin' ? 'New bulletin' : null;
      if (t) events.push({ slug: s.slug, short: s.short, type: t, date: nd.published, note: clean(nd.title).replace(/\s*\(.*?\)\s*/g, ' ').trim() + '.' });
    }
  });
  rels.forEach(r => {
    if (!r.effective_date) return;
    const t = r.type === 'converge' ? 'Convergence' : r.type === 'supersede' ? 'Superseded' : 'Alignment';
    events.push({ slug: r.from, short: shortOf(r.from), type: t, date: r.effective_date, note: r.description ? (r.description.split(/;|\.\s/)[0] + '.') : '' });
  });
  const feedCutoff = (() => { const [y, m] = NOW.split('-').map(Number); const d2 = new Date(y, m - 1 - 24, 1); return d2.getFullYear() + '-' + String(d2.getMonth() + 1).padStart(2, '0'); })();
  const seen = new Set<string>();
  const feed = events.filter(e => e.date >= feedCutoff).sort((a, b) => b.date.localeCompare(a.date))
    .filter(e => { const k = e.slug + e.type + e.date; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 14);
  const mkFeed = (e: FeedEvent) => {
    const m = EV[e.type] || { c: INK2, bg: SURFACE2 };
    const up = monthsAway(e.date, NOW) > 0;
    const note = e.note && e.note.length > 112 ? e.note.slice(0, 110).trim() + '…' : e.note;
    return { ...e, note, dateLabel: fmt(e.date), relLabel: rel(e.date, NOW), up, m };
  };
  const feedFuture = feed.filter(e => monthsAway(e.date, NOW) > 0).sort((a, b) => a.date.localeCompare(b.date)).map(mkFeed);
  const feedPast = feed.filter(e => monthsAway(e.date, NOW) <= 0).map(mkFeed);

  // ---- catalog ----
  const present: string[] = [];
  (['active', 'sunset-scheduled', 'under-review', 'retired', 'forthcoming'] as const).forEach(k => { if (std.some(s => s.status === k)) present.push(k); });
  const latestPub = (s: MobileStdData) => (s.versions || []).map((v: MobileVer) => v.published).filter(Boolean).sort().slice(-1)[0] || s.last_verified || '';
  const relCountOf = (slug: string) => rels.filter(r => r.from === slug || (Array.isArray(r.to) ? r.to.includes(slug) : r.to === slug)).length;
  const faqCountOf = (slug: string) => faqs.filter(f => f.standards && f.standards.indexOf(slug) >= 0).length;
  const q = (state.query || '').toLowerCase().trim();
  let catalogList = std.filter(s => {
    if (q) { const h = (s.name + ' ' + s.short + ' ' + s.family + ' ' + (s.notes || '')).toLowerCase(); if (h.indexOf(q) < 0) return false; }
    if (state.status !== 'All' && s.status !== state.status) return false;
    return true;
  });
  const order: Record<string, number> = { active: 0, 'sunset-scheduled': 1, 'under-review': 2, forthcoming: 3, retired: 4 };
  if (state.sort === 'name') catalogList = catalogList.slice().sort((a, b) => a.short.localeCompare(b.short));
  else if (state.sort === 'status') catalogList = catalogList.slice().sort((a, b) => (order[a.status] - order[b.status]) || a.short.localeCompare(b.short));
  else if (state.sort === 'recent') catalogList = catalogList.slice().sort((a, b) => String(latestPub(b)).localeCompare(String(latestPub(a))));
  else if (state.sort === 'docs') catalogList = catalogList.slice().sort((a, b) => b.documents.length - a.documents.length);
  const resultLabel = catalogList.length === std.length ? (std.length + ' standards · ' + statDocs + ' docs') : (catalogList.length + ' of ' + std.length + ' standards');

  return (
    <ErrorBoundary>
      <MobileShell
        data={data} std={std} rels={rels} faqs={faqs} state={state} patch={patch} NOW={NOW}
        stats={{ statTotal, statActive, statSunset, statDocs, verifiedLine }}
        feedFuture={feedFuture} feedPast={feedPast}
        catalogList={catalogList} present={present} resultLabel={resultLabel} faqCountOf={faqCountOf} relCountOf={relCountOf}
        shortOf={shortOf}
      />
    </ErrorBoundary>
  );
}

interface FeedCard { slug: string; short: string; type: string; date: string; note: string; dateLabel: string; relLabel: string; up: boolean; m: { c: string; bg: string } }

// ============================================================================
// Shell: header, tab bar, sheets, per-tab bodies
// ============================================================================
function MobileShell(props: {
  data: MobileAppData; std: MobileStdData[]; rels: RelData[]; faqs: MobileFaq[];
  state: State; patch: (p: Partial<State>) => void; NOW: string;
  stats: { statTotal: number; statActive: number; statSunset: number; statDocs: number; verifiedLine: string };
  feedFuture: FeedCard[]; feedPast: FeedCard[];
  catalogList: MobileStdData[]; present: string[]; resultLabel: string;
  faqCountOf: (slug: string) => number; relCountOf: (slug: string) => number;
  shortOf: (slug: string) => string;
}) {
  const { std, rels, faqs, state, patch, NOW, stats, feedFuture, feedPast, catalogList, present, resultLabel, faqCountOf, relCountOf, shortOf } = props;
  const select = (slug: string) => patch({ selected: slug, snap: 'half' });
  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [state.tab]);

  const shellStyle: React.CSSProperties = {
    position: 'relative', width: '100%', maxWidth: 430, margin: '0 auto',
    borderLeft: '1px solid ' + LINE, borderRight: '1px solid ' + LINE,
    height: '100dvh', minHeight: '100dvh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', background: BG, color: INK,
  };
  const headerStyle: React.CSSProperties = { flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 10px', background: BG, borderBottom: '1px solid ' + LINE };
  const mainStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', position: 'relative' };
  const tabBarStyle: React.CSSProperties = { flex: 'none', display: 'flex', alignItems: 'stretch', gap: 2, padding: '2px 4px', background: SURFACE, borderTop: '1px solid ' + LINE };

  return (
    <div className="pcia-mobile" style={shellStyle}>
      <header className="pcia-mobile-header" style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.4px solid rgba(251,247,238,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: ON_ACCENT }} />
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, letterSpacing: '-.01em', whiteSpace: 'nowrap', flex: 'none' }}>Security Standards Map</span>
        </div>
        <button onClick={() => patch({ fwOpen: true })} style={{ marginLeft: 'auto', flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, border: '1px solid ' + ACCENT, background: ACCENT, color: ON_ACCENT, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <span>PCI DSS</span>
          <span style={{ fontSize: 8, opacity: 0.75 }}>&#9662;</span>
        </button>
      </header>

      <main ref={mainRef} style={mainStyle}>
        {state.tab === 'today' && (
          <TodayTab stats={stats} feedFuture={feedFuture} feedPast={feedPast} onSelect={select} NOW={NOW} />
        )}
        {state.tab === 'catalog' && (
          <StandardsTab std={std} catalogList={catalogList} present={present} resultLabel={resultLabel}
            statDocs={stats.statDocs} faqCountOf={faqCountOf} relCountOf={relCountOf}
            state={state} patch={patch} onSelect={select} />
        )}
        {state.tab === 'map' && (
          <MapTab std={std} rels={rels} state={state} patch={patch} onSelect={select} shortOf={shortOf} />
        )}
        {state.tab === 'timeline' && (
          <TimelineTab std={std} rels={rels} state={state} patch={patch} onSelect={select} shortOf={shortOf} NOW={NOW} />
        )}
        {state.tab === 'faq' && (
          <FaqsTab faqs={faqs} state={state} patch={patch} shortOf={shortOf} />
        )}
      </main>

      <nav className="pcia-mobile-tabbar" style={tabBarStyle}>
        <TabButton active={state.tab === 'today'} label="Today" onClick={() => patch({ tab: 'today' })}>
          <div style={{ width: 17, height: 17, borderRadius: '50%', border: '1.6px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 5.5, height: 5.5, borderRadius: '50%', background: 'currentColor' }} />
          </div>
        </TabButton>
        <TabButton active={state.tab === 'catalog'} label="Standards" onClick={() => patch({ tab: 'catalog' })}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', width: 17 }}>
            <div style={{ width: 17, height: 1.8, borderRadius: 1, background: 'currentColor' }} />
            <div style={{ width: 12, height: 1.8, borderRadius: 1, background: 'currentColor' }} />
            <div style={{ width: 15, height: 1.8, borderRadius: 1, background: 'currentColor' }} />
          </div>
        </TabButton>
        <TabButton active={state.tab === 'map'} label="Map" onClick={() => patch({ tab: 'map' })}>
          <div style={{ position: 'relative', width: 17, height: 17 }}>
            <div style={{ position: 'absolute', left: 6, top: 0, width: 5.5, height: 5.5, borderRadius: '50%', background: 'currentColor' }} />
            <div style={{ position: 'absolute', left: 0, bottom: 0, width: 5.5, height: 5.5, borderRadius: '50%', background: 'currentColor' }} />
            <div style={{ position: 'absolute', right: 0, bottom: 0, width: 5.5, height: 5.5, borderRadius: '50%', background: 'currentColor' }} />
          </div>
        </TabButton>
        <TabButton active={state.tab === 'timeline'} label="Timeline" onClick={() => patch({ tab: 'timeline' })}>
          <div style={{ position: 'relative', width: 17, height: 17 }}>
            <div style={{ position: 'absolute', left: 4, top: 0, bottom: 0, width: 1.5, background: 'currentColor', opacity: 0.55 }} />
            <div style={{ position: 'absolute', left: 1.5, top: 1, width: 6.5, height: 6.5, borderRadius: '50%', background: 'currentColor' }} />
            <div style={{ position: 'absolute', left: 1.5, bottom: 1, width: 6.5, height: 6.5, borderRadius: '50%', border: '1.6px solid currentColor' }} />
          </div>
        </TabButton>
        <TabButton active={state.tab === 'faq'} label="FAQs" onClick={() => patch({ tab: 'faq' })}>
          <div style={{ position: 'relative', width: 17, height: 17 }}>
            <div style={{ position: 'absolute', left: 0, top: 2, width: 17, height: 11.5, border: '1.6px solid currentColor', borderRadius: 3.5 }} />
            <div style={{ position: 'absolute', left: 3.5, bottom: 0.5, width: 4, height: 4, background: 'currentColor', transform: 'rotate(45deg)' }} />
          </div>
        </TabButton>
      </nav>

      {state.fwOpen && (
        <FrameworkSheet onClose={() => patch({ fwOpen: false })} />
      )}
      {state.selected && (
        <DetailSheet
          std={std.find(s => s.slug === state.selected)!} rels={rels} faqs={faqs} snap={state.snap}
          onClose={() => patch({ selected: null, snap: 'half' })}
          onSnap={(snap) => patch({ snap })}
          onGoTimeline={(slug) => patch({ tab: 'timeline', tlStandard: slug, tlFamily: 'All', selected: null })}
          onGoMap={(slug) => patch({ tab: 'map', focus: slug, trail: [slug], selected: null })}
          onGoFaqs={(slug) => patch({ tab: 'faq', faqScope: slug, faqQuery: '', faqLimit: 25, selected: null })}
        />
      )}
    </div>
  );
}

function TabButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 0 4px', border: 'none', background: 'transparent', color: active ? ACCENT : INK4, fontWeight: active ? 600 : 500, cursor: 'pointer', transition: 'color .15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 20 }}>{children}</div>
      <span style={{ fontSize: 9.5, letterSpacing: '.02em' }}>{label}</span>
    </button>
  );
}

// ============================================================================
// Today
// ============================================================================
function TodayTab({ stats, feedFuture, feedPast, onSelect }: {
  stats: { statTotal: number; statActive: number; statSunset: number; statDocs: number; verifiedLine: string };
  feedFuture: FeedCard[]; feedPast: FeedCard[]; onSelect: (slug: string) => void; NOW: string;
}) {
  const nStyle = (c?: string): React.CSSProperties => ({ fontFamily: 'var(--font-display)', fontSize: 27, fontWeight: 600, lineHeight: 1, color: c || INK });
  const statsRow = [
    { num: String(stats.statTotal), label: 'standards tracked', style: nStyle() },
    { num: String(stats.statActive), label: 'currently active', style: nStyle(SM.active.c) },
    { num: String(stats.statSunset), label: 'in sunset / review', style: nStyle(SM['sunset-scheduled'].c) },
    { num: String(stats.statDocs), label: 'supporting documents', style: nStyle(SM['under-review'].c) },
  ];
  const Card = ({ e }: { e: FeedCard }) => (
    <button onClick={() => onSelect(e.slug)} style={{ width: '100%', textAlign: 'left', background: SURFACE, border: '1px solid ' + (e.up ? '#cfe0dd' : LINE2), borderRadius: 13, padding: '13px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: e.m.c, background: e.m.bg, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{e.type}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: INK4, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{e.dateLabel}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16.5, fontWeight: 600, letterSpacing: '-.01em' }}>{e.short}</div>
      <div style={{ fontSize: 13, color: INK2, lineHeight: 1.45 }}>{e.note}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: e.up ? e.m.c : INK4 }}>{e.relLabel}</div>
    </button>
  );
  return (
    <div style={{ padding: '18px 16px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: SM.active.dot, flex: 'none' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: INK3, letterSpacing: '.02em' }}>{stats.verifiedLine}</span>
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 29, lineHeight: 1.14, letterSpacing: '-.02em', margin: '0 0 10px' }}>A working map of the PCI security standards.</h1>
      <p style={{ fontSize: 14.5, lineHeight: 1.55, color: INK2, margin: '0 0 20px' }}>Version history, the documents and FAQs behind each standard, and how standards supersede and converge. Sourced to the official PCI SSC site.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: LINE, border: '1px solid ' + LINE, borderRadius: 13, overflow: 'hidden', marginBottom: 30 }}>
        {statsRow.map(s => (
          <div key={s.label} style={{ background: SURFACE, padding: '13px 15px' }}>
            <div style={s.style}>{s.num}</div>
            <div style={{ fontSize: 11.5, color: INK3, marginTop: 3, letterSpacing: '.01em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {feedFuture.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, margin: 0, letterSpacing: '-.01em' }}>Ahead</h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: INK4, whiteSpace: 'nowrap' }}>{feedFuture.length} scheduled</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {feedFuture.map((e, i) => <Card key={e.slug + e.type + e.date + i} e={e} />)}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '22px 0 18px' }}>
        <div style={{ flex: 1, height: 1, background: ACCENT, opacity: 0.32 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.16em', color: ACCENT, fontWeight: 500 }}>TODAY</span>
        <div style={{ flex: 1, height: 1, background: ACCENT, opacity: 0.32 }} />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, margin: 0, letterSpacing: '-.01em' }}>Recently</h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: INK4, whiteSpace: 'nowrap' }}>{feedPast.length} entries</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {feedPast.map((e, i) => <Card key={e.slug + e.type + e.date + i} e={e} />)}
        </div>
      </div>

      <div style={{ borderTop: '1px solid ' + LINE, marginTop: 28, paddingTop: 16, fontSize: 11, color: INK4, lineHeight: 1.6 }}>
        Independent project, not affiliated with or endorsed by PCI SSC. PCI, PCI DSS, and related marks are trademarks of PCI Security Standards Council LLC. Data: CC BY 4.0 · Code: MIT.
      </div>
    </div>
  );
}

// ============================================================================
// Standards (catalog)
// ============================================================================
function StandardsTab({ std, catalogList, present, resultLabel, statDocs, faqCountOf, relCountOf, state, patch, onSelect }: {
  std: MobileStdData[]; catalogList: MobileStdData[]; present: string[]; resultLabel: string; statDocs: number;
  faqCountOf: (slug: string) => number; relCountOf: (slug: string) => number;
  state: State; patch: (p: Partial<State>) => void; onSelect: (slug: string) => void;
}) {
  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: BG, padding: '12px 16px 10px', borderBottom: '1px solid ' + LINE2 }}>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: INK4, fontSize: 14 }}>&#8981;</span>
          <input value={state.query} onChange={e => patch({ query: e.target.value })} placeholder="Search standards, families, keywords"
            style={{ width: '100%', padding: '11px 14px 11px 33px', border: '1px solid ' + LINE, borderRadius: 11, background: SURFACE, fontSize: 16, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2, margin: '0 -16px', paddingLeft: 16, paddingRight: 16 }}>
          <button onClick={() => patch({ status: 'All' })} style={chip(state.status === 'All')}>All</button>
          {present.map(k => {
            const m = SM[k];
            return <button key={k} onClick={() => patch({ status: k })} style={chip(state.status === k, m.c, m.bg)}>{m.label}</button>;
          })}
        </div>
      </div>
      <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: INK4, letterSpacing: '.03em' }}>{resultLabel}</span>
        <select value={state.sort} onChange={e => patch({ sort: e.target.value as State['sort'] })}
          style={{ marginLeft: 'auto', padding: '6px 8px', minHeight: 44, border: '1px solid ' + LINE, borderRadius: 8, background: SURFACE, fontSize: 12, color: INK2, cursor: 'pointer', outline: 'none' }}>
          <option value="name">A–Z</option>
          <option value="status">Status</option>
          <option value="recent">Newest release</option>
          <option value="docs">Most documents</option>
        </select>
      </div>
      <div style={{ padding: '10px 16px 30px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {catalogList.map(s => {
          const m = SM[s.status];
          const fq = faqCountOf(s.slug), rc = relCountOf(s.slug);
          let meta = s.documents.length + ' docs';
          if (fq) meta += ' · ' + fq + ' FAQ' + (fq > 1 ? 's' : '');
          if (rc) meta += ' · ' + rc + ' transition' + (rc > 1 ? 's' : '');
          return (
            <button key={s.slug} onClick={() => onSelect(s.slug)} style={{ textAlign: 'left', width: '100%', background: SURFACE, border: '1px solid ' + LINE2, borderRadius: 13, padding: '14px 15px', cursor: 'pointer', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.dot, flex: 'none' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', color: INK3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.family}</span>
                <div style={{ marginLeft: 'auto', flex: 'none' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: m.c, background: m.bg, padding: '4px 9px', borderRadius: 7, whiteSpace: 'nowrap', display: 'inline-block' }}>{m.label}</span>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 4 }}>{s.short}</div>
              <div style={{ fontSize: 13, color: INK2, lineHeight: 1.45, maxHeight: 38, overflow: 'hidden' }}>{sentence(s.notes) || s.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 9 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: INK }}>{s.current_version ? 'v' + s.current_version : 'n/a'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: INK4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</span>
              </div>
            </button>
          );
        })}
        {catalogList.length === 0 && (
          <div style={{ textAlign: 'center', padding: '44px 20px', color: INK4, fontSize: 14 }}>No standards match your filters.</div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Map
// ============================================================================
function MapTab({ std, rels, state, patch, onSelect, shortOf }: {
  std: MobileStdData[]; rels: RelData[]; state: State; patch: (p: Partial<State>) => void;
  onSelect: (slug: string) => void; shortOf: (slug: string) => string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageW, setStageW] = useState(340);
  const [sx, setSx] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [dir, setDir] = useState(1);
  const swipeStartRef = useRef<{ x: number; y: number; axis: 'x' | 'y' | null } | null>(null);
  const justSwipedRef = useRef(false);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const meas = () => { const w = el.clientWidth; if (w > 0) setStageW(w); };
    meas();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(meas);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  const focusSlug = state.focus;
  const fs = std.find(x => x.slug === focusSlug) || std[0];
  interface Linked { slug: string; type: string; state: string; rel: RelData }
  const linked: Linked[] = [];
  rels.forEach(r => {
    const tos = Array.isArray(r.to) ? r.to : [r.to];
    if (r.from === focusSlug) tos.forEach(t => linked.push({ slug: t, type: r.type, state: r.state, rel: r }));
    else if (tos.indexOf(focusSlug) >= 0) linked.push({ slug: r.from, type: r.type, state: r.state, rel: r });
  });
  const have: Record<string, 1> = { [focusSlug]: 1 };
  linked.forEach(l => { have[l.slug] = 1; });
  const fam: { slug: string; type: string; state?: string; rel?: RelData }[] = std.filter(x => x.family === fs.family && !have[x.slug]).map(x => ({ slug: x.slug, type: 'family' }));
  const neighbours: { slug: string; type: string; state?: string; rel?: RelData }[] = [...linked, ...fam].slice(0, 8);
  const compact = neighbours.length <= 2;
  const SC = Math.max(0.62, Math.min(1, stageW / 340));
  const STAGE = Math.round(340 * SC);
  const RING = (compact ? 86 : 106) * SC;
  const FR = (compact ? 42 : 46) * SC;
  const STAGE_H = Math.round((compact ? 278 : 318) * SC);
  const CX = STAGE / 2, CY = Math.round(STAGE_H / 2);
  const atl = atlasOrder(std);
  const ai = Math.max(0, atl.indexOf(focusSlug));

  const recentre = (slug: string, stepDir?: number) => {
    if (stepDir) setDir(stepDir);
    const t = state.trail.filter(x => x !== slug).concat(slug).slice(-6);
    patch({ focus: slug, trail: t });
  };
  const stepFocus = (d: number) => {
    if (!atl.length) return;
    const i = atl.indexOf(focusSlug);
    const n = ((i < 0 ? 0 : i) + d + atl.length) % atl.length;
    recentre(atl[n], d);
  };
  const guarded = (fn: () => void) => () => { if (justSwipedRef.current) { justSwipedRef.current = false; return; } fn(); };

  const onSwipeStart = (e: React.MouseEvent | React.TouchEvent) => {
    const t = 'touches' in e ? e.touches[0] : e;
    const x0 = t.clientX, y0 = t.clientY;
    swipeStartRef.current = { x: x0, y: y0, axis: null };
    const move = (ev: MouseEvent | TouchEvent) => {
      const p = 'touches' in ev ? ev.touches[0] : ev;
      const dx = p.clientX - x0, dy = p.clientY - y0;
      const st = swipeStartRef.current;
      if (!st) return;
      if (st.axis === null && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) st.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (st.axis === 'x') {
        if (ev.cancelable) ev.preventDefault();
        if (Math.abs(dx) > 9) justSwipedRef.current = true;
        setSx(dx); setSwiping(true);
      }
    };
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up);
      const st = swipeStartRef.current;
      const finalDx = sxRef.current;
      setSwiping(false); setSx(0);
      if (st?.axis === 'x' && Math.abs(finalDx) > 46) stepFocus(finalDx < 0 ? 1 : -1);
      if (justSwipedRef.current) setTimeout(() => { justSwipedRef.current = false; }, 0);
    };
    window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
  };
  const sxRef = useRef(0);
  useEffect(() => { sxRef.current = sx; }, [sx]);

  const edgeCol = (t: string) => t === 'converge' ? '#b5562f' : t === 'supersede' ? '#9a948b' : t === 'family' ? LINE : '#5a6fd0';
  const fm = SM[fs.status] || SM.active;

  const mapNodes = neighbours.map((n, i) => {
    const ang = (-Math.PI / 2) + (i / Math.max(1, neighbours.length)) * Math.PI * 2;
    const x = CX + Math.cos(ang) * RING, y = CY + Math.sin(ang) * RING;
    const s = std.find(z => z.slug === n.slug) || { short: n.slug, status: 'active', documents: [] as MobileDoc[] };
    const r = Math.min(29, 13 + Math.sqrt((s.documents || []).length) * 2.0) * SC;
    const m = SM[s.status] || SM.active;
    const dashed = n.type === 'family' || n.state === 'planned';
    let below = Math.sin(ang) > -0.15;
    let lTop = below ? (y + r + 5) : (y - r - 20);
    if (lTop < 2) { below = true; lTop = y + r + 5; }
    if (lTop + 26 > STAGE_H) lTop = Math.max(2, y - r - 20);
    return { n, i, ang, x, y, s, r, m, dashed, lTop };
  });

  return (
    <div style={{ padding: '16px 16px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 5 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, margin: 0, letterSpacing: '-.01em' }}>Map</h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: INK4, whiteSpace: 'nowrap' }}>{neighbours.length}{neighbours.length === 1 ? ' neighbour' : ' neighbours'}</span>
      </div>
      <p style={{ fontSize: 13.5, color: INK2, lineHeight: 1.5, margin: '0 0 14px' }}>Swipe the stage to move through standards by family. Tap a neighbour to follow a link: coloured links are recorded transitions, faint links are the same family.</p>

      {state.trail.length > 1 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', margin: '0 -16px 12px', padding: '0 16px 4px' }}>
          {state.trail.map(sl => {
            const active = sl === focusSlug;
            return (
              <button key={sl} onClick={() => recentre(sl)} style={{ flex: 'none', padding: '5px 11px', borderRadius: 18, border: '1px solid ' + (active ? ACCENT : LINE), background: active ? ACCENT_SOFT : SURFACE, color: active ? ACCENT : INK3, fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: active ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {shortOf(sl)}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ border: '1px solid ' + LINE, borderRadius: 16, background: SURFACE, padding: '6px 0', marginBottom: 12, overflow: 'hidden' }}>
        <div ref={stageRef} onMouseDown={onSwipeStart} onTouchStart={onSwipeStart}
          style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', width: '100%', overflow: 'hidden', transform: 'translateX(' + (sx * 0.5) + 'px)', opacity: swiping ? Math.max(0.42, 1 - Math.abs(sx) / 380) : 1, transition: swiping ? 'none' : 'transform .32s cubic-bezier(.2,.8,.2,1),opacity .3s ease' }}>
          <div key={focusSlug} style={{ position: 'relative', width: STAGE, height: STAGE_H, margin: '0 auto', animation: (dir > 0 ? 'pcia-stageInA' : 'pcia-stageInB') + ' .4s cubic-bezier(.2,.85,.2,1) backwards' }}>
            {mapNodes.map(({ n, i, ang, x, y, r, dashed }) => (
              <div key={'edge' + n.slug + i} style={{ position: 'absolute', left: CX, top: CY, width: RING, transformOrigin: '0 50%', transform: 'rotate(' + (ang * 180 / Math.PI) + 'deg)', opacity: n.type === 'family' ? 0.85 : 0.6, pointerEvents: 'none', ...(dashed ? { height: 0, borderTop: (n.type === 'family' ? '1px' : '2px') + ' dashed ' + edgeCol(n.type) } : { height: 2, background: edgeCol(n.type) }) }} />
            ))}
            {mapNodes.map(({ n, i, x, y, s, r, m, lTop }) => (
              <div key={'orb' + n.slug + i}>
                <button onClick={guarded(() => recentre(n.slug))} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: m.bg, border: '2px solid ' + m.c, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 600, color: m.c, pointerEvents: 'none' }}>{abbrev(s.short)}</span>
                </button>
                <div style={{ position: 'absolute', left: x, top: lTop, transform: 'translateX(-50%)', width: Math.round(84 * SC), textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 9, lineHeight: 1.25, color: INK3, pointerEvents: 'none' }}>{s.short}</div>
              </div>
            ))}
            <button onClick={guarded(() => onSelect(focusSlug))} style={{ position: 'absolute', left: CX - FR, top: CY - FR, width: FR * 2, height: FR * 2, borderRadius: '50%', background: fm.bg, border: '2.5px solid ' + ACCENT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 6, boxShadow: '0 4px 16px rgba(31,95,91,.18)', color: ACCENT }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, lineHeight: 1.1, textAlign: 'center', color: INK }}>{fs.short}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.72, marginTop: 3 }}>{(fs.documents || []).length} docs</span>
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 14px 10px' }}>
          <button onClick={() => stepFocus(-1)} style={{ flex: 'none', width: 34, height: 34, borderRadius: 17, border: '1px solid ' + LINE, background: SURFACE, color: INK2, fontSize: 15, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&#8249;</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: 3, borderRadius: 2, background: LINE2, overflow: 'hidden' }}>
              <div style={{ width: (((ai + 1) / Math.max(1, atl.length)) * 100) + '%', height: '100%', background: ACCENT, borderRadius: 2, transition: 'width .3s ease' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: swiping && sx > 46 ? ACCENT : INK4, fontWeight: swiping && sx > 46 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 96 }}>&#8249; {shortOf(atl[(ai - 1 + atl.length) % atl.length])}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: INK3, whiteSpace: 'nowrap', margin: '0 auto' }}>{ai + 1} / {atl.length}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: swiping && sx < -46 ? ACCENT : INK4, fontWeight: swiping && sx < -46 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 96 }}>{shortOf(atl[(ai + 1) % atl.length])} &#8250;</span>
            </div>
          </div>
          <button onClick={() => stepFocus(1)} style={{ flex: 'none', width: 34, height: 34, borderRadius: 17, border: '1px solid ' + LINE, background: SURFACE, color: INK2, fontSize: 15, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&#8250;</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '11px 16px', padding: '4px 16px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: INK3 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 15, height: 2, background: '#c9744a' }} />converge</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 15, height: 2, background: '#a09a90' }} />supersede</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 15, height: 0, borderTop: '2px dashed #7a8ce0' }} />associate</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 15, height: 1, background: LINE, borderTop: '1px solid ' + LINE }} />same family</span>
        </div>
      </div>

      <select value={focusSlug} onChange={e => recentre(e.target.value)} style={{ width: '100%', padding: '11px 13px', border: '1px solid ' + LINE, borderRadius: 11, background: SURFACE, fontSize: 14, cursor: 'pointer', outline: 'none', marginBottom: 16 }}>
        {std.slice().sort((a, b) => a.short.localeCompare(b.short)).map(s => <option key={s.slug} value={s.slug}>{s.short}</option>)}
      </select>

      <button onClick={guarded(() => onSelect(focusSlug))} style={{ width: '100%', textAlign: 'left', background: SURFACE, border: '1px solid ' + LINE, borderRadius: 13, padding: 15, cursor: 'pointer', display: 'block', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: fm.dot, flex: 'none' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', color: INK3 }}>{fs.family}</span>
          <div style={{ marginLeft: 'auto' }}><span style={{ fontSize: 10.5, fontWeight: 600, color: fm.c, background: fm.bg, padding: '4px 9px', borderRadius: 7, whiteSpace: 'nowrap', display: 'inline-block' }}>{fm.label}</span></div>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 3 }}>{fs.short}</div>
        <div style={{ fontSize: 12.5, color: INK3, lineHeight: 1.4, marginBottom: 9 }}>{fs.name}</div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: ACCENT }}>Open details →</span>
      </button>

      {linked.length > 0 ? (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', color: INK3, marginBottom: 11 }}>Transitions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {linked.map((l, i) => {
              const r = l.rel, isFrom = r.from === focusSlug;
              const others = (isFrom ? (Array.isArray(r.to) ? r.to : [r.to]) : [r.from]).map(shortOf).join(', ');
              let phrase = 'Aligns with';
              if (r.type === 'supersede') phrase = isFrom ? 'Superseded by' : 'Supersedes';
              else if (r.type === 'converge') phrase = isFrom ? 'Converges into' : 'Convergence from';
              const rt = RT[r.type] || RT.associate, rs = RS[r.state] || RS.planned;
              return (
                <div key={r.id + i} style={{ background: SURFACE, border: '1px solid ' + LINE2, borderRadius: 12, padding: '13px 15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: rt.c, background: rt.bg, padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{phrase}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>{others}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: rs.c, background: rs.bg, padding: '3px 9px', borderRadius: 20 }}>{rs.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: INK4 }}>{r.effective_date ? ('eff. ' + fmt(r.effective_date)) : 'date TBD'}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: INK2, lineHeight: 1.5 }}>{r.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: INK4, padding: '14px 15px', background: SURFACE, border: '1px dashed ' + LINE, borderRadius: 11 }}>No recorded transitions for this standard. Neighbours shown are from the same family.</div>
      )}

      <div style={{ marginTop: 28, borderTop: '1px solid ' + LINE, paddingTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: '-.01em' }}>Every transition</h3>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: INK4, whiteSpace: 'nowrap' }}>{rels.length} recorded</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {rels.slice().sort((a, b) => String(b.effective_date || '0').localeCompare(String(a.effective_date || '0'))).map(r => {
            const rt = RT[r.type] || RT.associate, rs = RS[r.state] || RS.planned;
            const tos = (Array.isArray(r.to) ? r.to : [r.to]).map(shortOf).join(' + ');
            const act = r.from === focusSlug || (Array.isArray(r.to) ? r.to.indexOf(focusSlug) >= 0 : r.to === focusSlug);
            return (
              <button key={r.id} onClick={() => recentre(r.from)} style={{ width: '100%', textAlign: 'left', display: 'block', background: SURFACE, border: '1px solid ' + (act ? ACCENT : LINE2), borderRadius: 12, padding: '13px 15px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: rt.c, background: rt.bg, padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{rt.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: rs.c, background: rs.bg, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{rs.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: INK4, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{r.effective_date ? ('eff. ' + fmt(r.effective_date)) : 'date TBD'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 600 }}>{shortOf(r.from)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: rt.c }}>&#8594;</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 600 }}>{tos}</span>
                </div>
                <div style={{ fontSize: 12.5, color: INK2, lineHeight: 1.5 }}>{r.description}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Timeline
// ============================================================================
function TimelineTab({ std, rels, state, patch, onSelect, shortOf, NOW }: {
  std: MobileStdData[]; rels: RelData[]; state: State; patch: (p: Partial<State>) => void;
  onSelect: (slug: string) => void; shortOf: (slug: string) => string; NOW: string;
}) {
  const families: string[] = [];
  std.forEach(s => { if (families.indexOf(s.family) < 0) families.push(s.family); });
  families.sort();
  const passes = (s: MobileStdData) => { if (state.tlStandard) return s.slug === state.tlStandard; if (state.tlFamily !== 'All') return s.family === state.tlFamily; return true; };

  interface TlEvent { date: string; kind: 'version' | 'sunset' | 'transition'; slug: string; short: string; family: string; label: string }
  const tlEvents: TlEvent[] = [];
  std.filter(passes).forEach(s => {
    (s.versions || []).forEach((v: MobileVer) => {
      if (v.published) tlEvents.push({ date: v.published, kind: 'version', slug: s.slug, short: s.short, family: s.family, label: 'Version ' + v.version + ' published' });
      if (v.retired) tlEvents.push({ date: v.retired, kind: 'sunset', slug: s.slug, short: s.short, family: s.family, label: 'v' + v.version + (v.status === 'retired' ? ' retired' : ' sunset') });
    });
  });
  rels.forEach(r => {
    if (!r.effective_date) return;
    const from = std.find(x => x.slug === r.from);
    if (!from || !passes(from)) return;
    const tos = (Array.isArray(r.to) ? r.to : [r.to]).map(shortOf).join(' + ');
    tlEvents.push({ date: r.effective_date, kind: 'transition', slug: r.from, short: from.short, family: from.family, label: (r.type === 'converge' ? 'Converges into ' : r.type === 'supersede' ? 'Superseded by ' : 'Aligns with ') + tos });
  });

  interface DocBin { date: string; month: string; count: number; items: { title: string; type: string; stdShort: string; url: string | null }[] }
  let docBins: DocBin[] = [];
  if (state.tlDocs) {
    const byMonth: Record<string, DocBin['items']> = {};
    std.filter(passes).forEach(s => {
      (s.documents || []).forEach((d: MobileDoc) => {
        if (!d.published) return;
        const k = String(d.published).slice(0, 7);
        (byMonth[k] = byMonth[k] || []).push({ title: clean(d.title), type: d.type, stdShort: s.short, url: d.source_url });
      });
    });
    docBins = Object.keys(byMonth).map(k => {
      const arr = byMonth[k].slice().sort((a, b) => a.stdShort.localeCompare(b.stdShort));
      return { date: k + '-15', month: k, count: arr.length, items: arr };
    });
  }
  const future = ([...tlEvents, ...docBins.map(d => ({ ...d, kind: 'docs' as const, slug: '', short: '', family: '' }))] as any[])
    .filter(e => String(e.date).slice(0, 7) > NOW).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const past = ([...tlEvents, ...docBins.map(d => ({ ...d, kind: 'docs' as const, slug: '', short: '', family: '' }))] as any[])
    .filter(e => String(e.date).slice(0, 7) <= NOW).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const tlEmpty = future.length === 0 && past.length === 0;
  const tlCountLabel = (tlEvents.length + docBins.reduce((a, b) => a + b.count, 0)) + ' entries';

  const openSet = new Set(state.tlOpen || []);
  const toggleDoc = (k: string) => { const cur = state.tlOpen.slice(); const ix = cur.indexOf(k); if (ix >= 0) cur.splice(ix, 1); else cur.push(k); patch({ tlOpen: cur }); };

  const mkMarker = (kind: string): React.CSSProperties => {
    if (kind === 'sunset') return { position: 'relative', zIndex: 2, marginTop: 4, width: 9, height: 9, background: SM['sunset-scheduled'].dot, transform: 'rotate(45deg)', flex: 'none' };
    if (kind === 'transition') return { position: 'relative', zIndex: 2, marginTop: 4, width: 9, height: 9, borderRadius: 2, background: RT.converge.c, flex: 'none' };
    if (kind === 'docs') return { position: 'relative', zIndex: 2, marginTop: 6, width: 7, height: 7, borderRadius: '50%', background: DT.faq.c, opacity: 0.85, flex: 'none' };
    return { position: 'relative', zIndex: 2, marginTop: 3, width: 11, height: 11, borderRadius: '50%', background: BG, border: '2px solid ' + ACCENT, flex: 'none' };
  };

  const Row = ({ e }: { e: any }) => {
    const mi = (+String(e.date).slice(5, 7) || 1) - 1;
    if (e.kind === 'docs') {
      const open = openSet.has(e.month);
      return (
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ width: 34, flex: 'none', textAlign: 'right', padding: '1px 9px 0 0' }}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: INK4, letterSpacing: '.03em' }}>{MONTHS[mi]}</span></div>
          <div style={{ width: 16, flex: 'none', position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', top: 0, bottom: 0, width: 1.5, background: LINE }} />
            <div style={mkMarker('docs')} />
          </div>
          <div style={{ flex: 1, minWidth: 0, padding: '0 0 20px 10px' }}>
            <button onClick={() => toggleDoc(e.month)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', minHeight: 44, borderRadius: 20, border: '1px solid ' + (open ? ACCENT : LINE), background: open ? ACCENT_SOFT : SURFACE, color: open ? ACCENT : INK2, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <span>{e.count} supporting document{e.count > 1 ? 's' : ''}</span>
              <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
            </button>
            {open && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: LINE2, border: '1px solid ' + LINE2, borderRadius: 10, overflow: 'hidden', marginTop: 9 }}>
                {e.items.map((d: any, i: number) => {
                  const m = DT[d.type] || { c: INK3 };
                  return (
                    <a key={i} href={d.url || undefined} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, background: SURFACE, padding: '10px 12px', textDecoration: 'none' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.c, flex: 'none', marginTop: 5 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 12.5, color: INK, lineHeight: 1.4 }}>{d.title}</span>
                        <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9.5, color: INK4, marginTop: 3 }}>{d.stdShort} · {DT[d.type] ? DT[d.type].label : d.type}</span>
                      </span>
                      <span style={{ color: INK4, fontSize: 10, flex: 'none' }}>&#8599;</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 34, flex: 'none', textAlign: 'right', padding: '1px 9px 0 0' }}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: INK4, letterSpacing: '.03em' }}>{MONTHS[mi]}</span></div>
        <div style={{ width: 16, flex: 'none', position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, width: 1.5, background: LINE }} />
          <div style={mkMarker(e.kind)} />
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: '0 0 20px 10px' }}>
          <button onClick={() => onSelect(e.slug)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', margin: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 2 }}>{e.short}</div>
            <div style={{ fontSize: 13, color: INK2, lineHeight: 1.45 }}>{e.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: INK4, marginTop: 4, letterSpacing: '.03em' }}>{e.family}</div>
          </button>
        </div>
      </div>
    );
  };

  const Section = ({ arr }: { arr: any[] }) => {
    let cy: string | null = null;
    return (
      <>
        {arr.map((e, i) => {
          const y = String(e.date).slice(0, 4);
          const newYear = y !== cy;
          cy = y;
          return (
            <React.Fragment key={i}>
              {newYear && (
                <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0 9px', background: BG }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: INK3, letterSpacing: '.06em' }}>{y}</span>
                  <div style={{ flex: 1, height: 1, background: LINE }} />
                </div>
              )}
              <Row e={e} />
            </React.Fragment>
          );
        })}
      </>
    );
  };

  return (
    <div>
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 5 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, margin: 0, letterSpacing: '-.01em' }}>Timeline</h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: INK4, whiteSpace: 'nowrap' }}>{tlCountLabel}</span>
        </div>
        <p style={{ fontSize: 13.5, color: INK2, lineHeight: 1.5, margin: '0 0 13px' }}>Scheduled releases and sunsets first, then history newest to oldest. Document releases are grouped by month.</p>
      </div>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: BG, padding: '12px 16px 10px', borderBottom: '1px solid ' + LINE2 }}>
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', margin: '0 -16px', padding: '0 16px 3px' }}>
          <button onClick={() => patch({ tlDocs: !state.tlDocs, tlOpen: [] })} style={{ ...chip(state.tlDocs), display: 'inline-flex', alignItems: 'center', gap: 7 }}>{state.tlDocs ? '● ' : '○ '}Documents</button>
          <button onClick={() => patch({ tlFamily: 'All', tlStandard: null })} style={chip(state.tlFamily === 'All' && !state.tlStandard)}>All families</button>
          {families.map(f => <button key={f} onClick={() => patch({ tlFamily: f, tlStandard: null })} style={chip(state.tlFamily === f && !state.tlStandard)}>{f}</button>)}
        </div>
        {state.tlStandard && (
          <div style={{ marginTop: 9 }}>
            <button onClick={() => patch({ tlStandard: null })} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 20, border: '1px solid ' + ACCENT, background: ACCENT_SOFT, color: ACCENT, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <span>{shortOf(state.tlStandard)}</span><span style={{ fontSize: 11, opacity: 0.7 }}>✕</span>
            </button>
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px 30px' }}>
        {future.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '6px 0 12px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: 0 }}>Scheduled</h3>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: INK4 }}>{future.length} ahead</span>
          </div>
        )}
        {future.length > 0 && <Section arr={future} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '14px 0 20px' }}>
          <div style={{ flex: 1, height: 1, background: ACCENT, opacity: 0.32 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.16em', color: ACCENT, fontWeight: 500 }}>TODAY</span>
          <div style={{ flex: 1, height: 1, background: ACCENT, opacity: 0.32 }} />
        </div>
        {past.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '6px 0 12px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: 0 }}>History</h3>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: INK4 }}>{past.length} recorded</span>
          </div>
        )}
        {past.length > 0 && <Section arr={past} />}
        {tlEmpty && <div style={{ textAlign: 'center', padding: '44px 20px', color: INK4, fontSize: 14 }}>Nothing recorded for this filter.</div>}
      </div>
    </div>
  );
}

// ============================================================================
// FAQs
// ============================================================================
function FaqsTab({ faqs, state, patch, shortOf }: {
  faqs: MobileFaq[]; state: State; patch: (p: Partial<State>) => void; shortOf: (slug: string) => string;
}) {
  const faqStdCounts: Record<string, number> = {};
  faqs.forEach(f => (f.standards || []).forEach(sl => { faqStdCounts[sl] = (faqStdCounts[sl] || 0) + 1; }));
  const generalCount = faqs.filter(f => !f.standards || !f.standards.length).length;
  const scopeList = [{ label: 'All ' + faqs.length, value: 'All' }, { label: 'General ' + generalCount, value: '__general' }]
    .concat(Object.keys(faqStdCounts).sort((a, b) => faqStdCounts[b] - faqStdCounts[a]).map(sl => ({ label: shortOf(sl) + ' ' + faqStdCounts[sl], value: sl })));

  const fq = (state.faqQuery || '').toLowerCase().trim();
  let faqAll = faqs.filter(f => {
    if (state.faqScope === '__general') { if (f.standards && f.standards.length) return false; }
    else if (state.faqScope !== 'All') { if (!f.standards || f.standards.indexOf(state.faqScope) < 0) return false; }
    if (fq && String(f.title).toLowerCase().indexOf(fq) < 0) return false;
    return true;
  });
  faqAll = faqAll.slice().sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
  const faqList = faqAll.slice(0, state.faqLimit);
  const faqMore = faqAll.length > state.faqLimit;

  return (
    <div>
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 5 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, margin: 0, letterSpacing: '-.01em' }}>FAQs</h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: INK4, whiteSpace: 'nowrap' }}>{faqs.length} entries</span>
        </div>
        <p style={{ fontSize: 13.5, color: INK2, lineHeight: 1.5, margin: '0 0 13px' }}>Official PCI SSC FAQ entries, mapped to the standard they answer for. Each opens on the council FAQ site.</p>
      </div>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: BG, padding: '12px 16px 10px', borderBottom: '1px solid ' + LINE2 }}>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: INK4, fontSize: 14 }}>&#8981;</span>
          <input value={state.faqQuery} onChange={e => patch({ faqQuery: e.target.value, faqLimit: 25 })} placeholder={'Search ' + faqs.length + ' FAQ entries'}
            style={{ width: '100%', padding: '11px 14px 11px 33px', border: '1px solid ' + LINE, borderRadius: 11, background: SURFACE, fontSize: 16, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', margin: '0 -16px', padding: '0 16px 3px' }}>
          {scopeList.map(o => (
            <button key={o.value} onClick={() => patch({ faqScope: o.value, faqLimit: 25 })} style={chip(state.faqScope === o.value)}>{o.label}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '12px 16px 30px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: INK4, marginBottom: 11, letterSpacing: '.03em' }}>
          {faqAll.length}{faqAll.length === 1 ? ' entry' : ' entries'}{fq ? (' matching “' + state.faqQuery + '”') : ''}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: LINE2, border: '1px solid ' + LINE2, borderRadius: 13, overflow: 'hidden' }}>
          {faqList.map(f => {
            const sl = (f.standards && f.standards[0]) || null;
            const m = sl ? DT.faq : DT.template;
            return (
              <a key={f.number} href={f.source_url} target="_blank" rel="noreferrer" style={{ display: 'block', background: SURFACE, padding: '13px 15px', textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: INK4, letterSpacing: '.04em' }}>#{f.number}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: m.c, background: m.bg, padding: '3px 7px', borderRadius: 5, whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{sl ? shortOf(sl) : 'General'}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: INK4, marginLeft: 'auto' }}>{f.updated ? fmt(f.updated) : ''}</span>
                </div>
                <div style={{ fontSize: 13.5, color: INK, lineHeight: 1.45 }}>{f.title}</div>
              </a>
            );
          })}
        </div>
        {faqMore && (
          <button onClick={() => patch({ faqLimit: state.faqLimit + 25 })} style={{ width: '100%', marginTop: 12, padding: 13, minHeight: 44, borderRadius: 11, border: '1px solid ' + LINE, background: SURFACE, color: ACCENT, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Load {Math.min(25, faqAll.length - state.faqLimit)} more
          </button>
        )}
        {faqAll.length === 0 && <div style={{ textAlign: 'center', padding: '44px 20px', color: INK4, fontSize: 14 }}>No FAQ entries match.</div>}
      </div>
    </div>
  );
}

// ============================================================================
// Framework picker sheet
// ============================================================================
function FrameworkSheet({ onClose }: { onClose: () => void }) {
  const frameworks = [
    { name: 'PCI DSS', live: true }, { name: 'ISO 27001', live: false }, { name: 'DORA', live: false },
    { name: 'SOC 2', live: false }, { name: 'NIST CSF', live: false },
  ];
  return (
    <div>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--pcia-scrim)', zIndex: 60, animation: 'pcia-fadeIn .18s ease' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 65, background: SURFACE2, borderTopLeftRadius: 'var(--pcia-sheet-radius)', borderTopRightRadius: 'var(--pcia-sheet-radius)', boxShadow: '0 -14px 40px rgba(0,0,0,.18)', animation: 'pcia-sheetUp .28s cubic-bezier(.2,.85,.2,1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '9px 0 4px' }}><div style={{ width: 38, height: 4, borderRadius: 3, background: LINE }} /></div>
        <div className="pcia-mobile-tabbar" style={{ padding: '6px 20px 26px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, margin: '0 0 4px' }}>Framework</h3>
          <p style={{ fontSize: 13, color: INK2, margin: '0 0 16px', lineHeight: 1.5 }}>PCI is live. The others are being sourced and verified the same way.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {frameworks.map(f => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', borderRadius: 12, border: '1px solid ' + (f.live ? ACCENT : LINE), background: f.live ? ACCENT_SOFT : SURFACE, color: f.live ? INK : INK4 }}>
                <span style={{ fontSize: 14.5, fontWeight: 500 }}>{f.name}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 5, background: f.live ? SM.active.bg : SURFACE2, color: f.live ? SM.active.c : INK4 }}>{f.live ? 'Live' : 'Soon'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Detail sheet
// ============================================================================
function DetailSheet({ std, rels, faqs, snap, onClose, onSnap, onGoTimeline, onGoMap, onGoFaqs }: {
  std: MobileStdData; rels: RelData[]; faqs: MobileFaq[]; snap: 'half' | 'full';
  onClose: () => void; onSnap: (snap: 'half' | 'full') => void;
  onGoTimeline: (slug: string) => void; onGoMap: (slug: string) => void; onGoFaqs: (slug: string) => void;
}) {
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const movedRef = useRef(false);
  const dyRef = useRef(0);

  const onGrab = (e: React.MouseEvent | React.TouchEvent) => {
    const t = 'touches' in e ? e.touches[0] : e;
    const startY = t.clientY;
    movedRef.current = false;
    setDragging(true);
    const move = (ev: MouseEvent | TouchEvent) => {
      const y = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      const d = y - startY;
      if (Math.abs(d) > 3) movedRef.current = true;
      const clamped = Math.max(-70, d);
      dyRef.current = clamped;
      setDy(clamped);
      if (ev.cancelable) ev.preventDefault();
    };
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up);
      const finalDy = dyRef.current;
      setDy(0); setDragging(false);
      if (finalDy > 120) onClose();
      else if (finalDy < -35) onSnap('full');
      else if (finalDy > 45 && snap === 'full') onSnap('half');
    };
    window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
  };
  const toggleSnap = () => { if (movedRef.current) { movedRef.current = false; return; } onSnap(snap === 'full' ? 'half' : 'full'); };

  const m = SM[std.status];
  const versions = (std.versions || []).slice().sort((a: MobileVer, b: MobileVer) => String(b.published || '0').localeCompare(String(a.published || '0')));
  const drels = rels.filter(r => r.from === std.slug || (Array.isArray(r.to) ? r.to.indexOf(std.slug) >= 0 : r.to === std.slug));
  const groups: Record<string, MobileDoc[]> = {};
  (std.documents || []).forEach((d: MobileDoc) => { (groups[d.type] = groups[d.type] || []).push(d); });
  const gkeys = Object.keys(groups).sort((a, b) => (DT[a] ? DT[a].order : 9) - (DT[b] ? DT[b].order : 9));
  const [openGroups, setOpenGroups] = useState<string[] | null>(null);
  const openG = openGroups === null ? (gkeys.length ? [gkeys[0]] : []) : openGroups;
  const toggleGroup = (type: string) => { const cur = openG.slice(); const ix = cur.indexOf(type); if (ix >= 0) cur.splice(ix, 1); else cur.push(type); setOpenGroups(cur); };
  const myFaqs = faqs.filter(f => f.standards && f.standards.indexOf(std.slug) >= 0).sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));

  const sheetStyle: React.CSSProperties = {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 80, height: snap === 'full' ? '94%' : '76%',
    background: SURFACE2, borderTopLeftRadius: 'var(--pcia-sheet-radius)', borderTopRightRadius: 'var(--pcia-sheet-radius)',
    boxShadow: '0 -14px 44px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    transform: 'translateY(' + Math.max(0, dy) + 'px)',
    animation: dragging ? 'none' : 'pcia-sheetUp .3s cubic-bezier(.2,.85,.2,1)',
    transition: dragging ? 'none' : 'transform .26s cubic-bezier(.2,.8,.2,1),height .26s cubic-bezier(.2,.8,.2,1)',
  };

  const facts = [
    { label: 'Current version', value: std.current_version ? 'v' + std.current_version : 'In development' },
    { label: 'Verification', value: std.verified ? '✓ Verified' : 'Provisional' },
    { label: 'Last verified', value: fmt(std.last_verified) },
    { label: 'Documents', value: String((std.documents || []).length) },
  ];

  return (
    <div>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--pcia-scrim)', zIndex: 70, animation: 'pcia-fadeIn .2s ease' }} />
      <aside style={sheetStyle}>
        <div onMouseDown={onGrab} onTouchStart={onGrab} onClick={toggleSnap} style={{ flex: 'none', padding: '9px 0 3px', display: 'flex', justifyContent: 'center', cursor: 'grab', touchAction: 'none' }}>
          <div style={{ width: 38, height: 4, borderRadius: 3, background: LINE }} />
        </div>
        <div style={{ flex: 'none', padding: '6px 18px 14px', borderBottom: '1px solid ' + LINE2 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.08em', color: INK3, marginBottom: 5 }}>{std.family}</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, margin: '0 0 4px', letterSpacing: '-.015em', lineHeight: 1.15 }}>{std.short}</h2>
              <div style={{ fontSize: 12.5, color: INK3, lineHeight: 1.4 }}>{std.name}</div>
            </div>
            <button onClick={onClose} style={{ flex: 'none', width: 44, height: 44, borderRadius: 22, border: '1px solid ' + LINE, background: SURFACE2, color: INK2, fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>&#10005;</button>
          </div>
          <div style={{ marginTop: 11 }}><span style={{ fontSize: 11.5, fontWeight: 600, color: m.c, background: m.bg, padding: '5px 11px', borderRadius: 7, display: 'inline-block' }}>{m.label}</span></div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '18px 18px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: LINE2, border: '1px solid ' + LINE2, borderRadius: 12, overflow: 'hidden', marginBottom: 18 }}>
            {facts.map(f => (
              <div key={f.label} style={{ background: SURFACE, padding: '11px 13px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', color: INK4, marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, color: INK }}>{f.value}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: INK2, margin: '0 0 18px' }}>{std.notes || std.name}</p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
            <a href={std.source_url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 130, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: ON_ACCENT, background: ACCENT, padding: '11px 14px', borderRadius: 11, textDecoration: 'none' }}>Official page ↗</a>
            <button onClick={() => onGoTimeline(std.slug)} style={{ flex: 'none', padding: '11px 14px', minHeight: 44, borderRadius: 11, border: '1px solid ' + LINE, background: SURFACE, color: ACCENT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Timeline</button>
            <button onClick={() => onGoMap(std.slug)} style={{ flex: 'none', padding: '11px 14px', minHeight: 44, borderRadius: 11, border: '1px solid ' + LINE, background: SURFACE, color: ACCENT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Map</button>
          </div>

          {versions.length > 0 && (
            <div style={{ marginBottom: 26 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', color: INK3, marginBottom: 11 }}>Version lineage</div>
              {versions.map((v: MobileVer, i: number) => {
                const isCur = v.status === 'active';
                const vm = SM[v.status] || SM.active;
                const tagMap: Record<string, { t: string; c: string; bg: string }> = {
                  active: { t: 'current', c: SM.active.c, bg: SM.active.bg },
                  'sunset-scheduled': { t: 'sunset', c: SM['sunset-scheduled'].c, bg: SM['sunset-scheduled'].bg },
                  retired: { t: 'retired', c: SM.retired.c, bg: SM.retired.bg },
                };
                const tg = tagMap[v.status] || tagMap.active;
                const note = v.retired ? ('Retired ' + fmt(v.retired) + (v.verified ? ' · verified' : '')) : (isCur ? ('Current version' + (v.verified ? ' · verified' : '')) : (v.verified ? 'Verified' : ''));
                return (
                  <div key={v.version + i} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 11, height: 11, borderRadius: '50%', background: isCur ? vm.dot : BG, border: '2px solid ' + (isCur ? vm.dot : LINE), flex: 'none', marginTop: 3 }} />
                      <div style={{ width: 1.5, flex: 1, background: i === versions.length - 1 ? 'transparent' : LINE, marginTop: 4, minHeight: 10 }} />
                    </div>
                    <div style={{ paddingBottom: 16, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 600 }}>v{v.version}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: tg.c, background: tg.bg, padding: '2px 7px', borderRadius: 5 }}>{tg.t}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: INK4 }}>{fmt(v.published)}</span>
                      </div>
                      {note && <div style={{ fontSize: 12.5, color: INK2 }}>{note}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {drels.length > 0 && (
            <div style={{ marginBottom: 26 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', color: INK3, marginBottom: 11 }}>Transitions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {drels.map(r => {
                  const isFrom = r.from === std.slug;
                  const others = (isFrom ? (Array.isArray(r.to) ? r.to : [r.to]) : [r.from]).join(', ');
                  let phrase = 'Aligns with';
                  if (r.type === 'supersede') phrase = isFrom ? 'Superseded by' : 'Supersedes';
                  else if (r.type === 'converge') phrase = isFrom ? 'Converges into' : 'Convergence from';
                  const rt = RT[r.type] || RT.associate;
                  return (
                    <div key={r.id} style={{ background: SURFACE, border: '1px solid ' + LINE2, borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: rt.c, background: rt.bg, padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{phrase}</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600 }}>{others}</span>
                      </div>
                      <div style={{ fontSize: 12, color: INK2, lineHeight: 1.5 }}>{r.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {gkeys.length > 0 && (
            <div style={{ marginBottom: 26 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 11 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', color: INK3 }}>Supporting documents</div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: INK4 }}>{(std.documents || []).length} total</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {gkeys.map(type => {
                  const meta = DT[type] || { label: type, c: INK2, bg: SURFACE2 };
                  const open = openG.indexOf(type) >= 0;
                  const items = groups[type].slice().sort((a: MobileDoc, b: MobileDoc) => String(b.published || '0').localeCompare(String(a.published || '0')));
                  return (
                    <div key={type} style={{ border: '1px solid ' + LINE2, borderRadius: 12, overflow: 'hidden' }}>
                      <button onClick={() => toggleGroup(type)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '11px 13px', minHeight: 44, border: 'none', background: open ? SURFACE2 : SURFACE, cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: meta.c, background: meta.bg, padding: '3px 9px', borderRadius: 6 }}>{meta.label}</span>
                        <span style={{ fontSize: 12, color: INK3 }}>{items.length}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && items.map((d: MobileDoc) => (
                        <a key={d.slug} href={d.source_url || undefined} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 13px', borderTop: '1px solid ' + LINE2, textDecoration: 'none' }}>
                          <span style={{ flex: 'none', width: 13, textAlign: 'center', fontSize: 11, paddingTop: 2, color: d.verified ? SM.active.c : INK4 }}>{d.verified ? '✓' : '·'}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK, lineHeight: 1.4 }}>{clean(d.title)}</span>
                          <span style={{ flex: 'none', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: INK4 }}>{fmt(d.published)}</span>
                        </a>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {myFaqs.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 11 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', color: INK3 }}>FAQs</div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: INK4 }}>{myFaqs.length} mapped</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: LINE2, border: '1px solid ' + LINE2, borderRadius: 12, overflow: 'hidden' }}>
                {myFaqs.slice(0, 5).map(f => (
                  <a key={f.number} href={f.source_url} target="_blank" rel="noreferrer" style={{ display: 'block', background: SURFACE, padding: '11px 13px', fontSize: 12.5, color: INK, textDecoration: 'none' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: INK4, marginRight: 8 }}>#{f.number}</span>{f.title}
                  </a>
                ))}
              </div>
              {myFaqs.length > 5 && (
                <button onClick={() => onGoFaqs(std.slug)} style={{ width: '100%', marginTop: 10, padding: 11, minHeight: 44, borderRadius: 11, border: '1px solid ' + LINE, background: SURFACE, color: ACCENT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>See all {myFaqs.length} FAQs</button>
              )}
            </div>
          )}

          <div style={{ borderTop: '1px solid ' + LINE, marginTop: 26, paddingTop: 16 }}>
            <a href={std.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: ACCENT }}>View on pcisecuritystandards.org ↗</a>
          </div>
        </div>
      </aside>
    </div>
  );
}
