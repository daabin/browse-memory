import type { TaskType } from "../shared/types";

import type { TaskQueue } from "./task-queue";

export type TaskHandler = (payload: unknown) => Promise<void>;

export class TaskRunner {
  constructor(
    private readonly queue: TaskQueue,
    private readonly handlers: Map<TaskType, TaskHandler>,
  ) {}

  async runBatch(maxTasks = 5): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < maxTasks; i++) {
      const task = await this.queue.pickNext();
      if (!task) break;

      const handler = this.handlers.get(task.type);
      if (!handler) {
        await this.queue.markFailed(task.id, false);
        failed++;
        continue;
      }

      try {
        await handler(task.payload);
        await this.queue.markDone(task.id);
        processed++;
      } catch {
        await this.queue.markFailed(task.id, true);
        failed++;
      }
    }

    return { processed, failed };
  }
}
