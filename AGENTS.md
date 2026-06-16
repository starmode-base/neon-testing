- When writing prose, don't narrate your own process
- Never use title case
- Test expected behavior, never implementation logic
- Before finishing, `bun run check` must pass

## Tests

- `src/**/*.test.ts` – Vitest: pure logic, no Neon
- `tests-vitest/` – Vitest\*: live-Neon integration
- `tests-bun/` – Bun\*: same suite as `tests-vitest/`
- `examples/` – Vitest: usage docs; keep readable, no harness indirection

\*byte-identical except each `neon-testing.ts`, enforced by `bun run check:drift`
