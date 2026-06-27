import { useState, useId } from 'react';

export interface FaqItem {
  number: number;
  title: string;
  updated: string | null;
  mapping_method: 'direct' | 'disambiguated' | 'inferred' | 'general' | 'excluded';
  source_url: string;
}

interface Props {
  faqs: FaqItem[];
}

const PAGE = 20;

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

export default function FaqsIsland({ faqs }: Props) {
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
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                fontSize: '0.8125rem',
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
