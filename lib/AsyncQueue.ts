export type AsyncQueueParams = {
  channels?: number
}

type AsyncQueueSettings = {
  channels: number
}

export class AsyncQueue {
  private readonly settings: AsyncQueueSettings
  private waiting: Task[] = []
  private size = 0
  private drain: { (value?: unknown): void }[] = []

  constructor(params?: AsyncQueueParams) {
    this.settings = {
      channels: (params && params.channels) || 1,
    }
  }

  enqueue(task: Task) {
    if (this.size < this.settings.channels) {
      this.next(task)
      return
    }

    this.waiting.push(task)
  }

  onDrain() {
    return new Promise((resolve) => this.drain.push(resolve))
  }

  private next(task: Task) {
    this.size++
    void this.process(task)
  }

  private async process(task: Task) {
    try {
      await task()
    } catch (e) {
      //The task handles its own errors
    } finally {
      this.size--
      if (this.waiting.length > 0) {
        const task = this.waiting.shift()
        if (task) {
          this.next(task)
        }
      } else if (this.size === 0) {
        this.drain.forEach((resolve) => resolve())
      }
    }
  }
}
