# PCI Security Standards Map

An interactive reference map of the 17 PCI Security Standards Council standard families, their versions, relationships, and supporting documents. Built with Astro and deployed to Cloudflare Pages.

## Governing rule

**Sourced or it does not ship.** Every standard, version, document, and relationship edge must carry a `source_url` pointing to an official PCI SSC page and `verified: true` before it is presented as authoritative. Entries with `verified: false` render visibly differently and must never be cited as confirmed.

## Project structure

```text
src/
  content/standards/   # One YAML file per standard family (17 total)
  components/islands/  # React islands: main map, graph, timeline, FAQs
  lib/
    schema.ts          # Zod schemas -- authoritative data contract
    tokens.ts          # Design tokens mirrored for Cytoscape
  styles/
    tokens.css         # Single source of design tokens
  pages/
    index.astro        # Main map page
    faqs.astro         # FAQ browser

data/
  relationships.yaml       # Cross-standard relationship edges
  external-bodies.yaml     # External standards referenced (ISO, NIST, etc.)
  faqs.yaml                # FAQ entries fetched from PCI SSC RSS
  version-candidates.yaml  # Possible version changes detected by CI
  review-queue.yaml        # Confidence review queue (generated; never edit)

scripts/
  fetch-rss.ts             # Pull new documents from PCI SSC RSS
  fetch-faqs.ts            # Pull FAQ entries from PCI SSC RSS
  check-versions.ts        # Detect possible new versions in incoming docs
  generate-review-queue.ts # Compute confidence bands for all entities
  validate-data.ts         # Schema-validate all data files
  check-links.ts           # Verify source_url reachability
```

## Development

```sh
pnpm install
pnpm dev          # localhost:4321
pnpm build
pnpm preview
```

## Data scripts

```sh
pnpm validate               # Schema-validate all data files (run before every commit touching data)
pnpm fetch-rss              # Pull latest documents from PCI SSC RSS feed
pnpm fetch-rss --dry-run    # Preview what the RSS pipeline would update
pnpm fetch-faqs             # Pull FAQ entries from PCI SSC RSS feed
pnpm check-versions         # Write data/version-candidates.yaml
pnpm generate-review-queue  # Write data/review-queue.yaml (confidence bands)
pnpm check-links            # Verify all source_url values are reachable
```

## CI

`.github/workflows/rss-refresh.yml` runs daily at 06:00 UTC: fetch RSS, fetch FAQs, check versions, generate review queue, commit any changes. Cloudflare Pages rebuilds automatically on push to `main`.

`.github/workflows/deploy.yml` runs on every push to `main`: validate data, build, deploy to Cloudflare Pages.

## Adding or updating a standard

1. Edit or create `src/content/standards/<slug>.yaml`.
2. Follow the Zod schema in `src/lib/schema.ts`.
3. Set `source_url` to the official PCI SSC page and `verified: true` only after manual confirmation.
4. Run `pnpm validate` -- fix any errors before committing.

## Scope

In scope (v1): PCI DSS, P2PE, Secure Software, Secure SLC, PTS POI, PTS HSM, PIN Security, CPP Logical, CPP Physical, PCI 3DS Core, PCI 3DS SDK, MPoC, SPoC, CPoC, TSP, PA-DSS, KMO.

Out of scope (v1): QSA/ASV/ISA/PFI/CPSA/QPA program material, case studies, and documents whose only RSS category is "Programs and Certification".
