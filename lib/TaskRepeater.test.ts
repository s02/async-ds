import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskRepeater } from './TaskRepeater.ts'

function checkIsHttpError(err: unknown): err is { code: number } {
  return (err as { code: number })?.code !== undefined
}

function errorHandler(err: unknown) {
  if (checkIsHttpError(err)) {
    return err.code !== 429
  }

  return false
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
    expect(data).toEqual([{ value: 'data-1' }, { value: 'data-2' }, { value: 'data-3' }])
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
    expect(data).toEqual([{ value: 'data-1' }, { value: 'data-2' }, { value: 'data-3' }])
  })

  it('should repeat task if rejected', async () => {
    let calledCounter = 0

    const taskRepeater = new TaskRepeater([
      () =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            calledCounter++
            if (calledCounter < 3) {
              reject()
            } else {
              resolve('data')
            }
          }, 20)
        }),
    ])

    taskRepeater.start()
    void vi.advanceTimersByTimeAsync(60)
    const data = await taskRepeater.onComplete()
    expect(data).toEqual([{ value: 'data' }])
    expect(calledCounter).toEqual(3)
  })

  it('should repeat task if error handler allows', async () => {
    let calledCounter = 0
    const taskRepeater = new TaskRepeater(
      [
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              calledCounter++
              if (calledCounter < 3) {
                reject({ code: 429 })
              } else {
                resolve('data')
              }
            }, 20)
          }),
      ],
      { shouldCompleteErrorHandler: errorHandler },
    )

    taskRepeater.start()
    void vi.advanceTimersByTimeAsync(60)
    const data = await taskRepeater.onComplete()
    expect(data).toEqual([{ value: 'data' }])
    expect(calledCounter).toEqual(3)
  })

  it('should complete task when error handler restricts', async () => {
    let calledCounter = 0

    const taskRepeater = new TaskRepeater(
      [
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              calledCounter++
              if (calledCounter < 5) {
                if (calledCounter === 3) {
                  reject({ code: 404 })
                } else {
                  reject({ code: 429 })
                }
              } else {
                resolve('data-2')
              }
            }, 10)
          }),
      ],
      { shouldCompleteErrorHandler: errorHandler },
    )

    taskRepeater.start()
    void vi.advanceTimersByTimeAsync(60)
    const data = await taskRepeater.onComplete()
    expect(data).toEqual([{ error: { code: 404 } }])
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
})
