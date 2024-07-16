import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskRepeater } from './TaskRepeater.ts'

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
    const calledCounter = {
      'data-1': 0,
      'data-2': 0,
      'data-3': 0,
    }

    const taskRepeater = new TaskRepeater(
      [
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              calledCounter['data-1']++
              if (calledCounter['data-1'] < 3) {
                reject()
              } else {
                resolve('data-1')
              }
            }, 20)
          }),
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              calledCounter['data-2']++
              resolve('data-2')
            }, 10)
          }),
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              calledCounter['data-3']++
              resolve('data-3')
            }, 30)
          }),
      ],
      { channels: 2 },
    )

    taskRepeater.start()
    void vi.advanceTimersByTimeAsync(80)
    const data = await taskRepeater.onComplete()
    expect(data).toEqual([{ value: 'data-1' }, { value: 'data-2' }, { value: 'data-3' }])
    expect(calledCounter).toEqual({
      'data-1': 3,
      'data-2': 1,
      'data-3': 1,
    })
  })

  it('should complete task with error handler', async () => {
    const calledCounter = {
      'data-1': 0,
      'data-2': 0,
      'data-3': 0,
    }

    function checkIsHttpError(err: unknown): err is { code: number } {
      return (err as { code: number })?.code !== undefined
    }

    function errorHandler(err: unknown) {
      if (checkIsHttpError(err)) {
        return err.code !== 429
      }

      return false
    }

    const taskRepeater = new TaskRepeater(
      [
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              calledCounter['data-1']++
              if (calledCounter['data-1'] < 3) {
                reject({ code: 429 })
              } else {
                resolve('data-1')
              }
            }, 20)
          }),
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              calledCounter['data-2']++
              if (calledCounter['data-2'] < 5) {
                if (calledCounter['data-2'] === 3) {
                  reject({ code: 404 })
                } else {
                  reject({ code: 429 })
                }
              } else {
                resolve('data-2')
              }
            }, 10)
          }),
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              calledCounter['data-3']++
              resolve('data-3')
            }, 30)
          }),
      ],
      { channels: 2, shouldCompleteErrorHandler: errorHandler },
    )

    taskRepeater.start()
    void vi.advanceTimersByTimeAsync(80)
    const data = await taskRepeater.onComplete()
    expect(data).toEqual([{ value: 'data-1' }, { error: { code: 404 } }, { value: 'data-3' }])
    expect(calledCounter).toEqual({
      'data-1': 3,
      'data-2': 3,
      'data-3': 1,
    })
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
