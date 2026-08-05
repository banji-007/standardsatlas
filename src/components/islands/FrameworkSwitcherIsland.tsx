import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSheetA11y, useDragToDismiss } from './shared';

const FRAMEWORKS = [
  { name: 'PCI', live: true },
  { name: 'ISO 27001', live: false },
  { name: 'DORA', live: false },
  { name: 'SOC 2', live: false },
  { name: 'NIST CSF', live: false },
];

function FrameworkSheet({ onClose }: { onClose: () => void }) {
  const headingId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useSheetA11y(sheetRef, closeBtnRef, onClose);
  const { dragY, dragging, onGrab } = useDragToDismiss(onClose);

  // Portalled to document.body for the same reason DetailSheet is (see
  // shared.tsx): this island mounts inside the header, and the header's
  // own backdrop-filter creates a containing block for position:fixed
  // descendants, which would otherwise anchor this sheet to the header's
  // box instead of the viewport.
  return createPortal(
    <>
      <div onClick={onClose} aria-hidden="true" className="si-sheet-scrim" />
      <aside
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="si-sheet si-fwsheet"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : 'transform var(--duration-base) cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div onMouseDown={onGrab} onTouchStart={onGrab} className="si-sheet-grab">
          <div className="si-sheet-grab-bar" />
        </div>
        <div className="si-fwsheet-header">
          <h3 id={headingId} className="si-fwsheet-title">Framework</h3>
          <button ref={closeBtnRef} onClick={onClose} aria-label="Close" className="si-sheet-close">✕</button>
        </div>
        <p className="si-fwsheet-sub">PCI is live. The others are being sourced and verified the same way.</p>
        <div className="si-fwsheet-list">
          {FRAMEWORKS.map(f => (
            <div key={f.name} className={`si-fwsheet-row${f.live ? ' si-fwsheet-row--live' : ''}`}>
              <span className="si-fwsheet-name">{f.name}</span>
              <span className={`mono si-fwsheet-tag${f.live ? ' si-fwsheet-tag--live' : ''}`}>{f.live ? 'Live' : 'Soon'}</span>
            </div>
          ))}
        </div>
      </aside>
    </>,
    document.body
  );
}

export default function FrameworkSwitcherIsland() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mobile-fw-pill"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>PCI</span>
        <span aria-hidden="true" className="mobile-fw-caret">▾</span>
      </button>
      {open && <FrameworkSheet onClose={() => setOpen(false)} />}
    </>
  );
}
