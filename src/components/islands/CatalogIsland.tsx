import React, { useState, useRef } from 'react';
import { ErrorBoundary, DetailDrawer, DetailSheet, SM, monthsAway, relTime, fmt, firstSentence, ACCENT, buildRadar, EV_META } from './shared';
import type { AppData, StdData, RelData, RadarEvent } from './shared';

function RadarStrip({ standards, relationships, onSelect }: { standards: StdData[]; relationships: RelData[]; onSelect: (slug: string) => void }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const events = buildRadar(standards, relationships);
  const future = events.filter(e => monthsAway(e.date) > 0);
  const past   = events.filter(e => monthsAway(e.date) <= 0);
  if (events.length === 0) return null;

  const card = (e: RadarEvent) => {
    const m = EV_META[e.type] || { c: '#6b6760', bg: '#ece9e3' };
    const up = monthsAway(e.date) > 0;
    const handleClick = () => { if (e.link) window.location.assign(e.link); else onSelect(e.slug); };
    return (
      <button key={e.slug + e.type + e.date} onClick={handleClick} style={{ flexShrink: 0, width: 214, minHeight: 112, scrollSnapAlign: 'start', textAlign: 'left', background: '#fffdf8', border: `1px solid ${up ? '#cfe0dd' : '#efe6d3'}`, borderRadius: 12, padding: '13px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 7, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: m.c, background: m.bg, padding: '4px 9px', borderRadius: 6, whiteSpace: 'nowrap' }}>{e.type}</span>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#a08f6a' }}>{fmt(e.date)}</span>
        </div>
        <div style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 15, fontWeight: 600 }}>{e.name}</div>
        <div style={{ fontSize: 12, color: '#6b655b', lineHeight: 1.4 }}>{e.note}</div>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: up ? m.c : '#a08f6a', marginTop: 'auto' }}>{relTime(e.date)}</div>
      </button>
    );
  };

  return (
    <section className="si-section si-radar-section">
      <div className="si-radar-card">
        <div className="si-radar-head">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, display: 'inline-block', flexShrink: 0 }} />
          <h2 style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 19, fontWeight: 600, margin: 0, whiteSpace: 'nowrap' }}>Standards radar</h2>
          <span style={{ fontSize: 12.5, color: '#8a8377' }}>upcoming and recent activity</span>
          <div className="si-radar-arrows">
            <button onClick={() => scrollerRef.current?.scrollBy({ left: -264, behavior: 'smooth' })} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #ddd5c5', background: '#fffdf8', color: '#6b655b', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>‹</button>
            <button onClick={() => scrollerRef.current?.scrollBy({ left: 264, behavior: 'smooth' })} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #ddd5c5', background: '#fffdf8', color: '#6b655b', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>›</button>
          </div>
        </div>
        <div ref={scrollerRef} className="si-radar-scroller">
          {future.map(card)}
          {future.length > 0 && past.length > 0 && (
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '6px 8px 2px', scrollSnapAlign: 'start' }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '.14em', color: ACCENT }}>TODAY</span>
              <div style={{ width: 2, flex: 1, background: ACCENT, opacity: 0.4, borderRadius: 2 }} />
            </div>
          )}
          {past.map(card)}
        </div>
      </div>
    </section>
  );
}

