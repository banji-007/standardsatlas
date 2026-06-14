# PCI Standards Atlas — Claude Code handoff

## The one governing rule
**Sourced or it does not ship.** Every standard, version, document, and relationship edge must carry `source_url` (pointing to an official PCI SSC URL) and `verified: true` before it is presented as authoritative. Entries with `verified: false` are provisional — they render visibly differently and must never be cited as confirmed.

## Scope boundary
In scope: the 17 PCI security standard families listed in the project brief (PCI DSS, P2PE, Secure Software, Secure SLC, PTS POI, PTS HSM, PIN Security, CPP Logical, CPP Physical, PCI 3DS Core, PCI 3DS SDK, MPoC, SPoC, CPoC, TSP, PA-DSS, KMO).

Out of scope for v1: QSA/ASV/ISA/PFI/CPSA/QPA program material, case studies, and any document whose only RSS category facet is "Programs and Certification".

## Data files
Standards live in `src/content/standards/<slug>.yaml` (one per family). Relationships and external bodies are in `data/relationships.yaml` and `data/external-bodies.yaml`. The Zod schema in `src/lib/schema.ts` is authoritative.

Run `pnpm validate` before any commit touching data files. Run `pnpm fetch-rss --dry-run` to preview what the RSS pipeline would update.

## Code conventions
- No em dashes in prose (use — or rewrite)
- No substantive code comments; only write a comment when the WHY is non-obvious
- No unsourced nodes or edges
- Status is never encoded by color alone — always text label + glyph alongside the color
- Design tokens in `src/styles/tokens.css` are the single source; Cytoscape styles are derived from `src/lib/tokens.ts` (same values) so the graph never drifts from the page
