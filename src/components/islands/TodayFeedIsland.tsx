import React, { useState } from 'react';
import { ErrorBoundary, DetailDrawer, DetailSheet, buildRadar, EV_META, monthsAway, relTime, fmt } from './shared';
import type { AppData, RadarEvent } from './shared';

function FeedCard({ e, onSelect }: { e: RadarEvent; onSelect: (slug: string) => void }) {
  const m = EV_META[e.type] || { c: '#6b6760', bg: '#ece9e3' };
  const up = monthsAway(e.date) > 0;
  const handleClick = () => { if (e.link) window.location.assign(e.link); else onSelect(e.slug); };
  return (
    <button onClick={handleClick} style={{ width: '100%', textAlign: 'left', background: '#fffdf8', border: `1px solid ${up ? '#cfe0dd' : '#efe6d3'}`, borderRadius: 13, padding: '13px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: m.c, background: m.bg, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{e.type}</span>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#a08f6a', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{fmt(e.date)}</span>
      </div>
      <div style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 16.5, fontWeight: 600, letterSpacing: '-.01em' }}>{e.name}</div>
      <div style={{ fontSize: 13, color: '#6b655b', lineHeight: 1.45 }}>{e.note}</div>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: up ? m.c : '#a08f6a' }}>{relTime(e.date)}</div>
    </button>
  );
}

export default function TodayFeedIsland({ data, initialSelected }: { data: AppData; initialSelected?: string | null }) {
  const [selected, setSelected] = useState<string | null>(initialSelected ?? null);
  if (!data) return <div style={{ padding: 40, color: 'red', fontFamily: 'monospace' }}>Error: props.data is undefined</div>;
  const { standards, relationships, faqs } = data;
  const selectedStd = standards.find(s => s.slug === selected) ?? null;

  const events = buildRadar(standards, relationships);
  const future = events.filter(e => monthsAway(e.date) > 0).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter(e => monthsAway(e.date) <= 0);

  return (
    <ErrorBoundary>
      <>
        <section className="si-section si-today-section">
          {future.length > 0 && (
            <div className="si-today-block">
              <div className="si-today-heading">
                <h2>Ahead</h2>
                <span className="mono si-today-count">{future.length} scheduled</span>
              </div>
              <div className="si-today-feed">
                {future.map(e => <FeedCard key={e.slug + e.type + e.date} e={e} onSelect={setSelected} />)}
              </div>
            </div>
          )}

          <div className="si-today-divider">
            <div className="si-today-divider-line" />
            <span className="mono si-today-divider-label">Today</span>
            <div className="si-today-divider-line" />
          </div>

          <div className="si-today-block">
            <div className="si-today-heading">
              <h2>Recently</h2>
              <span className="mono si-today-count">{past.length} {past.length === 1 ? 'entry' : 'entries'}</span>
            </div>
            <div className="si-today-feed">
              {past.map(e => <FeedCard key={e.slug + e.type + e.date} e={e} onSelect={setSelected} />)}
            </div>
          </div>
        </section>
        {selectedStd && (
          <>
            <div data-vp-show="desktop"><DetailDrawer std={selectedStd} relationships={relationships} standards={standards} onClose={() => setSelected(null)} /></div>
            <div data-vp-show="mobile"><DetailSheet std={selectedStd} relationships={relationships} standards={standards} faqs={faqs} onClose={() => setSelected(null)} /></div>
          </>
        )}
      </>
    </ErrorBoundary>
  );
}