function CatalogView({ standards, relationships, query, setQuery, statusFilter, setStatusFilter, sort, setSort, onSelect }: {
  standards: StdData[]; relationships: RelData[];
  query: string; setQuery: (q: string) => void;
  statusFilter: string; setStatusFilter: (s: string) => void;
  sort: string; setSort: (s: string) => void;
  onSelect: (slug: string) => void;
}) {
  const relCount = (slug: string) => relationships.filter(r => r.from === slug || (Array.isArray(r.to) ? r.to.includes(slug) : r.to === slug)).length;
  const latestPub = (s: StdData) => s.versions.map(v => v.published).filter(Boolean).sort().slice(-1)[0] || s.last_verified || '';
  const statusOrder: Record<string, number> = { active: 0, 'sunset-scheduled': 1, 'under-review': 2, forthcoming: 3, retired: 4 };

  const q = query.toLowerCase().trim();
  let list = standards.filter(s => {
    if (q && !(s.name + ' ' + (s.notes || '')).toLowerCase().includes(q)) return false;
    if (statusFilter !== 'All' && s.status !== statusFilter) return false;
    return true;
  });
  if (sort === 'name')   list.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'status') list.sort((a, b) => (statusOrder[a.status] - statusOrder[b.status]) || a.name.localeCompare(b.name));
  if (sort === 'recent') list.sort((a, b) => String(latestPub(b)).localeCompare(String(latestPub(a))));
  if (sort === 'docs')   list.sort((a, b) => b.documents.length - a.documents.length);

  const present = Array.from(new Set(standards.map(s => s.status)));
  const chip = (active: boolean, c?: string, bg?: string): React.CSSProperties => ({
    border: `1px solid ${active ? (c || ACCENT) : '#ddd5c5'}`,
    background: active ? (bg || '#e8f0ef') : '#fbf7ee', color: active ? (c || ACCENT) : '#6b655b',
    fontWeight: active ? 600 : 500, cursor: 'pointer',
  });
  const totalDocs = standards.reduce((a, s) => a + s.documents.length, 0);

  const sortSelect = (
    <select value={sort} onChange={e => setSort(e.target.value)} className="si-sort-select">
      <option value="name">Sort: A–Z</option>
      <option value="status">Sort: Status</option>
      <option value="recent">Sort: Most recent release</option>
      <option value="docs">Sort: Most documents</option>
    </select>
  );
  const resultLabel = list.length === standards.length ? `${standards.length} standards · ${totalDocs} documents` : `${list.length} of ${standards.length} standards`;

  return (
    <div>
      <section className="si-section si-catalog-toprow">
        <div className="si-search-row">
          <div className="si-search-box">
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#a8a195', fontSize: 14 }}>⌕</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search standards, families, keywords…" className="si-search-input" />
          </div>
          {/* Desktop: sort control pairs with the search input, as production ships today. */}
          <span data-vp-show="desktop">{sortSelect}</span>
        </div>
        <div className="si-filter-chips">
          {[{ label: 'All', value: 'All' }, ...present.map(k => ({ label: SM[k]?.label ?? k, value: k }))].map(o => {
            const m = o.value !== 'All' ? SM[o.value] : null;
            return <button key={o.value} onClick={() => setStatusFilter(o.value)} className="si-filter-chip" style={chip(statusFilter === o.value, m?.c, m?.bg)}>{o.label}</button>;
          })}
        </div>
        <div className="si-catalog-result-row">
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: '#a08f6a', letterSpacing: '.03em' }}>{resultLabel}</span>
          {/* Mobile (concept treatment): sort control pairs with the result count instead. */}
          <span data-vp-show="mobile" className="si-catalog-result-sort">{sortSelect}</span>
        </div>
      </section>

      <div data-vp-show="desktop">
        <section className="si-section si-catalog-list-section">
          {list.map(s => {
            const m = SM[s.status] || SM['active'];
            const rc = relCount(s.slug);
            const faqs = s.documents.filter(d => d.type === 'faq').length;
            let meta = s.documents.length + (s.documents.length === 1 ? ' doc' : ' docs');
            if (faqs) meta += ` · ${faqs} FAQ${faqs > 1 ? 's' : ''}`;
            if (rc) meta += ` · ${rc} transition${rc > 1 ? 's' : ''}`;
            const description = firstSentence(s.notes);
            const showDescription = description && description !== s.name;
            return (
              <button key={s.slug} onClick={() => onSelect(s.slug)}
                className="si-catalog-row"
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8a8377' }}>{s.status.replace(/-/g, ' ')}</span>
                  </div>
                  <div style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 18, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 3 }}>{s.name}</div>
                  {showDescription && <div style={{ fontSize: 13.5, color: '#6b655b', lineHeight: 1.45, marginBottom: 6 }}>{description}</div>}
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#a8a195', letterSpacing: '.02em' }}>{meta}</div>
                </div>
                <div className="si-catalog-row-meta">
                  <div className="si-catalog-row-version">
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 14, color: '#211e19' }}>{s.current_version ? `v${s.current_version}` : 'n/a'}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: s.verified ? '#1f7a4d' : '#a08f6a', marginTop: 2 }}>{s.verified ? '✓ verified' : 'provisional'}</div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: m.c, background: m.bg, padding: '4px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>{m.label}</span>
                </div>
              </button>
            );
          })}
          {list.length === 0 && <div style={{ textAlign: 'center', padding: 50, color: '#a08f6a', fontSize: 14 }}>No standards match your filters.</div>}
        </section>
      </div>

      <div data-vp-show="mobile">
        <section className="si-section si-catalog-list-section-mobile">
          {list.map(s => {
            const m = SM[s.status] || SM['active'];
            const rc = relCount(s.slug);
            const faqs = s.documents.filter(d => d.type === 'faq').length;
            let meta = s.documents.length + (s.documents.length === 1 ? ' doc' : ' docs');
            if (faqs) meta += ` · ${faqs} FAQ${faqs > 1 ? 's' : ''}`;
            if (rc) meta += ` · ${rc} transition${rc > 1 ? 's' : ''}`;
            const description = firstSentence(s.notes);
            const showDescription = description && description !== s.name;
            return (
              <button key={s.slug} onClick={() => onSelect(s.slug)} className="si-catalog-row-mobile">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a8377', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.status.replace(/-/g, ' ')}</span>
                  <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: m.c, background: m.bg, padding: '4px 9px', borderRadius: 7, whiteSpace: 'nowrap' }}>{m.label}</span>
                  </span>
                </div>
                <div style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 18, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 4 }}>{s.name}</div>
                {showDescription && <div style={{ fontSize: 13, color: '#6b655b', lineHeight: 1.45, maxHeight: 38, overflow: 'hidden' }}>{description}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 9 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: '#211e19' }}>{s.current_version ? `v${s.current_version}` : 'n/a'}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#a8a195', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</span>
                </div>
              </button>
            );
          })}
          {list.length === 0 && <div style={{ textAlign: 'center', padding: 44, color: '#a08f6a', fontSize: 14 }}>No standards match your filters.</div>}
        </section>
      </div>
    </div>
  );
}

export default function CatalogIsland({ data, initialSelected }: { data: AppData; initialSelected?: string | null }) {
  const [query, setQuery]             = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sort, setSort]               = useState('name');
  const [selected, setSelected]       = useState<string | null>(initialSelected ?? null);

  if (!data) return <div style={{ padding: 40, color: 'red', fontFamily: 'monospace' }}>Error: props.data is undefined</div>;
  const { standards, relationships, faqs } = data;
  const selectedStd = standards.find(s => s.slug === selected) ?? null;

  return (
    <ErrorBoundary>
      <>
        <RadarStrip standards={standards} relationships={relationships} onSelect={setSelected} />
        <CatalogView standards={standards} relationships={relationships} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} sort={sort} setSort={setSort} onSelect={setSelected} />
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
