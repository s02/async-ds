import { AsyncQueue } from './AsyncQueue.ts'

type JobStatus = 'pending' | 'completed' | 'failed'

type Job = {
  id: number
  task: Task
  status: JobStatus
  value?: unknown
  error?: unknown
}

type TaskRepeatParams = {
  channels?: number
  intervalStrategy?: (i: number) => number
  shouldCompleteErrorHandler?: (err: unknown) => boolean
}

export class TaskRepeater {
  private readonly jobs: Job[] = []
  private readonly asyncQueue: AsyncQueue
  private complete: { (value?: unknown): void }[] = []
  private isStarted = false
  private readonly params: TaskRepeatParams = {}
  private currentRun = 0

  constructor(tasks: Task[], params?: TaskRepeatParams) {
    if (params) {
      this.params = params
    }

    for (const [index, task] of tasks.entries()) {
      this.jobs.push({
        id: index,
        task,
        status: 'pending',
      })
    }

    this.asyncQueue = new AsyncQueue({
      channels: this.params.channels || 1,
    })
  }

  private async run(jobs: Job[]) {
    this.currentRun++

    for (const job of jobs) {
      this.asyncQueue.enqueue(async () => {
        try {
          const result = await job.task()
          this.jobs[job.id] = {
            id: job.id,
            task: job.task,
            status: 'completed',
            value: result,
          }
        } catch (e) {
          let status: JobStatus = 'failed'
          if (this.params.shouldCompleteErrorHandler && this.params.shouldCompleteErrorHandler(e)) {
            status = 'completed'
          }

          this.jobs[job.id] = {
            id: job.id,
            task: job.task,
            status,
            error: e,
          }
        }
      })
    }

    await this.asyncQueue.onDrain()
    const uncompleted = this.jobs.filter((job) => job.status === 'failed')
    if (uncompleted.length) {
      this.scheduleNextRun(uncompleted)
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
    if (this.isStarted) {
      return
    }
    this.isStarted = true
    void this.run(this.jobs)
  }

  onComplete() {
    return new Promise((resolve) => {
      this.complete.push(resolve)
    })
  }

  private scheduleNextRun(uncompletedJobs: Job[]) {
    const timeout = this.params.intervalStrategy ? this.params.intervalStrategy(this.currentRun) : 0
    if (!timeout) {
      void this.run(uncompletedJobs)
    } else {
      setTimeout(() => {
        void this.run(uncompletedJobs)
      }, timeout)
    }
  }
}
