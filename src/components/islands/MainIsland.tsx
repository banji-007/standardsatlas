import React, { useState, useEffect, useRef } from 'react';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null };
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

// --- Types ---
interface Doc {
  slug: string; title: string; type: string; published: string | null;
  applies_to_version: string | null; source_url: string | null; verified: boolean;
}
interface Ver {
  version: string; published: string | null; retired: string | null;
  status: string; source_url: string | null; verified: boolean;
}
export interface StdData {
  slug: string; name: string; status: string; source_url: string;
  verified: boolean; last_verified: string | null; current_version: string | null;
  notes?: string; versions: Ver[]; documents: Doc[];
}
export interface RelData {
  id: string; type: 'associate' | 'supersede' | 'converge';
  from: string; to: string | string[];
  state: 'planned' | 'in-progress' | 'complete';
  effective_date: string | null; description: string | null;
  source_url: string; verified: boolean;
}
export interface AppData {
  standards: StdData[]; relationships: RelData[]; lastVerified: string;
}

// --- Constants ---
const ACCENT = '#1f5f5b';

const SM: Record<string, { label: string; c: string; bg: string; dot: string }> = {
  'active':           { label: 'Active',           c: '#1f7a4d', bg: '#e7f3ec', dot: '#2a9d63' },
  'under-review':     { label: 'Under review',     c: '#3a4f9e', bg: '#e9ecfb', dot: '#5a6fd0' },
  'sunset-scheduled': { label: 'Sunset scheduled', c: '#9a6512', bg: '#fbf0db', dot: '#d39314' },
  'retired':          { label: 'Retired',          c: '#6b6760', bg: '#ece9e3', dot: '#9a948b' },
  'forthcoming':      { label: 'Forthcoming',      c: '#2f6f9e', bg: '#e6f0f7', dot: '#4a8fc0' },
};

const GRAPH_LABEL: Record<string, string> = {
  'pci-dss':         'PCI DSS',
  'p2pe':            'P2PE',
  'secure-software': 'Secure Software',
  'secure-slc':      'Secure SLC',
  'pts-poi':         'PTS POI',
  'pts-hsm':         'PTS HSM',
  'pin-security':    'PIN Security',
  'cpp-logical':     'CPP Logical',
  'cpp-physical':    'CPP Physical',
  '3ds-core':        'PCI 3DS Core',
  '3ds-sdk':         'PCI 3DS SDK',
  'mpoc':            'MPoC',
  'spoc':            'SPoC',
  'cpoc':            'CPoC',
  'tsp':             'TSP',
  'pa-dss':          'PA-DSS',
  'kmo':             'KMO',
};

