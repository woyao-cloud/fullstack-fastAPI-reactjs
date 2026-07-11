# Task 6 Report — SystemConfig / ConfigHistory / EmailTemplate 仓储

## Status: DONE

## Commit
- SHA: `1065e8e79409667586363cc4d9ef9f29111e7734`
- Subject: `feat(config): SystemConfig/ConfigHistory/EmailTemplate 仓储`

## Files
- Created: `app/repositories/system_config_repository.py`
- Created: `tests/test_system_config_repository.py`
- Modified: `app/domain/models/system_config.py` (added `server_default=func.now()` on `ConfigHistory.changed_at`)
- Modified: `tests/conftest.py` (added `import app.domain.models.system_config` so engine fixture creates the 3 new tables)

## Implementation
Three repository classes following the existing `DepartmentRepository` pattern (constructor takes `AsyncSession`, methods use `select`/`func`, `flush()` only — service commits):

- `SystemConfigRepository`: `get_by_key`, `list_by_group`, `list_keys(group=None)` (ordered by group,key), `upsert` (insert-or-update by key, only overwrites description when not None)
- `ConfigHistoryRepository`: `add` (flush, return row), `list_by_key` (ordered by `changed_at desc`)
- `EmailTemplateRepository`: `get_by_id` (via `db.get`), `get_by_code`, `list(page,size)` returning `(items, total)`, `add` (flush, return tpl), `delete`

No commit inside any repo method — callers (tests + future services) commit.

## Testing
- `uv run pytest tests/test_system_config_repository.py -v` → 4 passed
- Full suite `uv run pytest` → 92 passed, 0 failed (no regression)

## Deviation from brief (justified)
Brief code is verbatim in the repo + test files. Two small non-brief edits were required to make the verbatim brief code pass:

1. **`tests/conftest.py`** — added `import app.domain.models.system_config`. Without it, the `engine` fixture's `Base.metadata.create_all` does not create the `system_config` / `config_history` / `email_template` tables, and every test in the new file fails with "no such table". The existing `tests/test_system_config_model.py` already does this import locally for the same reason; conftest was simply missing it.
2. **`app/domain/models/system_config.py`** — added `server_default=func.now()` to `ConfigHistory.changed_at` (also imported `func`). The brief's `ConfigHistoryRepository.add` and test do not pass `changed_at`, and the column is `nullable=False` with no default. Without a server default, insert fails with `NOT NULL constraint failed: config_history.changed_at`. This is a minimal model fix consistent with how `Base.created_at`/`updated_at` already use `server_default=func.now()`.

Both edits are out-of-scope of the repository code itself but are the smallest possible changes that let the brief's verbatim code run. They do not alter any brief-specified method signature, name, or behavior.

## Self-review
- Completeness: 3 repos, upsert insert+update paths, list_by_group, list_keys, history add/list, template CRUD+list pagination — all present and exercised.
- Quality: matches `DepartmentRepository` style (flush-only, return entity, `select`/`func`).
- Discipline: no extra methods, no commit in repo methods, single new repo file.
- Testing: real SQLite via shared `engine`/`seed` fixtures, no mocks; output clean (only pre-existing unrelated warnings).

## Skills / plugins / agents used
- Skill: `superpowers:test-driven-development` (write failing test → implement → pass → full regression)
- Skill: `superpowers:verification-before-completion` (ran full suite, confirmed no regression)
- Plugins/agents: none