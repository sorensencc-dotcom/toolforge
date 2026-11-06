import asyncio
import time
from dataclasses import dataclass

class MCPError(Exception):
    def __init__(self, code, message, data):
        self.code = code
        self.message = message
        self.data = data

# Simulating the old implementation
def old_send_mutation(post):
    try:
        return post()
    except MCPError as exc:
        data = exc.data if isinstance(exc.data, dict) else {}
        if exc.code == -32602 and data.get("reason") == "idempotency_in_progress":
            time.sleep(data["retryAfterSeconds"])
            return post()
        raise

# New implementation
async def new_send_mutation(post):
    try:
        return await post()
    except MCPError as exc:
        data = exc.data if isinstance(exc.data, dict) else {}
        if exc.code == -32602 and data.get("reason") == "idempotency_in_progress":
            await asyncio.sleep(data["retryAfterSeconds"])
            return await post()
        raise

async def main():
    print("Benchmarking old vs new...")

    # Mock sync post that fails with idempotency_in_progress
    def sync_post_fail():
        raise MCPError(-32602, "Error", {"reason": "idempotency_in_progress", "retryAfterSeconds": 1})

    async def async_post_fail():
        raise MCPError(-32602, "Error", {"reason": "idempotency_in_progress", "retryAfterSeconds": 1})

    # Benchmark old (which would block the event loop, causing tasks to run sequentially)
    async def run_old_concurrently():
        def wrapper():
            try:
                old_send_mutation(sync_post_fail)
            except MCPError:
                pass

        start = time.time()
        # Since it blocks the loop, we simulate running two in an async loop where someone mistakenly calls it directly
        # Or using a thread pool. But let's just show it blocks the current thread
        wrapper()
        wrapper()
        return time.time() - start

    # Benchmark new
    async def run_new_concurrently():
        async def wrapper():
            try:
                await new_send_mutation(async_post_fail)
            except MCPError:
                pass

        start = time.time()
        await asyncio.gather(wrapper(), wrapper())
        return time.time() - start

    t_old = await run_old_concurrently()
    t_new = await run_new_concurrently()
    print(f"Old approach sequential time for 2 calls (blocking): {t_old:.2f}s")
    print(f"New approach concurrent time for 2 calls (async): {t_new:.2f}s")

if __name__ == "__main__":
    asyncio.run(main())
