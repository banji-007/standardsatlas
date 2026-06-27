# Security Standards Map

An interactive, sourced reference to security-standards frameworks: their standards, versions, relationships, supporting documents, and how they change over time. Currently covering PCI, with other frameworks planned. Built with Astro and deployed to Cloudflare Pages.

## Frameworks

| Framework | Status  | Coverage                                            |
| :-------- | :------ | :-------------------------------------------------- |
| PCI       | Live    | 17 PCI SSC standard families, plus the FAQ corpus   |
| ISO 27001 | Planned | --                                                  |
| DORA      | Planned | --                                                  |
| SOC 2     | Planned | --                                                  |
| NIST CSF  | Planned | --                                                  |

## Governing rule

**Sourced or it does not ship.** Every standard, version, document, and relationship edge must carry a `source_url` pointing to the framework's official authority (PCI SSC for PCI, ISO for ISO, and so on) and `verified: true` before it is presented as authoritative. Entries with `verified: false` render visibly differently and must never be cited as confirmed.

## Project structure

```text
src/
  content/standards/   # One YAML file per standard family
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
  faqs.yaml                # FAQ entries fetched from the source feed
  version-candidates.yaml  # Possible version changes detected by CI
  review-queue.yaml        # Confidence review queue (generated; never edit)

scripts/
  fetch-rss.ts             # Pull new documents from the source feed
  fetch-faqs.ts            # Pull FAQ entries from the source feed
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
pnpm fetch-rss              # Pull latest documents from the source feed
pnpm fetch-rss --dry-run    # Preview what the RSS pipeline would update
pnpm fetch-faqs             # Pull FAQ entries from the source feed
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
3. Set `source_url` to the framework's official page and `verified: true` only after manual confirmation.
4. Run `pnpm validate` -- fix any errors before committing.

## Scope

### PCI (v1)

In scope: PCI DSS, P2PE, Secure Software, Secure SLC, PTS POI, PTS HSM, PIN Security, CPP Logical, CPP Physical, PCI 3DS Core, PCI 3DS SDK, MPoC, SPoC, CPoC, TSP, PA-DSS, KMO.

Out of scope: QSA/ASV/ISA/PFI/CPSA/QPA program material, case studies, and documents whose only RSS category is "Programs and Certification".

Other frameworks are scoped separately as they are added.

## About

Independent project, not affiliated with or endorsed by any standards body. Marks belong to their respective owners. Code under MIT; data under CC BY 4.0, covering the compilation and presentation, not the underlying source documents.