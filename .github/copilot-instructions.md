# GitHub Copilot Instructions

You are assisting with development of this Home Assistant Lovelace custom card project.
The codebase is TypeScript + Lit and builds with Rollup.

Use these instructions as project-specific guardrails when generating, editing, or reviewing code.

## Quick reference

### Core commands

```bash
yarn install
yarn start
yarn build
yarn lint
```

### Primary files

- `src/config-template-card.ts` — main card implementation
- `src/types.ts` — card config and type definitions
- `src/const.ts` — card version constant
- `rollup.config.js` and `rollup.config.dev.js` — production and dev build config

## Architecture and patterns

- The custom element is `custom:config-template-card`.
- Prefer Lit 3 patterns and idiomatic web component structure.
- Keep configuration shape centralized in `src/types.ts`.
- Keep feature logic in small, readable helpers instead of long monolithic methods.

## TypeScript standards

- Use strict, explicit typing; avoid `any` unless there is no practical alternative.
- Use `import type` for type-only imports where appropriate.
- Validate and narrow optional config fields before use.
- Keep public API names stable unless explicitly requested to change them.

## Lit and component guidance

- Use `@property` for public reactive inputs and `@state` for internal state.
- Avoid direct DOM mutation when Lit reactivity can handle updates.
- Preserve existing card lifecycle behavior.
- For card config, validate early in `setConfig` and throw actionable errors.
- Keep `getCardSize` deterministic and aligned with rendered density.

## Home Assistant integration

- Use Home Assistant helpers and conventions from `custom-card-helpers`.
- Support unavailable/loading/error states gracefully.
- Keep Lovelace config compatibility in mind when changing schema or defaults.

## Styling and UX

- Respect Home Assistant theme variables and CSS custom properties.
- Avoid hardcoded colors when theme tokens can be used.
- Keep spacing and typography consistent with existing card styles.
- Ensure layouts work in both compact and wider dashboard widths.

## Build and quality expectations

- Keep `yarn lint` clean for changed code.
- Ensure `yarn build` succeeds after non-trivial changes.
- Do not introduce unrelated refactors in focused changes.
- If updating build tooling, keep dev and prod Rollup configs consistent.

## Safe change workflow

1. Read adjacent code before editing.
2. Implement the smallest viable change.
3. Run relevant checks (`yarn lint`, `yarn build`, or targeted command).
4. Update docs/README when behavior or config changes.
5. Summarize what changed and why.

## Pull request guidance

- Keep PRs focused to one logical change.
- Include screenshots or short clips for visible UI changes.
- Document config changes and migration notes when applicable.
- Call out any follow-up work explicitly instead of bundling extra scope.

## Avoid these common issues

- Adding untyped dynamic config access
- Overriding theme behavior with fixed styles
- Changing output filenames or card tag without explicit request
