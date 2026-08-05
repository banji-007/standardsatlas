import React, { useState } from 'react';
import { ErrorBoundary, DetailDrawer, SM, DT, RT, GRAPH_LABEL, ACCENT, toX, fmt, buildTimelineEvents } from './shared';
import type { AppData, StdData, RelData, TimelineEvent } from './shared';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function monthLabel(d: string): string { return MONTHS_SHORT[(+d.slice(5, 7) || 1) - 1]; }
function nowYm(): string { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0'); }

type TlBlock =
  | { kind: 'section'; key: string; label: string; count: string }
  | { kind: 'today'; key: string }
  | { kind: 'year'; key: string; label: string }
  | { kind: 'event'; key: string; month: string; markerKind: 'version' | 'sunset' | 'transition'; short: string; label: string; onClick: () => void }
  | { kind: 'docs'; key: string; month: string; label: string; open: boolean; onToggle: () => void; docs: { title: string; url: string | null; meta: string }[] };

function tlMarkerStyle(kind: 'version' | 'sunset' | 'transition' | 'docs'): React.CSSProperties {
  if (kind === 'sunset') return { position: 'relative', zIndex: 2, marginTop: 4, width: 9, height: 9, background: SM['sunset-scheduled'].dot, transform: 'rotate(45deg)', flexShrink: 0 };
  if (kind === 'transition') return { position: 'relative', zIndex: 2, marginTop: 4, width: 9, height: 9, borderRadius: 2, background: RT.converge.c, flexShrink: 0 };
  if (kind === 'docs') return { position: 'relative', zIndex: 2, marginTop: 6, width: 7, height: 7, borderRadius: '50%', background: DT.faq.c, opacity: 0.85, flexShrink: 0 };
  return { position: 'relative', zIndex: 2, marginTop: 3, width: 11, height: 11, borderRadius: '50%', background: '#fbf7ee', border: `2px solid ${ACCENT}`, flexShrink: 0 };
}

function TimelineMobileView({ standards, relationships, tlDocs, setTlDocs, tlOpen, setTlOpen, tlStandard, setTlStandard, onSelect }: {
  standards: StdData[]; relationships: RelData[];
  tlDocs: boolean; setTlDocs: (v: boolean) => void;
  tlOpen: string[]; setTlOpen: (v: string[]) => void;
  tlStandard: string | null; setTlStandard: (v: string | null) => void;
  onSelect: (slug: string) => void;
}) {
  const NOW = nowYm();
  const passes = (s: StdData) => (tlStandard ? s.slug === tlStandard : true);
  const scopedStandards = standards.filter(passes);
  const scopedSlugs = new Set(scopedStandards.map(s => s.slug));

  const tlEvents: TimelineEvent[] = buildTimelineEvents(standards, relationships).filter(e => scopedSlugs.has(e.slug));

  interface DocBin { date: string; month: string; kind: 'docs'; count: number; items: { title: string; url: string | null; meta: string }[] }
  let docBins: DocBin[] = [];
  if (tlDocs) {
    const byMonth: Record<string, { title: string; url: string | null; meta: string }[]> = {};
    scopedStandards.forEach(s => {
      s.documents.forEach(d => {
        if (!d.published) return;
        const k = d.published.slice(0, 7);
        const short = GRAPH_LABEL[s.slug] ?? s.name;
        (byMonth[k] ??= []).push({ title: d.title, url: d.source_url, meta: `${short} · ${DT[d.type]?.label ?? d.type}` });
      });
    });
    docBins = Object.keys(byMonth).map(k => ({
      date: k + '-15', month: k, kind: 'docs' as const,
      count: byMonth[k].length,
      items: byMonth[k].slice().sort((a, b) => a.meta.localeCompare(b.meta)),
    }));
  }

  type AnyEvent = (TimelineEvent & { isDoc?: false }) | (DocBin & { isDoc: true });
  const all: AnyEvent[] = [...tlEvents.map(e => ({ ...e, isDoc: false as const })), ...docBins.map(d => ({ ...d, isDoc: true as const }))];
  const future = all.filter(e => e.date.slice(0, 7) > NOW).sort((a, b) => a.date.localeCompare(b.date));
  const past = all.filter(e => e.date.slice(0, 7) <= NOW).sort((a, b) => b.date.localeCompare(a.date));

  const openSet = new Set(tlOpen);
  const blocks: TlBlock[] = [];
  const pushRows = (arr: AnyEvent[]) => {
    let cy: string | null = null;
    arr.forEach((e, i) => {
      const y = e.date.slice(0, 4);
      if (y !== cy) { cy = y; blocks.push({ kind: 'year', key: 'y' + y + i, label: y }); }
      if (e.isDoc) {
        const open = openSet.has(e.month);
        blocks.push({
          kind: 'docs', key: 'd' + e.month, month: monthLabel(e.date),
          label: `${e.count} supporting document${e.count > 1 ? 's' : ''}`, open,
          onToggle: () => { const cur = tlOpen.slice(); const ix = cur.indexOf(e.month); if (ix >= 0) cur.splice(ix, 1); else cur.push(e.month); setTlOpen(cur); },
          docs: e.items,
        });
      } else {
        blocks.push({ kind: 'event', key: e.slug + e.kind + e.date + i, month: monthLabel(e.date), markerKind: e.kind, short: e.short, label: e.label, onClick: () => onSelect(e.slug) });
      }
    });
  };
  if (future.length) { blocks.push({ kind: 'section', key: 'ahead', label: 'Scheduled', count: `${future.length} ahead` }); pushRows(future); }
  blocks.push({ kind: 'today', key: 'today' });
  if (past.length) { blocks.push({ kind: 'section', key: 'history', label: 'History', count: `${past.length} recorded` }); pushRows(past); }

  const tlEmpty = future.length === 0 && past.length === 0;
  const totalDocs = docBins.reduce((a, b) => a + b.count, 0);
  const tlCountLabel = `${tlEvents.length + totalDocs} entries`;

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '7px 13px', borderRadius: 20, border: `1px solid ${active ? ACCENT : '#ddd5c5'}`,
    background: active ? '#eef5f4' : '#fbf7ee', color: active ? ACCENT : '#6b655b',
    fontSize: 12.5, fontWeight: active ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
    fontFamily: "'IBM Plex Sans',system-ui,sans-serif",
  });

  return (
    <section>
      <div className="si-section si-tl-mobile-header">
        <div className="si-tl-mobile-heading-row">
          <h2>Timeline</h2>
          <span className="mono si-tl-mobile-count">{tlCountLabel}</span>
        </div>
        <p>Scheduled releases and sunsets first, then history newest to oldest. Document releases are grouped by month.</p>
      </div>
      <div className="si-section si-tl-mobile-bar">
        <button onClick={() => setTlDocs(!tlDocs)} style={chip(tlDocs)}>{tlDocs ? '● ' : '○ '}Documents</button>
        {tlStandard && (
          <button onClick={() => setTlStandard(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 20, border: `1px solid ${ACCENT}`, background: '#eef5f4', color: ACCENT, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
            <span>{GRAPH_LABEL[tlStandard] ?? tlStandard}</span><span style={{ fontSize: 11, opacity: 0.7 }}>✕</span>
          </button>
        )}
      </div>
      <div className="si-section si-tl-mobile-list">
        {blocks.map(b => {
          if (b.kind === 'section') return (
            <div key={b.key} className="si-tl-mobile-section-heading">
              <h3>{b.label}</h3><span className="mono">{b.count}</span>
            </div>
          );
          if (b.kind === 'today') return (
            <div key={b.key} className="si-today-divider">
              <div className="si-today-divider-line" /><span className="mono si-today-divider-label">Today</span><div className="si-today-divider-line" />
            </div>
          );
          if (b.kind === 'year') return (
            <div key={b.key} className="si-tl-mobile-year"><span className="mono">{b.label}</span><div className="si-tl-mobile-year-line" /></div>
          );
          if (b.kind === 'event') return (
            <div key={b.key} className="si-tl-mobile-row">
              <div className="si-tl-mobile-month mono">{b.month}</div>
              <div className="si-tl-mobile-marker-col"><div className="si-tl-mobile-rail" /><div style={tlMarkerStyle(b.markerKind)} /></div>
              <button onClick={b.onClick} className="si-tl-mobile-event-btn">
                <div className="si-tl-mobile-event-short">{b.short}</div>
                <div className="si-tl-mobile-event-label">{b.label}</div>
              </button>
            </div>
          );
          return (
            <div key={b.key} className="si-tl-mobile-row">
              <div className="si-tl-mobile-month mono">{b.month}</div>
              <div className="si-tl-mobile-marker-col"><div className="si-tl-mobile-rail" /><div style={tlMarkerStyle('docs')} /></div>
              <div className="si-tl-mobile-docs-group" style={{ flex: 1, minWidth: 0 }}>
                <button onClick={b.onToggle} className="si-tl-mobile-docs-btn" style={{ borderColor: b.open ? ACCENT : '#ddd5c5', background: b.open ? '#eef5f4' : '#fbf7ee', color: b.open ? ACCENT : '#6b655b' }}>
                  <span>{b.label}</span><span style={{ fontSize: 9, opacity: 0.7 }}>{b.open ? '▲' : '▼'}</span>
                </button>
                {b.open && (
                  <div className="si-tl-mobile-doclist">
                    {b.docs.map((d, i) => (
                      <a key={i} href={d.url ?? '#'} target="_blank" rel="noopener noreferrer" className="si-tl-mobile-doclink">
                        <span className="si-tl-mobile-doctitle">{d.title}</span>
                        <span className="mono si-tl-mobile-docmeta">{d.meta}</span>
                        <span className="si-tl-mobile-docarrow">↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {tlEmpty && <div style={{ textAlign: 'center', padding: 44, color: '#a08f6a', fontSize: 14 }}>Nothing recorded for this filter.</div>}
      </div>
    </section>
  );
}

function TimelineView({ standards, showDocs, setShowDocs, docTypes, setDocTypes, tlFull, setTlFull, onSelect }: {
  standards: StdData[]; showDocs: boolean; setShowDocs: (v: boolean) => void;
  docTypes: string[] | null; setDocTypes: (v: string[] | null) => void;
  tlFull: boolean; setTlFull: (v: boolean) => void; onSelect: (slug: string) => void;
}) {
  const now = new Date();
  const todayX = ((now.getFullYear() + now.getMonth() / 12) - 2016) / 12 * 100;
  const presentDocTypes = Object.keys(DT).filter(t => standards.some(s => s.documents.some(d => d.type === t))).sort((a, b) => DT[a].order - DT[b].order);
  const defaultDocTypes = presentDocTypes.filter(t => t !== 'faq');
  const docTypeSet = new Set(docTypes === null ? defaultDocTypes : docTypes);
  const tlOrder: Record<string, number> = { active: 0, 'sunset-scheduled': 1, 'under-review': 2, forthcoming: 3, retired: 4 };
  const rowH = showDocs ? 60 : 46, vCenter = showDocs ? 17 : 23;
  const YEARS = [2016, 2018, 2020, 2022, 2024, 2026, 2028];

  const rows = standards.slice().sort((a, b) => (tlOrder[a.status] - tlOrder[b.status]) || a.name.localeCompare(b.name)).map(s => {
    const pts: { x: number; label: string; sunset: boolean }[] = [];
    s.versions.forEach(v => {
      if (v.published) pts.push({ x: toX(v.published), label: `v${v.version}`, sunset: false });
      if (v.retired && (v.status === 'sunset-scheduled' || v.status === 'retired')) pts.push({ x: toX(v.retired), label: '', sunset: true });
    });
    const xs = pts.map(p => p.x);
    const minX = xs.length ? Math.min(...xs) : 0, maxX = xs.length ? Math.max(...xs) : 0;
    let docMarkers: React.CSSProperties[] = [];
    if (showDocs) {
      const ds = s.documents.filter(d => d.published && docTypeSet.has(d.type)).map(d => ({ x: toX(d.published!), type: d.type }));
      const buckets: Record<number, typeof ds> = {};
      ds.forEach(d => { const k = Math.round(d.x / 1.4); (buckets[k] = buckets[k] || []).push(d); });
      Object.values(buckets).forEach(arr => {
        const bx = arr.reduce((a, d) => a + d.x, 0) / arr.length;
        arr.forEach((d, idx) => { const m = DT[d.type] || { c: '#9a8fb0' }; const isFaq = d.type === 'faq'; docMarkers.push({ position: 'absolute', left: `${bx}%`, top: `${rowH - 9 - idx * 4.4}px`, width: isFaq ? 3 : 4, height: isFaq ? 3 : 4, borderRadius: '50%', background: m.c, opacity: isFaq ? 0.45 : 0.78, transform: 'translateX(-50%)' }); });
      });
    }
    const sorted = pts.slice().sort((a, b) => a.x - b.x);
    let lastX: number | null = null, lastUp = false;
    const markers = sorted.map(p => {
      let up = false;
      if (p.label && lastX !== null && (p.x - lastX) < 5.2) up = !lastUp; else up = false;
      if (p.label) { lastX = p.x; lastUp = up; }
      return { ...p, up };
    });
    return { s, minX, maxX, markers, docMarkers };
  });

  return (
    <section className={tlFull ? 'si-timeline-section--full' : 'si-section si-timeline-section'}>
      {!tlFull && <>
        <h2 style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 24, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-.01em' }}>Cross-family version timeline</h2>
        <p style={{ fontSize: 14, color: '#6b655b', margin: '0 0 18px', maxWidth: 680 }}>Verified version releases across every standard, 2016–2028. Diamonds mark scheduled sunsets; the line marks today.</p>
      </>}
      <div style={{ display: 'flex', flexDirection: 'column', ...(tlFull ? { flex: 1, minHeight: 0 } : {}) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          <button onClick={() => setShowDocs(!showDocs)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 15px', borderRadius: 10, border: `1px solid ${showDocs ? ACCENT : '#ddd5c5'}`, background: showDocs ? '#eef5f4' : '#fbf7ee', color: showDocs ? ACCENT : '#6b655b', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
            {showDocs ? '● Hide document releases' : '○ Show document releases'}
          </button>
          {showDocs && (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', color: '#a8a195' }}>show:</span>
              {presentDocTypes.map(t => {
                const on = docTypeSet.has(t), m = DT[t];
                const cnt = standards.reduce((a, s) => a + s.documents.filter(d => d.type === t).length, 0);
                return (
                  <button key={t} onClick={() => { const cur = docTypes === null ? defaultDocTypes.slice() : docTypes.slice(); setDocTypes(cur.includes(t) ? cur.filter(x => x !== t) : cur.concat(t)); }} style={{ padding: '5px 11px', borderRadius: 18, border: `1px solid ${on ? m.c : '#ddd5c5'}`, background: on ? m.bg : '#fbf7ee', color: on ? m.c : '#a8a195', fontSize: 11.5, fontWeight: on ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
                    {m.label} {cnt}
                  </button>
                );
              })}
            </div>
          )}
          <button onClick={() => setTlFull(!tlFull)} className="si-tl-fullscreen-btn" style={{ border: `1px solid ${tlFull ? ACCENT : '#ddd5c5'}`, background: tlFull ? '#eef5f4' : '#fbf7ee', color: tlFull ? ACCENT : '#6b655b' }}>
            {tlFull ? '✕ Exit full screen' : '⛶ Full screen'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#8a8377' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#fff', border: `2px solid ${ACCENT}`, display: 'inline-block' }} />version release</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 9, height: 9, background: '#d39314', display: 'inline-block', transform: 'rotate(45deg)' }} />sunset / retired</span>
          {showDocs && presentDocTypes.some(t => t !== 'faq' && docTypeSet.has(t)) && <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9a8fb0', display: 'inline-block' }} />supporting document</span>}
          {showDocs && docTypeSet.has('faq') && <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: DT['faq'].c, opacity: 0.55, display: 'inline-block' }} />FAQ update</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 2, height: 13, background: ACCENT, display: 'inline-block' }} />today</span>
        </div>
        <div className={tlFull ? 'si-timeline-plot-wrap si-timeline-plot-wrap--full' : 'si-timeline-plot-wrap'}>
          <div className={tlFull ? 'si-timeline-inner si-timeline-inner--full' : 'si-timeline-inner'}>
            <div style={{ position: 'absolute', left: 172, right: 24, top: 0, bottom: 14, pointerEvents: 'none' }}>
              {YEARS.map(y => { const x = (y - 2016) / 12 * 100; return (
                <div key={y} style={{ display: 'contents' }}>
                  <div style={{ position: 'absolute', left: `${x}%`, top: 22, bottom: 0, width: 1, background: '#efe6d3' }} />
                  <div className="si-tl-year" style={{ left: `${x}%` }}>{y}</div>
                </div>
              ); })}
              <div style={{ position: 'absolute', left: `${todayX}%`, top: 20, bottom: 0, width: 2, background: ACCENT, opacity: 0.7 }} />
              <div className="si-tl-today-label" style={{ left: `${todayX}%` }}>today</div>
            </div>
            <div style={{ position: 'relative', paddingTop: 26 }}>
              {rows.map(({ s, minX, maxX, markers, docMarkers }) => (
                <div key={s.slug} onClick={() => onSelect(s.slug)} className="si-timeline-row" style={{ height: rowH }}>
                  <div className="si-timeline-namecol">
                    <div className="si-tl-name">{GRAPH_LABEL[s.slug] ?? s.name}</div>
                    <div className="si-tl-status">{s.status.replace(/-/g, ' ')}</div>
                  </div>
                  <div className="si-timeline-track">
                    {docMarkers.map((dm, i) => <div key={i} style={dm} />)}
                    {markers.length > 1 && <div style={{ position: 'absolute', top: vCenter, left: `${minX}%`, width: `${maxX - minX}%`, height: 2, background: '#e2dac9', transform: 'translateY(-50%)' }} />}
                    {markers.map((p, i) => (
                      <div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: vCenter, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {p.sunset ? <div style={{ width: 10, height: 10, background: '#d39314', transform: 'rotate(45deg)' }} /> : <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#fff', border: `2px solid ${ACCENT}` }} />}
                        {p.label && <div className="si-tl-version-label" style={{ top: p.up ? -17 : 12 }}>{p.label}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function VersionTimelineIsland({ data, initialSelected }: { data: AppData; initialSelected?: string | null }) {
  const [selected, setSelected] = useState<string | null>(initialSelected ?? null);
  const [showDocs, setShowDocs] = useState(false);
  const [docTypes, setDocTypes] = useState<string[] | null>(null);
  const [tlFull, setTlFull]     = useState(false);

  // Mobile renderer's own state: independent of the desktop plot's state
  // above (different shape entirely — a bool + open-months list vs.
  // docTypes/tlFull), same pattern as Today/Catalog on /. tlStandardM
  // starts null (matching SSR) rather than reading any URL param at
  // init, so there's nothing here that could disagree with the
  // server-rendered HTML and trigger a hydration warning; Task 5's
  // detail-sheet "Timeline" jump button is what will drive this once it
  // exists, most likely via a plain setState call rather than a URL
  // param round-trip.
  const [tlDocsM, setTlDocsM]         = useState(false);
  const [tlOpenM, setTlOpenM]         = useState<string[]>([]);
  const [tlStandardM, setTlStandardM] = useState<string | null>(null);

  if (!data) return <div style={{ padding: 40, color: 'red', fontFamily: 'monospace' }}>Error: props.data is undefined</div>;
  const { standards, relationships } = data;
  const selectedStd = standards.find(s => s.slug === selected) ?? null;

  return (
    <ErrorBoundary>
      <>
        <div data-vp-show="desktop">
          <TimelineView standards={standards} showDocs={showDocs} setShowDocs={setShowDocs} docTypes={docTypes} setDocTypes={setDocTypes} tlFull={tlFull} setTlFull={setTlFull} onSelect={setSelected} />
        </div>
        <div data-vp-show="mobile">
          <TimelineMobileView standards={standards} relationships={relationships} tlDocs={tlDocsM} setTlDocs={setTlDocsM} tlOpen={tlOpenM} setTlOpen={setTlOpenM} tlStandard={tlStandardM} setTlStandard={setTlStandardM} onSelect={setSelected} />
        </div>
        {selectedStd && <DetailDrawer std={selectedStd} relationships={relationships} standards={standards} onClose={() => setSelected(null)} />}
      </>
    </ErrorBoundary>
  );
}
