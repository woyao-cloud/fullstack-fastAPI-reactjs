# Task 5 Report: RedisPubSubConfigCache (pub/sub 即时失效)

## Status: DONE_WITH_CONCERNS

## Commit
- SHA: `a7e4d085c8d56fa6bd2b24b0dd38c2d8e3ad421f`
- Subject: `feat(config): RedisPubSubConfigCache(pub/sub 即时失效)`

## Test Summary
`tests/test_config_cache.py`: 7 passed. Full suite: 88 passed, 0 failed (no regression).

## What Was Done
1. Appended `FakeRedis` test double + 2 new tests to `tests/test_config_cache.py` per brief (verbatim).
2. Confirmed the 2 new tests FAIL with `ModuleNotFoundError` before implementation.
3. Created `app/core/redis_config_cache.py` with:
   - `build_redis_client()` — lazily imports settings, builds `Redis.from_url(REDIS_URL, decode_responses=True)`, pings, returns client.
   - `RedisPubSubConfigCache(client)` — composes `LocalTTLCache` + pub/sub.
   - `get_group` / `set_group` delegate to local.
   - `invalidate(group=None)` invalidates local then publishes `{group}` (or `*`) on channel `config-change`, wrapped in try/except for degradation.
   - `start_subscriber()` subscribes to `config-change`, loops on `get_message`, invalidates local on message (`*`/None → full clear), re-raises `asyncio.CancelledError`, swallows other exceptions with a warning.
4. Ran tests: 7 passed. Full suite: 88 passed, no regression.
5. Committed on `feat/system-config`.

## Deviations from Brief (Concerns)
The brief's `start_subscriber` uses `async for msg in pubsub.listen()`, but the brief's own `FakeRedis._PubSub` does not implement `listen()` — only `get_message` / `subscribe` / `push` / `close`. Following the brief verbatim would make `test_redis_cache_subscriber_invalidates_local` fail (AttributeError on `listen`).

To stay faithful to the brief's intent while satisfying the test double's contract, `start_subscriber` was implemented as a `get_message` polling loop (`timeout=1.0`, `await asyncio.sleep(0.05)` on None) instead of `pubsub.listen()`. Functionally equivalent for the real `redis.asyncio` client (which supports both `listen()` and `get_message`).

Additionally, `FakeRedis` pushes messages as `types.SimpleNamespace(type=..., channel=..., data=...)`, while real redis-py returns dict-like messages. The message extraction handles both via `isinstance(msg, dict)` checks (`msg.get(...)` vs `getattr(msg, ...)`). This keeps the test double working and remains compatible with the real client.

The unused `import json` from the brief was omitted (ruff F401 would flag it; payload is a plain group string, not JSON).

## Self-Review
- Completeness: `build_redis_client` ✓, `RedisPubSubConfigCache` (get_group/set_group/invalidate+publish/start_subscriber) ✓, channel `config-change` ✓, try/except degradation ✓, `asyncio.CancelledError` re-raised ✓.
- Quality: minimal, no dead code, follows existing module style.
- Discipline: tests-first confirmed failing, then implementation, then full suite green.
- Testing: FakeRedis verifies `invalidate` publishes `("config-change", "MAIL")`; subscriber test verifies local invalidation on pushed message.

## Skills / Plugins / Agents Used
- Skill: `superpowers:test-driven-development` (red → green → commit).
- No plugins or sub-agents invoked; task executed directly in main thread.