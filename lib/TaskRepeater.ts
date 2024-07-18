import { AsyncQueue } from './AsyncQueue.ts'

type JobStatus = 'pending' | 'completed' | 'failed'

type Job = {
  id: number
  task: Task
  status: JobStatus
  value?: unknown
}

type TaskRepeatParams = {
  channels?: number
  intervalStrategy?: (i: number) => number
  maxRuns?: number
}

type TaskRepeatDefaults = {
  channels: number
  maxRuns: number
  intervalStrategy?: (i: number) => number
}

const defaultParams: TaskRepeatDefaults = {
  channels: 1,
  maxRuns: Number.MAX_SAFE_INTEGER,
}

export class TaskRepeater {
  private readonly jobs: Job[] = []
  private readonly asyncQueue: AsyncQueue
  private complete: { (value?: unknown): void }[] = []
  private failed: { (reason?: unknown): void }[] = []
  private isStarted = false
  private currentRun = 0
  private readonly params = defaultParams

  constructor(tasks: Task[], params?: TaskRepeatParams) {
    this.params.channels = params?.channels || this.params.channels
    this.params.intervalStrategy = params?.intervalStrategy || this.params.intervalStrategy
    this.params.maxRuns = params?.maxRuns || this.params.maxRuns

    for (const [index, task] of tasks.entries()) {
      this.jobs.push({
        id: index,
        task,
        status: 'pending',
      })
    }

    this.asyncQueue = new AsyncQueue({
      channels: this.params.channels,
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
          this.jobs[job.id] = {
            id: job.id,
            task: job.task,
            status: 'failed',
          }
        }
      })
    }

    await this.asyncQueue.onDrain()
    const uncompleted = this.jobs.filter((job) => job.status === 'failed')
    if (uncompleted.length) {
      if (this.currentRun < this.params.maxRuns) {
        this.scheduleNextRun(uncompleted)
      } else {
        this.failed.forEach((fail) => fail('Max attempts exceeded'))
      }
    } else {
      this.complete.forEach((complete) => complete(this.jobs.map((job) => job.value)))
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
    return new Promise((resolve, reject) => {
      this.complete.push(resolve)
      this.failed.push(reject)
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
