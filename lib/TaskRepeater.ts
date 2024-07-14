import { AsyncQueue } from './AsyncQueue.ts'

type Job = {
  id: number
  task: Task
  status: 'pending' | 'resolved' | 'rejected'
  value?: unknown
  error?: unknown
}

export class TaskRepeater {
  private readonly jobs: Job[] = []
  private readonly asyncQueue: AsyncQueue
  private complete: { (value?: unknown): void }[] = []
  private isRunning = false

  constructor(tasks: Task[]) {
    for (const [index, task] of tasks.entries()) {
      this.jobs.push({
        id: index,
        task,
        status: 'pending',
      })
    }

    this.asyncQueue = new AsyncQueue()
  }

  private async run(jobs: Job[]) {
    for (const job of jobs) {
      this.asyncQueue.enqueue(async () => {
        try {
          const result = await job.task()
          this.jobs[job.id] = {
            id: job.id,
            task: job.task,
            status: 'resolved',
            value: result,
          }
        } catch (e) {
          this.jobs[job.id] = {
            id: job.id,
            task: job.task,
            status: 'rejected',
            error: e,
          }
        }
      })
    }

    await this.asyncQueue.onDrain()
    const uncompleted = this.jobs.filter((job) => job.status === 'rejected')
    if (uncompleted.length) {
      void this.run(uncompleted)
    } else {
      this.complete.forEach((complete) =>
        complete(
          this.jobs.map((job) => ({
            value: job.value,
            error: job.error,
          })),
        ),
      )
    }
  }

  start() {
    if (this.isRunning) {
      return
    }
    this.isRunning = true
    void this.run(this.jobs)
  }

  onComplete() {
    return new Promise((resolve) => {
      this.complete.push(resolve)
    })
  }
}
