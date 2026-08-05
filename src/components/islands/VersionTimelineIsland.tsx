import React, { useState } from 'react';
import { ErrorBoundary, DetailDrawer, SM, DT, GRAPH_LABEL, ACCENT, toX } from './shared';
import type { AppData, StdData } from './shared';

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

  if (!data) return <div style={{ padding: 40, color: 'red', fontFamily: 'monospace' }}>Error: props.data is undefined</div>;
  const { standards, relationships } = data;
  const selectedStd = standards.find(s => s.slug === selected) ?? null;

  return (
    <ErrorBoundary>
      <>
        <TimelineView standards={standards} showDocs={showDocs} setShowDocs={setShowDocs} docTypes={docTypes} setDocTypes={setDocTypes} tlFull={tlFull} setTlFull={setTlFull} onSelect={setSelected} />
        {selectedStd && <DetailDrawer std={selectedStd} relationships={relationships} standards={standards} onClose={() => setSelected(null)} />}
      </>
    </ErrorBoundary>
  );
}
