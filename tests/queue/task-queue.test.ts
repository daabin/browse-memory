import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BrowseMemoryDatabase } from "@/storage/database";
import { TaskQueue } from "@/queue/task-queue";

describe("TaskQueue", () => {
  let database: BrowseMemoryDatabase;
  let queue: TaskQueue;

  beforeEach(() => {
    database = new BrowseMemoryDatabase(`tq-${crypto.randomUUID()}`);
    queue = new TaskQueue(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it("enqueues a task and retrieves it", async () => {
    const task = await queue.enqueue("embed", { pageId: "p1" });
    expect(task.type).toBe("embed");
    expect(task.status).toBe("pending");
    expect(task.retries).toBe(0);
  });

  it("deduplicates tasks with same type and payload", async () => {
    const t1 = await queue.enqueue("embed", { pageId: "p1" });
    const t2 = await queue.enqueue("embed", { pageId: "p1" });
    expect(t1.id).toBe(t2.id);
    expect(await queue.getCountByStatus("pending")).toBe(1);
  });

  it("allows different payloads for same type", async () => {
    await queue.enqueue("embed", { pageId: "p1" });
    await queue.enqueue("embed", { pageId: "p2" });
    expect(await queue.getCountByStatus("pending")).toBe(2);
  });

  it("pickNext returns the oldest pending task", async () => {
    await queue.enqueue("embed", { pageId: "p1" }, 1000);
    await queue.enqueue("embed", { pageId: "p2" }, 2000);

    const task = await queue.pickNext();
    expect(task).toBeDefined();
    expect(task!.status).toBe("processing");
    expect((task!.payload as { pageId: string }).pageId).toBe("p1");
  });

  it("pickNext returns undefined when queue is empty", async () => {
    expect(await queue.pickNext()).toBeUndefined();
  });

  it("markDone updates status", async () => {
    const task = await queue.enqueue("embed", { pageId: "p1" });
    await queue.markDone(task.id);
    expect(await queue.getCountByStatus("done")).toBe(1);
    expect(await queue.getCountByStatus("pending")).toBe(0);
  });

  it("markFailed without retry sets failed status", async () => {
    const task = await queue.enqueue("embed", { pageId: "p1" });
    await queue.markFailed(task.id, false);
    expect(await queue.getCountByStatus("failed")).toBe(1);
  });

  it("markFailed with retry bumps retries count", async () => {
    const task = await queue.enqueue("embed", { pageId: "p1" });
    await queue.markFailed(task.id, true);
    expect(await queue.getCountByStatus("pending")).toBe(1);

    const updated = await database.taskQueue.get(task.id);
    expect(updated!.retries).toBe(1);
  });

  it("retryLater fails after MAX_TASK_RETRIES", async () => {
    const task = await queue.enqueue("embed", { pageId: "p1" });
    // Set retries to max
    await database.taskQueue.update(task.id, { retries: 3 });
    await queue.retryLater(task.id);
    expect(await queue.getCountByStatus("failed")).toBe(1);
  });

  it("purgeCompleted removes old done tasks", async () => {
    const task = await queue.enqueue("embed", { pageId: "p1" });
    const oldNow = Date.now() - 30 * 86_400_000;
    await queue.markDone(task.id, oldNow);

    const purged = await queue.purgeCompleted();
    expect(purged).toBe(1);
    expect(await database.taskQueue.count()).toBe(0);
  });
});
