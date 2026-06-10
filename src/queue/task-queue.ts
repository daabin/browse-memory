import {
  MAX_TASK_RETRIES,
  TASK_BACKOFF_MS,
} from "../shared/constants";
import type {
  TaskRecord,
  TaskStatus,
  TaskType,
} from "../shared/types";
import type { BrowseMemoryDatabase } from "../storage/database";

export class TaskQueue {
  constructor(private readonly database: BrowseMemoryDatabase) {}

  async enqueue(
    type: TaskType,
    payload: unknown,
    now = Date.now(),
  ): Promise<TaskRecord> {
    // Deduplicate: same type + same payload key should not re-enqueue
    const payloadKey = JSON.stringify(payload);
    const existing = await this.database.taskQueue
      .where("type")
      .equals(type)
      .filter(
        (task) =>
          task.status === "pending" &&
          JSON.stringify(task.payload) === payloadKey,
      )
      .first();
    if (existing) {
      return existing;
    }

    const record: TaskRecord = {
      id: crypto.randomUUID(),
      type,
      status: "pending",
      payload,
      retries: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.database.taskQueue.add(record);
    return record;
  }

  async pickNext(now = Date.now()): Promise<TaskRecord | undefined> {
    const task = await this.database.taskQueue
      .where("status")
      .equals("pending" as TaskStatus)
      .sortBy("createdAt")
      .then((tasks) => tasks[0]);
    if (!task) {
      return undefined;
    }
    await this.database.taskQueue.update(task.id, {
      status: "processing",
      updatedAt: now,
    });
    return { ...task, status: "processing", updatedAt: now };
  }

  async markDone(taskId: string, now = Date.now()): Promise<void> {
    await this.database.taskQueue.update(taskId, {
      status: "done",
      updatedAt: now,
    });
  }

  async markFailed(
    taskId: string,
    shouldRetry: boolean,
    now = Date.now(),
  ): Promise<void> {
    if (!shouldRetry) {
      await this.database.taskQueue.update(taskId, {
        status: "failed",
        updatedAt: now,
      });
      return;
    }
    await this.retryLater(taskId, now);
  }

  async retryLater(taskId: string, now = Date.now()): Promise<void> {
    const task = await this.database.taskQueue.get(taskId);
    if (!task) return;

    if (task.retries >= MAX_TASK_RETRIES) {
      await this.database.taskQueue.update(taskId, {
        status: "failed",
        updatedAt: now,
      });
      return;
    }

    const backoff = TASK_BACKOFF_MS[task.retries] ?? TASK_BACKOFF_MS.at(-1)!;
    await this.database.taskQueue.update(taskId, {
      status: "pending",
      retries: task.retries + 1,
      // Schedule for later by bumping createdAt so it sorts later
      createdAt: now + backoff,
      updatedAt: now,
    });
  }

  async getCountByStatus(
    status: TaskStatus,
  ): Promise<number> {
    return this.database.taskQueue.where("status").equals(status).count();
  }

  async purgeCompleted(now = Date.now()): Promise<number> {
    const cutoff = now - 7 * 86_400_000; // keep done tasks for 7 days
    const doneTasks = await this.database.taskQueue
      .where("status")
      .equals("done" as TaskStatus)
      .filter((task) => task.updatedAt < cutoff)
      .toArray();
    if (doneTasks.length === 0) return 0;
    await this.database.taskQueue.bulkDelete(doneTasks.map((t) => t.id));
    return doneTasks.length;
  }
}
