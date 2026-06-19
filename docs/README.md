# Documentation

Project documentation for this template and the apps built from it.

## Contents

- [`adr/`](./adr) — Architecture Decision Records: the _why_ behind the stack
  and conventions. Read these before changing foundational tooling.
- [`maintenance/`](./maintenance) — operational runbooks for keeping the
  template healthy (dependency updates, lockfile recovery, etc.).

## Conventions

- Decisions that shape the architecture or are costly to reverse get an ADR.
- Each ADR is immutable once `Accepted`; to change a decision, add a new ADR
  that supersedes the old one (and mark the old one `Superseded by ADR-XXXX`).
- Operational how-tos that aren't decisions go in `maintenance/`.
