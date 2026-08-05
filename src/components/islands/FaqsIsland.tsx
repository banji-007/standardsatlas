import React, { useEffect, useState, useId } from 'react';
import { GRAPH_LABEL, DT } from './shared';

export interface FaqItem {
  number: number;
  title: string;
  updated: string | null;
  standards: string[];
  mapping_method: 'direct' | 'disambiguated' | 'inferred' | 'general' | 'excluded';
  source_url: string;
}

interface Props {
  faqs: FaqItem[];
  allFaqs?: FaqItem[];
}

const PAGE = 20;

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function FaqsDesktopView({ faqs }: Props) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const inputId = useId();

  const q = query.trim().toLowerCase();
  const filtered = q ? faqs.filter(f => f.title.toLowerCase().includes(q)) : faqs;
  const visible  = filtered.slice(0, limit);
  const remaining = filtered.length - limit;

  function handleQuery(v: string) {
    setQuery(v);
    setLimit(PAGE);
  }

  return (
    <section style={{ marginTop: '2rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '0',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
          Frequently Asked Questions
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-text-faint)', fontWeight: 400, marginLeft: '0.5rem' }}>
            {faqs.length}
          </span>
        </h2>
        <span
          aria-hidden="true"
          style={{
            marginLeft: 'auto',
            fontSize: '0.6875rem',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
            transition: 'transform 150ms ease-out',
            transform: open ? 'rotate(180deg)' : 'none',
            display: 'inline-block',
          }}
        >
          ▼
        </span>
      </button>

      {!open && (
        <p style={{ fontSize: '0.78125rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
          {faqs.length} official FAQ{faqs.length !== 1 ? 's' : ''} from PCI SSC -- click to expand
        </p>
      )}

      {open && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor={inputId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
              Search FAQs
            </label>
            <input
              id={inputId}
              type="search"
              value={query}
              onChange={e => handleQuery(e.target.value)}
              placeholder={`Search ${faqs.length} FAQs...`}
              className="faq-search-input"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text)',
                outline: 'none',
                fontFamily: 'var(--font-ui)',
              }}
            />
          </div>

          {filtered.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', padding: '12px 0' }}>
              No FAQs matching &ldquo;{query}&rdquo;
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#ece4d4', border: '1px solid #ece4d4', borderRadius: '9px', overflow: 'hidden' }}>
                {visible.map(faq => {
                  const needsConfirm = faq.mapping_method === 'disambiguated' || faq.mapping_method === 'inferred';
                  return (
                    <a
                      key={faq.number}
                      href={faq.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'var(--color-bg-card)',
                        padding: '9px 13px',
                        textDecoration: 'none',
                        transition: 'background 150ms ease-out',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fffdf8')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-card)')}
                    >
                      <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: '#b3aa99', width: '34px' }}>
                        #{faq.number}
                      </span>
                      <span style={{ flex: 1, fontSize: '0.78125rem', color: '#3f3a31', lineHeight: 1.35, minWidth: 0 }}>
                        {faq.title}
                      </span>
                      {faq.updated && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65625rem', color: '#b3aa99', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {fmtDate(faq.updated)}
                        </span>
                      )}
                      {needsConfirm && (
                        <span
                          title="Standard mapping resolved by title keyword -- confirm before citing"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: '#9a6512', flexShrink: 0, cursor: 'help' }}
                        >
                          ~
                        </span>
                      )}
                      <span style={{ color: '#bdb4a2', fontSize: '0.6875rem', flexShrink: 0 }}>↗</span>
                    </a>
                  );
                })}
              </div>

              {remaining > 0 && (
                <button
                  onClick={() => setLimit(l => l + PAGE)}
                  className="faq-show-more-btn"
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: '8px',
                    padding: '9px',
                    fontSize: '0.78125rem',
                    color: 'var(--color-text-muted)',
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 150ms ease-out',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fffdf8')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-card)')}
                >
                  Show {Math.min(PAGE, remaining)} more ({remaining} remaining)
                </button>
              )}

              <p style={{ marginTop: '8px', fontSize: '0.6875rem', color: '#b3aa99' }}>
                {q ? `${filtered.length} of ${faqs.length} FAQs match` : `Showing ${visible.length} of ${faqs.length}`}
                {' '}&mdash; source: <a href="https://www.pcisecuritystandards.org/faqs/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>pcisecuritystandards.org/faqs ↗</a>
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return active
    ? { border: '1px solid var(--color-accent)', background: 'var(--color-accent)', color: 'var(--color-bg-card)', fontWeight: 600 }
    : { border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' };
}