const DT: Record<string, { label: string; order: number; c: string; bg: string }> = {
  'standard':      { label: 'Standard',      order: 0, c: '#1f5f5b', bg: '#e6f0ef' },
  'guidance':      { label: 'Guidance',      order: 1, c: '#3a4f9e', bg: '#e9ecfb' },
  'faq':           { label: 'FAQ',           order: 2, c: '#7a4f8e', bg: '#f1ebf4' },
  'saq':           { label: 'SAQ',           order: 3, c: '#8a6512', bg: '#f6ecd8' },
  'template':      { label: 'Template',      order: 4, c: '#6b6760', bg: '#ece9e3' },
  'supplemental':  { label: 'Supplemental',  order: 5, c: '#6b6760', bg: '#ece9e3' },
  'bulletin':      { label: 'Bulletin',      order: 6, c: '#9a6512', bg: '#fbf0db' },
  'report':        { label: 'Report',        order: 7, c: '#6b6760', bg: '#ece9e3' },
  'program-guide': { label: 'Program guide', order: 8, c: '#3a4f9e', bg: '#e9ecfb' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// --- Utilities ---
function fmt(d: string | null): string {
  if (!d) return 'TBD';
  const p = String(d).split('-');
  return MONTHS[(+p[1] || 1) - 1] + ' ' + p[0];
}

function toX(d: string): number {
  const p = String(d).split('-');
  const v = +p[0] + ((+p[1] || 1) - 1) / 12;
  return Math.max(0, Math.min(100, (v - 2016) / 12 * 100));
}

function monthsAway(d: string): number {
  const p = String(d).split('-');
  const now = new Date();
  return (+p[0] - now.getFullYear()) * 12 + ((+p[1] || 1) - (now.getMonth() + 1));
}

function relTime(d: string): string {
  const ma = monthsAway(d);
  return ma > 0 ? `in ${ma} mo` : ma < 0 ? `${Math.abs(ma)} mo ago` : 'this month';
}

function firstSentence(text?: string): string {
  if (!text) return '';
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

// --- SiteHeader ---
function SiteHeader({ view, setView }: { view: string; setView: (v: string) => void }) {
  const navBtn = (v: string, label: string) => {
    const active = view === v;
    return (
      <button key={v} onClick={() => setView(v)} className="si-header-navbtn" style={{ border: 'none', fontSize: 13.5, fontWeight: active ? 600 : 500, cursor: 'pointer', background: active ? '#fbf7ee' : 'transparent', color: active ? ACCENT : '#6b655b', boxShadow: active ? '0 1px 2px rgba(0,0,0,.08)' : 'none', transition: 'all 150ms', fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
        {label}
      </button>
    );
  };
  return (
    <header className="si-header">
      <div className="si-header-inner">
        <div className="si-header-brand">
          <div style={{ width: 30, height: 30, borderRadius: 8, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 17, height: 17, borderRadius: '50%', border: '1.5px solid rgba(251,247,238,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbf7ee' }} />
            </div>
          </div>
          <span className="si-header-brandtext">Security Standards Map</span>
        </div>
        <nav className="si-header-nav" aria-label="Site sections">
          {navBtn('catalog', 'Catalog')}
          {navBtn('timeline', 'Timeline')}
          {navBtn('transitions', 'Transitions')}
        </nav>
        <a href="https://github.com/banji-007/standardsatlas" target="_blank" rel="noopener noreferrer" className="si-header-source" style={{ color: '#6b655b', textDecoration: 'none', borderBottom: '1px solid #d3cbbb', paddingBottom: 1 }}>Source</a>
      </div>
    </header>
  );
}

// --- FrameworkBar ---
function FrameworkBar() {
  const fws = [
    { name: 'PCI DSS', live: true }, { name: 'ISO 27001', live: false },
    { name: 'DORA', live: false }, { name: 'SOC 2', live: false }, { name: 'NIST CSF', live: false },
  ];
  return (
    <div className="si-frameworkbar">
      <div className="si-frameworkbar-inner">
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.1em', color: '#9a9384', flexShrink: 0 }}>Framework</span>
        <div style={{ display: 'flex', gap: 7 }}>
          {fws.map(f => (
            <div key={f.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 8, border: `1px solid ${f.live ? ACCENT : '#ddd5c5'}`, background: f.live ? ACCENT : 'transparent', color: f.live ? '#fbf7ee' : '#a39a89', fontSize: 12.5, fontWeight: f.live ? 600 : 500, whiteSpace: 'nowrap', flexShrink: 0, cursor: f.live ? 'default' : 'not-allowed' }}>
              {f.name}
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8.5, letterSpacing: '.08em', textTransform: 'uppercase', padding: '2px 5px', borderRadius: 4, background: f.live ? 'rgba(251,247,238,0.2)' : '#e2dac9', color: f.live ? '#cde6e2' : '#a39a89' }}>{f.live ? 'Live' : 'Soon'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- HeroSection ---
function HeroSection({ total, active, sunset, docs, lastVerified }: { total: number; active: number; sunset: number; docs: number; lastVerified: string }) {
  const stat = (val: number, label: string, color?: string) => (
    <div key={label}>
      <div style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 30, fontWeight: 600, lineHeight: 1, ...(color ? { color } : {}) }}>{val}</div>
      <div style={{ fontSize: 12.5, color: '#8a8377', marginTop: 3, letterSpacing: '.02em' }}>{label}</div>
    </div>
  );
  return (
    <section className="si-section si-hero">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2a9d63', display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: '#6b655b', letterSpacing: '.02em' }}>Independent reference. Last verified {fmt(lastVerified)}.</span>
      </div>
      <h1 style={{ fontFamily: "'Newsreader',Georgia,serif", fontWeight: 500, fontSize: 44, lineHeight: 1.08, letterSpacing: '-0.02em', margin: '0 0 16px', maxWidth: 730, color: '#211e19' }}>
        A working map of the PCI security standards.
      </h1>
      <p style={{ fontSize: 16.5, lineHeight: 1.55, color: '#5f594e', maxWidth: 620, margin: '0 0 26px' }}>
        Version history, the supporting documents and FAQs behind each standard, and how standards supersede and converge over time. Sourced to the official PCI SSC site.
      </p>
      <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', borderTop: '1px solid #e0d9cb', paddingTop: 20 }}>
        {stat(total, 'standards tracked')}
        {stat(active, 'currently active', '#1f7a4d')}
        {stat(sunset, 'in sunset / review', '#9a6512')}
        {stat(docs, 'supporting documents', '#3a4f9e')}
      </div>
    </section>
  );
}

// --- RadarStrip ---
// link is optional; when set, clicking the card navigates to that URL instead of opening a drawer.
interface RadarEvent { slug: string; name: string; type: string; date: string; note: string; link?: string; }

const EV_META: Record<string, { c: string; bg: string }> = {
  'New version':  { c: '#1f5f5b', bg: '#e6f0ef' },
  'FAQ updates':  { c: '#7a4f8e', bg: '#f1ebf4' },
  'New guidance': { c: '#3a4f9e', bg: '#e9ecfb' }, 'New bulletin':{ c: '#9a6512', bg: '#fbf0db' },
  'Sunset':       { c: '#9a6512', bg: '#fbf0db' }, 'Convergence': { c: '#b5562f', bg: '#f7e7df' },
  'Superseded':   { c: '#6b6760', bg: '#ece9e3' }, 'Alignment':   { c: '#3a4f9e', bg: '#e9ecfb' },
  'Under review': { c: '#3a4f9e', bg: '#e9ecfb' },
};

function buildRadar(standards: StdData[], relationships: RelData[]): RadarEvent[] {
  const now = new Date();
  const cutoff = `${now.getFullYear() - 2}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const events: RadarEvent[] = [];

  standards.forEach(s => {
    s.versions.forEach(v => {
      if (v.published) events.push({ slug: s.slug, name: s.name, type: 'New version', date: v.published, note: `Version ${v.version} published.` });
      if (v.retired && v.status === 'sunset-scheduled') events.push({ slug: s.slug, name: s.name, type: 'Sunset', date: v.retired, note: `v${v.version} scheduled to sunset.` });
    });
    if (s.status === 'under-review') events.push({ slug: s.slug, name: s.name, type: 'Under review', date: s.last_verified || '', note: 'Standard under active development and review.' });
    // FAQs are excluded here; they are aggregated below to avoid flooding the radar.
    const nd = s.documents.filter(d => d.published && d.published >= cutoff && d.type !== 'faq')
      .sort((a, b) => String(b.published).localeCompare(String(a.published)))[0];
    if (nd?.published) {
      const t = nd.type === 'guidance' ? 'New guidance' : nd.type === 'bulletin' ? 'New bulletin' : null;
      if (t) events.push({ slug: s.slug, name: s.name, type: t, date: nd.published, note: nd.title.slice(0, 82) + (nd.title.length > 82 ? '…' : '') });
    }
  });

  relationships.forEach(r => {
    if (!r.effective_date) return;
    const t = r.type === 'converge' ? 'Convergence' : r.type === 'supersede' ? 'Superseded' : 'Alignment';
    events.push({ slug: r.from, name: standards.find(s => s.slug === r.from)?.name ?? r.from, type: t, date: r.effective_date, note: r.description ? r.description.split(/;|\.\s/)[0] + '.' : '' });
  });

  // Aggregate all recent FAQ documents across standards into a single card.
  const recentFaqs = standards.flatMap(s =>
    s.documents.filter(d => d.type === 'faq' && d.published && d.published >= cutoff)
  );
  if (recentFaqs.length > 0) {
    const latest = recentFaqs.slice().sort((a, b) => String(b.published).localeCompare(String(a.published)))[0]!;
    events.push({
      slug: '_faqs',
      name: 'FAQ activity',
      type: 'FAQ updates',
      date: latest.published!,
      note: `${recentFaqs.length} FAQ${recentFaqs.length > 1 ? 's' : ''} updated in this period.`,
      link: '/faqs',
    });
  }

  const seen = new Set<string>();
  return events.filter(e => e.date >= cutoff).sort((a, b) => b.date.localeCompare(a.date))
    .filter(e => { const k = e.slug + e.type + e.date; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
}

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

// --- CatalogView ---
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

  return (
    <div>
      <section className="si-section si-catalog-toprow">
        <div className="si-search-row">
          <div className="si-search-box">
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#a8a195', fontSize: 14 }}>⌕</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search standards, families, keywords…" className="si-search-input" />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)} className="si-sort-select">
            <option value="name">Sort: A–Z</option>
            <option value="status">Sort: Status</option>
            <option value="recent">Sort: Most recent release</option>
            <option value="docs">Sort: Most documents</option>
          </select>
        </div>
        <div className="si-filter-chips">
          {[{ label: 'All', value: 'All' }, ...present.map(k => ({ label: SM[k]?.label ?? k, value: k }))].map(o => {
            const m = o.value !== 'All' ? SM[o.value] : null;
            return <button key={o.value} onClick={() => setStatusFilter(o.value)} className="si-filter-chip" style={chip(statusFilter === o.value, m?.c, m?.bg)}>{o.label}</button>;
          })}
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: '#a08f6a', marginTop: 16, letterSpacing: '.03em' }}>
          {list.length === standards.length ? `${standards.length} standards · ${totalDocs} documents` : `${list.length} of ${standards.length} standards`}
        </div>
      </section>

      <section className="si-section si-catalog-list-section">
        {list.map(s => {
          const m = SM[s.status] || SM['active'];
          const rc = relCount(s.slug);
          const faqs = s.documents.filter(d => d.type === 'faq').length;
          let meta = s.documents.length + (s.documents.length === 1 ? ' doc' : ' docs');
          if (faqs) meta += ` · ${faqs} FAQ${faqs > 1 ? 's' : ''}`;
          if (rc) meta += ` · ${rc} transition${rc > 1 ? 's' : ''}`;
          return (
            <button key={s.slug} onClick={() => onSelect(s.slug)}
              className="si-catalog-row"
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = ACCENT; el.style.boxShadow = '0 4px 14px rgba(31,95,91,.10)'; el.style.transform = 'translateY(-1px)'; el.style.background = '#fffdf8'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#e7e0d2'; el.style.boxShadow = 'none'; el.style.transform = 'translateY(0)'; el.style.background = '#fbf7ee'; }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8a8377' }}>{s.status.replace(/-/g, ' ')}</span>
                </div>
                <div style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 18, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 3 }}>{s.name}</div>
                <div style={{ fontSize: 13.5, color: '#6b655b', lineHeight: 1.45, marginBottom: 6 }}>{firstSentence(s.notes) || s.name}</div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#a8a195', letterSpacing: '.02em' }}>{meta}</div>
              </div>
              <div className="si-catalog-row-meta">
                <div style={{ textAlign: 'right' }}>
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
  );
}

// --- TimelineView ---
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
                <div key={s.slug} onClick={() => onSelect(s.slug)} className="si-timeline-row" style={{ height: rowH }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(31,95,91,0.04)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
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

// --- TransitionsView ---
interface PhysNode { slug: string; x: number; y: number; vx: number; vy: number; r: number; }
interface PhysEdge { from: string; to: string; type: string; state: string; }

function TransitionsView({ standards, relationships, onSelect }: { standards: StdData[]; relationships: RelData[]; onSelect: (slug: string) => void }) {
  const nodesRef  = useRef<PhysNode[] | null>(null);
  const idxRef    = useRef<Record<string, number>>({});
  const edgesRef  = useRef<PhysEdge[]>([]);
  const dragRef   = useRef<number | null>(null);
  const stageRef  = useRef<HTMLDivElement | null>(null);
  const movedRef  = useRef(false);
  const keRef     = useRef(0);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (nodesRef.current) return;
    nodesRef.current = standards.map((s, i) => {
      const ang = i / standards.length * 6.2832;
      return { slug: s.slug, x: 400 + Math.cos(ang) * 200, y: 260 + Math.sin(ang) * 168, vx: 0, vy: 0, r: Math.min(42, 15 + Math.sqrt(s.documents.length) * 3.4) };
    });
    idxRef.current = {};
    nodesRef.current.forEach((n, i) => { idxRef.current[n.slug] = i; });
    edgesRef.current = [];
    relationships.forEach(r => { (Array.isArray(r.to) ? r.to : [r.to]).forEach(t => edgesRef.current.push({ from: r.from, to: t, type: r.type, state: r.state })); });
  }, []);

  useEffect(() => {
    let rafId: number;
    const step = () => {
      const N = nodesRef.current; if (!N) { rafId = requestAnimationFrame(step); return; }
      let ke = 0;
      for (let i = 0; i < N.length; i++) {
        const a = N[i]; if (dragRef.current === i) continue;
        let fx = (400 - a.x) * 0.009, fy = (260 - a.y) * 0.009;
        for (let j = 0; j < N.length; j++) { if (i === j) continue; const b = N[j]; const dx = a.x - b.x, dy = a.y - b.y, d2 = dx*dx + dy*dy || 0.01, d = Math.sqrt(d2); fx += dx/d * (9500/d2); fy += dy/d * (9500/d2); }
        a.vx = (a.vx + fx * 0.02) * 0.80; a.vy = (a.vy + fy * 0.02) * 0.80;
      }
      edgesRef.current.forEach(ed => {
        const ai = idxRef.current[ed.from], bi = idxRef.current[ed.to], a = N[ai], b = N[bi];
        if (!a || !b) return;
        const dx = b.x-a.x, dy = b.y-a.y, d = Math.sqrt(dx*dx+dy*dy)||0.01, f = (d-150)*0.02, ux = dx/d, uy = dy/d;
        if (dragRef.current !== ai) { a.vx += ux*f; a.vy += uy*f; }
        if (dragRef.current !== bi) { b.vx -= ux*f; b.vy -= uy*f; }
      });
      for (let i = 0; i < N.length; i++) {
        const a = N[i]; if (dragRef.current === i) { a.vx = 0; a.vy = 0; continue; }
        a.x += a.vx; a.y += a.vy; a.x = Math.max(a.r+10, Math.min(790-a.r, a.x)); a.y = Math.max(a.r+10, Math.min(510-a.r, a.y)); ke += a.vx*a.vx + a.vy*a.vy;
      }
      keRef.current = ke;
      if (ke > 0.04 || dragRef.current !== null) setFrame(n => n + 1);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    const onMove = (e: MouseEvent) => {
      if (dragRef.current === null || !stageRef.current || !nodesRef.current) return;
      const r = stageRef.current.getBoundingClientRect(), n = nodesRef.current[dragRef.current];
      if (n) { n.x = (e.clientX - r.left) / r.width * 800; n.y = (e.clientY - r.top) / r.height * 520; n.vx = 0; n.vy = 0; movedRef.current = true; setFrame(n => n + 1); }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  void frame;
  const N = nodesRef.current;
  const RT: Record<string, { label: string; c: string; bg: string }> = {
    converge: { label: 'Converge', c: '#b5562f', bg: '#f7e7df' },
    supersede: { label: 'Supersede', c: '#6b6760', bg: '#ece9e3' },
    associate: { label: 'Associate', c: '#3a4f9e', bg: '#e9ecfb' },
  };
  const RS: Record<string, { label: string; c: string; bg: string }> = {
    planned: { label: 'Planned', c: '#8a8377', bg: '#efe9dd' },
    'in-progress': { label: 'In progress', c: '#9a6512', bg: '#fbf0db' },
    complete: { label: 'Complete', c: '#1f7a4d', bg: '#e7f3ec' },
  };

  return (
    <section className="si-section si-trans-section">
      <h2 style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 24, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-.01em' }}>Transitions &amp; relationships</h2>
      <p style={{ fontSize: 14, color: '#6b655b', margin: '0 0 22px', maxWidth: 680 }}>How standards supersede, converge into, and align with one another. Each orb is a standard, sized by how many supporting documents it carries. Drag to rearrange, or click to open.</p>
      <div className="si-trans-stage-wrap">
        <div ref={stageRef} style={{ position: 'relative', width: 800, height: 520, margin: '0 auto' }}>
          {N && edgesRef.current.map((ed, i) => {
            const a = N[idxRef.current[ed.from]], b = N[idxRef.current[ed.to]]; if (!a || !b) return null;
            const col = ed.type === 'converge' ? '#b5562f' : ed.type === 'supersede' ? '#9a948b' : '#5a6fd0';
            const dx = b.x-a.x, dy = b.y-a.y, len = Math.sqrt(dx*dx+dy*dy), ang = Math.atan2(dy,dx)*180/Math.PI;
            return <div key={i} style={{ position: 'absolute', left: a.x, top: a.y, width: len, transformOrigin: '0 50%', transform: `rotate(${ang}deg)`, opacity: 0.5, pointerEvents: 'none', ...(ed.state === 'planned' ? { height: 0, borderTop: `2px dashed ${col}` } : { height: 2, background: col }) }} />;
          })}
          {N && N.map((p, i) => {
            const s = standards.find(x => x.slug === p.slug)!; const m = SM[s.status] || SM['active'];
            return (
              <div key={p.slug}
                className="si-trans-orb"
                onMouseDown={e => { e.preventDefault(); dragRef.current = i; movedRef.current = false; }}
                onClick={() => { if (movedRef.current) { movedRef.current = false; return; } onSelect(p.slug); }}
                title={s.name}
                style={{ position: 'absolute', left: p.x-p.r, top: p.y-p.r, width: p.r*2, height: p.r*2, borderRadius: '50%', background: m.bg, border: `2px solid ${m.c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', boxShadow: '0 1px 3px rgba(0,0,0,.08)', userSelect: 'none' }}>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 600, color: '#3a3630', pointerEvents: 'none', textAlign: 'center', whiteSpace: 'nowrap' }}>{GRAPH_LABEL[p.slug] ?? s.name}</span>
              </div>
            );
          })}
        </div>
        <div className="si-trans-legend">
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 16, height: 2, background: '#b5562f', display: 'inline-block' }} />converge</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 16, height: 2, background: '#9a948b', display: 'inline-block' }} />supersede</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 16, height: 0, borderTop: '2px dashed #5a6fd0', display: 'inline-block' }} />associate / planned</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {relationships.slice().sort((a, b) => String(b.effective_date||'0').localeCompare(String(a.effective_date||'0'))).map(r => {
          const rt = RT[r.type] || RT.associate, rs = RS[r.state] || RS.planned;
          const tos = (Array.isArray(r.to) ? r.to : [r.to]).map(t => standards.find(s => s.slug === t)?.name ?? t).join(' + ');
          const fromName = standards.find(s => s.slug === r.from)?.name ?? r.from;
          return (
            <div key={r.id} style={{ background: '#fbf7ee', border: '1px solid #e7e0d2', borderRadius: 13, padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 9 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: rt.c, background: rt.bg, padding: '4px 9px', borderRadius: 6 }}>{rt.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: "'Newsreader',Georgia,serif", fontSize: 16, fontWeight: 600 }}>
                  <span>{fromName}</span><span style={{ color: '#b5562f', fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}>→</span><span>{tos}</span>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, fontWeight: 500, color: rs.c, background: rs.bg, padding: '3px 9px', borderRadius: 20 }}>{rs.label}</span>
                <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: '#a08f6a' }}>{r.effective_date ? `eff. ${fmt(r.effective_date)}` : 'date TBD'}</span>
              </div>
              {r.description && <div style={{ fontSize: 13.5, color: '#5f594e', lineHeight: 1.5, maxWidth: 820 }}>{r.description}</div>}
              {r.source_url && <a href={r.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 9, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: ACCENT, textDecoration: 'none', borderBottom: `1px solid #cfe0dd` }}>Source ↗</a>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- DetailDrawer ---
