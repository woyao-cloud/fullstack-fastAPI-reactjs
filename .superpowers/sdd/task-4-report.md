# Task 4 Report — RedisDepartmentCache

## Status
DONE

## What was implemented
- Created `user-service/back-end/app/core/cache/redis_cache.py`:
  - `RedisDepartmentCache` implementing the `DepartmentCache` Protocol with 5 methods (`get_tree`, `set_tree`, `get_subtree_ids`, `set_subtree_ids`, `invalidate`).
  - `build_redis_client()` async factory that reads `settings.REDIS_URL`, builds `redis.asyncio.Redis.from_url(..., decode_responses=True)`, and pings before returning.
  - Key constants: `TREE_KEY = "um:dept:tree"`, `SUBTREE_PREFIX = "um:dept:subtree:"`, `TTL_SECONDS = 30 * 60`.
  - JSON serialization via `json.dumps` / `json.loads`; `None` returned when key missing.
  - Degradation: every method wraps body in `try/except Exception` and logs a warning (no raise), matching the brief verbatim including `# noqa: BLE001`.
- Appended 3 tests + `FakeRedis` in-memory async double to `user-service/back-end/tests/test_cache.py`:
  - `test_redis_cache_set_get_tree` — round-trip nested dict list.
  - `test_redis_cache_invalidate_clears_keys` — verifies tree key and all `um:dept:subtree:*` keys cleared.
  - `test_redis_cache_subtree_ids_roundtrip` — miss then set then hit returns `["1","2","3"]`.

## TDD
- RED: ran `uv run pytest tests/test_cache.py -v` after appending tests but before creating `redis_cache.py` → 3 failed with `ModuleNotFoundError: app.core.cache.redis_cache`, 3 passed (existing).
- GREEN: created `redis_cache.py`, re-ran → 6 passed in 0.91s.
- Full suite: `uv run pytest` → 33 passed, 27 warnings (pre-existing, unrelated to cache).

## Files changed
- `user-service/back-end/app/core/cache/redis_cache.py` (new, 47 lines)
- `user-service/back-end/tests/test_cache.py` (+71 lines appended)

## Commit
- SHA: `5c3b8ee6bf8117526a46d7815ad34eb9663e8fe9`
- Subject: `feat(cache): RedisDepartmentCache(key 规约/序列化/降级)`
- Branch: `feat/department-management`

## Self-review
- Completeness: all 5 Protocol methods + `build_redis_client` + key constants + TTL 30min + try/except degradation present.
- Quality: verbatim per brief; no over-engineering; factory in `__init__.py` left untouched (already references correct import); tests exercise real serialization round-trip through `FakeRedis` (no real Redis connection).
- Discipline: single new file, no doc files created, no unnecessary edits.
- Testing: `FakeRedis.scan` returns bytes-encoded keys; `invalidate` decodes bytes-or-str keys before re-delete. Verified subtree keys cleared and tree key cleared.

## Deviations / Concerns
- None. Implementation matches the brief byte-for-byte. The broad `except Exception` is intentional (degradation) and kept with `# noqa: BLE001`.
- Pre-existing warnings in unrelated test files (SAWarning on FK cycle, sync tests marked async) noted but out of scope.

## SKILLs / plugins / agents used
- Skill: superpowers:test-driven-development (RED→GREEN cycle followed)
- Skill: superpowers:verification-before-completion (full suite run)
- Plugins: oh-my-claudecode (notepad/wiki not needed for this task)
- Agents: none spawned (direct implementation per CLAUDE.md "answer directly")