/* Task 6: concept's mobile FAQ tab is a flat, always-open list (no accordion) with a
   search bar and a result-count line above it, entries shown as two-line cards (meta
   row, then title on its own line) instead of the desktop's single truncated row.
   Task 8: widened from the desktop accordion's general-only 7 entries to the full
   in-scope index (allFaqs, everything but mapping_method 'excluded'), filterable by
   scope chips -- All / General / per-standard -- matching the concept's structure,
   which browses all 284 entries rather than only the general ones. */
function FaqsMobileView({ faqs, allFaqs }: Props) {
  const source = allFaqs ?? faqs;
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [scope, setScope] = useState('All');
  const inputId = useId();

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('standard');
    if (slug && source.some(f => f.standards.includes(slug))) setScope(slug);
  }, []);

  const scopeCounts: Record<string, number> = {};
  source.forEach(f => f.standards.forEach(slug => { scopeCounts[slug] = (scopeCounts[slug] || 0) + 1; }));
  const generalCount = source.filter(f => f.mapping_method === 'general').length;
  const chips = [
    { value: 'All', label: `All ${source.length}` },
    { value: '__general', label: `General ${generalCount}` },
    ...Object.keys(scopeCounts)
      .sort((a, b) => scopeCounts[b] - scopeCounts[a])
      .map(slug => ({ value: slug, label: `${GRAPH_LABEL[slug] ?? slug} ${scopeCounts[slug]}` })),
  ];

  const scoped = scope === 'All' ? source
    : scope === '__general' ? source.filter(f => f.mapping_method === 'general')
    : source.filter(f => f.standards.includes(scope));

  const q = query.trim().toLowerCase();
  const filtered = q ? scoped.filter(f => f.title.toLowerCase().includes(q)) : scoped;
  const visible  = filtered.slice(0, limit);
  const remaining = filtered.length - limit;

  function handleQuery(v: string) {
    setQuery(v);
    setLimit(PAGE);
  }

  function handleScope(v: string) {
    setScope(v);
    setLimit(PAGE);
  }

  return (
    <section className="si-faqm-section">
      <div className="si-faqm-searchwrap">
        <span aria-hidden="true" className="si-faqm-searchicon">⌕</span>
        <label htmlFor={inputId} className="si-faqm-sr-label">Search FAQs</label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={e => handleQuery(e.target.value)}
          placeholder={`Search ${source.length} FAQs`}
          className="si-faqm-search"
        />
      </div>

      <div className="si-faqm-chips">
        {chips.map(c => (
          <button key={c.value} onClick={() => handleScope(c.value)} className="si-filter-chip" style={chipStyle(scope === c.value)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="mono si-faqm-count">
        {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}{q ? ` matching "${query}"` : ''}
      </div>

      {filtered.length === 0 ? (
        <div className="si-faqm-empty">No FAQ entries match.</div>
      ) : (
        <>
          <div className="si-faqm-list">
            {visible.map(faq => {
              const needsConfirm = faq.mapping_method === 'disambiguated' || faq.mapping_method === 'inferred';
              const scopeSlug = faq.standards[0] ?? null;
              const scopeLabel = scopeSlug ? (GRAPH_LABEL[scopeSlug] ?? scopeSlug) : 'General';
              const scopeMeta = scopeSlug ? DT.faq : DT.template;
              return (
                <a key={faq.number} href={faq.source_url} target="_blank" rel="noopener noreferrer" className="si-faqm-row">
                  <div className="si-faqm-row-meta">
                    <span className="mono si-faqm-num">#{faq.number}</span>
                    <span className="mono si-faqm-scopetag" style={{ color: scopeMeta.c, background: scopeMeta.bg }}>{scopeLabel}</span>
                    {faq.updated && <span className="mono si-faqm-date">{fmtDate(faq.updated)}</span>}
                    {needsConfirm && (
                      <span title="Standard mapping resolved by title keyword -- confirm before citing" className="mono si-faqm-flag">~</span>
                    )}
                    <span aria-hidden="true" className="si-faqm-arrow">↗</span>
                  </div>
                  <div className="si-faqm-title">{faq.title}</div>
                </a>
              );
            })}
          </div>

          {remaining > 0 && (
            <button onClick={() => setLimit(l => l + PAGE)} className="si-faqm-more">
              Show {Math.min(PAGE, remaining)} more ({remaining} remaining)
            </button>
          )}

          <p className="mono si-faqm-source">
            source: <a href="https://www.pcisecuritystandards.org/faqs/" target="_blank" rel="noopener noreferrer">pcisecuritystandards.org/faqs ↗</a>
          </p>
        </>
      )}
    </section>
  );
}

export default function FaqsIsland({ faqs, allFaqs }: Props) {
  return (
    <>
      <div data-vp-show="desktop"><FaqsDesktopView faqs={faqs} /></div>
      <div data-vp-show="mobile"><FaqsMobileView faqs={faqs} allFaqs={allFaqs} /></div>
    </>
  );
}
