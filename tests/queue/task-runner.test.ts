import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BrowseMemoryDatabase } from "@/storage/database";
import { TaskQueue } from "@/queue/task-queue";
import { TaskRunner } from "@/queue/task-runner";
import type { TaskType } from "@/shared/types";

describe("TaskRunner", () => {
  let database: BrowseMemoryDatabase;
  let queue: TaskQueue;

  beforeEach(() => {
    database = new BrowseMemoryDatabase(`tr-${crypto.randomUUID()}`);
    queue = new TaskQueue(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it("processes pending tasks with registered handlers", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const handlers = new Map<TaskType, (p: unknown) => Promise<void>>([
      ["embed", handler],
    ]);
    const runner = new TaskRunner(queue, handlers);

    await queue.enqueue("embed", { pageId: "p1" });
    await queue.enqueue("embed", { pageId: "p2" });

    const result = await runner.runBatch();
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("retries on handler failure", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("fail"));
    const handlers = new Map<TaskType, (p: unknown) => Promise<void>>([
      ["embed", handler],
    ]);
    const runner = new TaskRunner(queue, handlers);

    await queue.enqueue("embed", { pageId: "p1" });

    // Process only 1 task to avoid retry loop within same batch
    const result = await runner.runBatch(1);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
    // Task should be back to pending with retries=1
    const count = await queue.getCountByStatus("pending");
    expect(count).toBe(1);
  });

  it("fails task without handler", async () => {
    const handlers = new Map<TaskType, (p: unknown) => Promise<void>>();
    const runner = new TaskRunner(queue, handlers);

    await queue.enqueue("embed", { pageId: "p1" });

    const result = await runner.runBatch();
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
    expect(await queue.getCountByStatus("failed")).toBe(1);
  });

  it("respects maxTasks limit", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const handlers = new Map<TaskType, (p: unknown) => Promise<void>>([
      ["embed", handler],
    ]);
    const runner = new TaskRunner(queue, handlers);

    for (let i = 0; i < 10; i++) {
      await queue.enqueue("embed", { pageId: `p${i}` });
    }

    const result = await runner.runBatch(3);
    expect(result.processed).toBe(3);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("returns zero counts when queue is empty", async () => {
    const handlers = new Map<TaskType, (p: unknown) => Promise<void>>();
    const runner = new TaskRunner(queue, handlers);

    const result = await runner.runBatch();
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
  });
});
