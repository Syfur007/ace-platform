# Contributing

Please follow these guidelines when contributing to the monorepo:

- Update the relevant package under `apps/` or `packages/`.
- API contract changes must be reflected in `packages/api-specs/openapi.yaml` and have accompanying client or server updates.
- Backend domain logic must stay under `apps/backend/internal`.
- Add tests for any behavioral changes and update `docs/` as needed.
- Open a PR titled clearly and list moved files, mapping tables and a checklist of actions.