function DetailDrawer({ std, relationships, standards, onClose }: { std: StdData; relationships: RelData[]; standards: StdData[]; onClose: () => void }) {
  const m = SM[std.status] || SM['active'];
  const versions = std.versions.slice().sort((a, b) => String(b.published||'0').localeCompare(String(a.published||'0')));
  const rels = relationships.filter(r => r.from === std.slug || (Array.isArray(r.to) ? r.to.includes(std.slug) : r.to === std.slug));
  const groups: Record<string, Doc[]> = {};
  std.documents.forEach(d => { (groups[d.type] = groups[d.type] || []).push(d); });
  const docGroups = Object.keys(groups).sort((a, b) => (DT[a]?.order ?? 9) - (DT[b]?.order ?? 9)).map(type => ({
    type, label: DT[type]?.label ?? type, meta: DT[type] || { c: '#6b6760', bg: '#ece9e3' },
    items: groups[type].slice().sort((a, b) => String(b.published||'0').localeCompare(String(a.published||'0'))),
  }));
  const tagMap: Record<string, { t: string; c: string; bg: string }> = {
    active: { t: 'current', c: '#1f7a4d', bg: '#e7f3ec' },
    'sunset-scheduled': { t: 'sunset', c: '#9a6512', bg: '#fbf0db' },
    retired: { t: 'retired', c: '#6b6760', bg: '#ece9e3' },
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,24,18,0.42)', zIndex: 40, animation: 'fadeIn .2s ease' }} />
      <aside role="dialog" aria-label={`Details for ${std.name}`} style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(500px, 95vw)', background: '#f7f2e8', zIndex: 50, boxShadow: '-24px 0 60px rgba(0,0,0,.18)', animation: 'drawerIn .26s cubic-bezier(.2,.8,.2,1)', overflowY: 'auto' }}>
        <div style={{ padding: '26px 30px 22px', borderBottom: '1px solid #e7e0d2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8a8377', marginBottom: 6 }}>{std.status.replace(/-/g, ' ')}</div>
              <h2 style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 24, fontWeight: 600, margin: '0 0 4px', letterSpacing: '-.01em' }}>{std.name}</h2>
            </div>
            <button onClick={onClose} aria-label="Close drawer" className="si-drawer-close" style={{ borderRadius: 8, border: '1px solid #e0d9cb', background: '#fbf7ee', color: '#6b655b', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: m.c, background: m.bg, padding: '5px 12px', borderRadius: 7, display: 'inline-block' }}>{m.label}</span>
        </div>
        <div style={{ padding: '24px 30px 60px' }}>
          {std.notes && <p style={{ fontSize: 14, lineHeight: 1.6, color: '#3f3a31', margin: '0 0 22px' }}>{std.notes}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e7e0d2', border: '1px solid #e7e0d2', borderRadius: 11, overflow: 'hidden', marginBottom: 28 }}>
            {[
              { label: 'Current version', value: std.current_version ? `v${std.current_version}` : 'In development', mono: true, color: undefined },
              { label: 'Verification', value: std.verified ? '✓ Verified' : 'Provisional', mono: false, color: std.verified ? '#1f7a4d' : '#a08f6a' },
              { label: 'Last verified', value: fmt(std.last_verified), mono: false, color: undefined },
              { label: 'Documents', value: String(std.documents.length), mono: true, color: undefined },
            ].map(f => (
              <div key={f.label} style={{ background: '#fbf7ee', padding: '13px 16px' }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#a08f6a', marginBottom: 5 }}>{f.label}</div>
                <div style={{ ...(f.mono ? { fontFamily: "'IBM Plex Mono',monospace", fontSize: 14 } : { fontSize: 13.5 }), color: f.color ?? '#211e19', ...(f.color ? { fontWeight: 500 } : {}) }}>{f.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a8377', marginBottom: 16 }}>Version lineage</div>
          {versions.length > 0 ? (
            <div style={{ position: 'relative', paddingLeft: 4, marginBottom: 30 }}>
              {versions.map((v, i) => {
                const tg = tagMap[v.status] || tagMap['active'], isCur = v.status === 'active', dot = SM[v.status]?.dot ?? '#2a9d63';
                return (
                  <div key={v.version} style={{ display: 'flex', gap: 15, paddingBottom: 18 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: isCur ? dot : '#fff', border: `2px solid ${isCur ? dot : '#cfc6b4'}`, flexShrink: 0, marginTop: 2 }} />
                      {i < versions.length - 1 && <div style={{ width: 2, flex: 1, background: '#e2dac9', marginTop: 4, minHeight: 12 }} />}
                    </div>
                    <div style={{ paddingTop: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13.5, fontWeight: 500, color: '#211e19' }}>v{v.version}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: '#a08f6a' }}>{fmt(v.published)}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: tg.c, background: tg.bg, padding: '2px 7px', borderRadius: 5 }}>{tg.t}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: '#6b655b', marginTop: 3, lineHeight: 1.45 }}>
                        {v.retired ? `Retired ${fmt(v.retired)}${v.verified ? ' · verified' : ''}` : isCur ? `Current version${v.verified ? ' · verified' : ''}` : v.verified ? 'Verified' : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#a08f6a', marginBottom: 30, padding: '14px 16px', background: '#fbf7ee', border: '1px dashed #e0d9cb', borderRadius: 10 }}>No published versions yet. Standard still in development.</div>
          )}
          {rels.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a8377', marginBottom: 14 }}>Transitions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rels.map(r => {
                  const isFrom = r.from === std.slug;
                  const others = (isFrom ? (Array.isArray(r.to) ? r.to : [r.to]) : [r.from]).map(t => standards.find(s => s.slug === t)?.name ?? t).join(', ');
                  const phrase = r.type === 'supersede' ? (isFrom ? 'Superseded by' : 'Supersedes') : r.type === 'converge' ? (isFrom ? 'Converges into' : 'Convergence from') : 'Aligns with';
                  const rt = { converge: { c: '#b5562f', bg: '#f7e7df' }, supersede: { c: '#6b6760', bg: '#ece9e3' }, associate: { c: '#3a4f9e', bg: '#e9ecfb' } }[r.type] || { c: '#3a4f9e', bg: '#e9ecfb' };
                  return (
                    <div key={r.id} style={{ background: '#fbf7ee', border: '1px solid #ece4d4', borderRadius: 10, padding: '13px 15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: rt.c, background: rt.bg, padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{phrase}</span>
                        <span style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 14, fontWeight: 600 }}>{others}</span>
                        <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#a08f6a' }}>{r.effective_date ? fmt(r.effective_date) : 'TBD'}</span>
                      </div>
                      {r.description && <div style={{ fontSize: 12.5, color: '#6b655b', lineHeight: 1.45 }}>{r.description}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a8377' }}>Supporting documents</div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#a08f6a' }}>{std.documents.length} total</div>
          </div>
          {docGroups.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}>
              {docGroups.map(g => (
                <div key={g.type}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: g.meta.c, background: g.meta.bg, padding: '3px 9px', borderRadius: 6 }}>{g.label}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#b3aa99' }}>{g.items.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: '#ece4d4', border: '1px solid #ece4d4', borderRadius: 9, overflow: 'hidden' }}>
                    {g.items.map(doc => (
                      <a key={doc.slug} href={doc.source_url ?? '#'} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fbf7ee', padding: '10px 13px', textDecoration: 'none', transition: 'background 100ms' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fffdf8'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fbf7ee'}
                      >
                        <span style={{ flexShrink: 0, width: 15, textAlign: 'center', fontSize: 11, color: doc.verified ? '#1f7a4d' : '#cabfa9' }}>{doc.verified ? '✓' : '·'}</span>
                        <span style={{ flex: 1, fontSize: 12.5, color: '#3f3a31', lineHeight: 1.35, minWidth: 0 }}>{doc.title}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#b3aa99', whiteSpace: 'nowrap' }}>{fmt(doc.published)}</span>
                        <span style={{ color: '#bdb4a2', fontSize: 11 }}>↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <a href={std.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: ACCENT, textDecoration: 'none', border: '1px solid #cfe0dd', background: '#eef5f4', padding: '9px 15px', borderRadius: 9 }}>
            View official standard page ↗
          </a>
        </div>
      </aside>
    </>
  );
}

// --- Main export ---
export default function MainIsland({ data, initialView = 'catalog' }: { data: AppData; initialView?: string }) {
  const [view, setView]               = useState(initialView);
  const [query, setQuery]             = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sort, setSort]               = useState('name');
  const [selected, setSelected]       = useState<string | null>(null);
  const [showDocs, setShowDocs]       = useState(false);
  const [docTypes, setDocTypes]       = useState<string[] | null>(null);
  const [tlFull, setTlFull]           = useState(false);

  if (!data) return <div style={{ padding: 40, color: 'red', fontFamily: 'monospace' }}>Error: props.data is undefined</div>;
  const { standards, relationships, lastVerified } = data;
  const active = standards.filter(s => s.status === 'active').length;
  const sunset = standards.filter(s => s.status === 'sunset-scheduled' || s.status === 'under-review').length;
  const docs   = standards.reduce((a, s) => a + s.documents.length, 0);
  const selectedStd = standards.find(s => s.slug === selected) ?? null;

  return (
    <ErrorBoundary>
      <div style={{ minHeight: '100vh', background: '#f1ece1' }}>
        <SiteHeader view={view} setView={setView} />
        <FrameworkBar />
        <HeroSection total={standards.length} active={active} sunset={sunset} docs={docs} lastVerified={lastVerified} />
        {view === 'catalog' && <>
          <RadarStrip standards={standards} relationships={relationships} onSelect={setSelected} />
          <CatalogView standards={standards} relationships={relationships} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} sort={sort} setSort={setSort} onSelect={setSelected} />
        </>}
        {view === 'timeline' && <TimelineView standards={standards} showDocs={showDocs} setShowDocs={setShowDocs} docTypes={docTypes} setDocTypes={setDocTypes} tlFull={tlFull} setTlFull={setTlFull} onSelect={setSelected} />}
        {view === 'transitions' && <TransitionsView standards={standards} relationships={relationships} onSelect={setSelected} />}
        <footer style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px 50px' }}>
          <div style={{ borderTop: '1px solid #e0d9cb', paddingTop: 20, fontSize: 12, color: '#a08f6a', lineHeight: 1.6 }}>
            Independent project, not affiliated with or endorsed by PCI SSC. PCI, PCI DSS, and related marks are trademarks of PCI Security Standards Council LLC. Data: CC BY 4.0 &middot; Code: MIT.
          </div>
        </footer>
        {selectedStd && <DetailDrawer std={selectedStd} relationships={relationships} standards={standards} onClose={() => setSelected(null)} />}
      </div>
    </ErrorBoundary>
  );
}
