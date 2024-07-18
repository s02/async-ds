import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskRepeater } from './TaskRepeater.ts'

class HttpError extends Error {
  code: number

  constructor(code: number) {
    super()
    this.code = code
  }
}

function fakeHttpClient429(calledCounter: number, maxAttempts = 3) {
  return new Promise<string>((resolve, reject) => {
    setTimeout(() => {
      if (calledCounter < maxAttempts) {
        reject(new HttpError(429))
      } else {
        resolve('data')
      }
    }, 20)
  })
}

function fakeHttpClient500(calledCounter: number) {
  return new Promise<string>((_, reject) => {
    setTimeout(() => {
      if (calledCounter < 3) {
        reject(new HttpError(429))
      } else {
        reject(new HttpError(500))
      }
    }, 10)
  })
}

describe('TaskRepeater', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should complete all tasks', async () => {
    const taskRepeater = new TaskRepeater([
      () =>
        new Promise((resolve) => {
          resolve('data-1')
        }),
      () =>
        new Promise((resolve) => {
          resolve('data-2')
        }),
      () =>
        new Promise((resolve) => {
          resolve('data-3')
        }),
    ])

    taskRepeater.start()
    const data = await taskRepeater.onComplete()
    expect(data).toEqual(['data-1', 'data-2', 'data-3'])
  })

  it('should result to be in same places', async () => {
    const taskRepeater = new TaskRepeater(
      [
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve('data-1')
            }, 20)
          }),
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve('data-2')
            }, 10)
          }),
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve('data-3')
            }, 30)
          }),
      ],
      { channels: 2 },
    )

    taskRepeater.start()
    void vi.advanceTimersByTimeAsync(40)
    const data = await taskRepeater.onComplete()
    expect(data).toEqual(['data-1', 'data-2', 'data-3'])
  })

  it('should repeat task if rejected', async () => {
    let calledCounter = 0
    const taskRepeater = new TaskRepeater([() => fakeHttpClient429(++calledCounter)])

    taskRepeater.start()
    void vi.advanceTimersByTimeAsync(160)
    const data = await taskRepeater.onComplete()
    expect(data).toEqual(['data'])
    expect(calledCounter).toEqual(3)
  })

  it('should complete task when error handler restricts', async () => {
    let calledCounter = 0

    const taskRepeater = new TaskRepeater([
      async () => {
        try {
          return await fakeHttpClient500(++calledCounter)
        } catch (e: unknown) {
          if (e instanceof HttpError && e.code === 429) {
            throw new Error()
          } else {
            return {
              error: e,
            }
          }
        }
      },
    ])

    taskRepeater.start()
    void vi.advanceTimersByTimeAsync(60)
    const data = (await taskRepeater.onComplete()) as { error: HttpError }[]
    expect(data[0].error?.code).toEqual(500)
    expect(calledCounter).toEqual(3)
  })

  it('should use interval strategy', async () => {
    let calledCounter = 0

    function intervalStrategy(i: number) {
      return i * 10
    }

    const taskRepeater = new TaskRepeater(
      [
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              calledCounter++
              if (calledCounter < 3) {
                reject({ code: 429 })
              } else {
                resolve('data-1')
              }
            }, 20)
          }),
      ],
      { intervalStrategy },
    )

    taskRepeater.start()
    let completed = false
    taskRepeater.onComplete().then(() => {
      completed = true
    })

    await vi.advanceTimersByTimeAsync(89)
    expect(completed).toBeFalsy()

    await vi.advanceTimersByTimeAsync(1)
    expect(completed).toBeTruthy()
  })

  it('should fail when max attempts exceeded', async () => {
    let calledCounter = 0
    const taskRepeater = new TaskRepeater([() => fakeHttpClient429(++calledCounter, 10)], { maxRuns: 2 })

    taskRepeater.start()
    void vi.advanceTimersByTimeAsync(100)
    try {
      await taskRepeater.onComplete()
    } catch (e) {
      expect(e).toEqual('Max attempts exceeded')
    }

    expect(calledCounter).toEqual(2)
  })
})
