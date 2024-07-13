import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AsyncQueue } from './AsyncQueue.ts'

describe('Async Queue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses 1 channel for resolving', async () => {
    const order: number[] = []
    const queue = new AsyncQueue()

    queue.enqueue(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            order.push(1)
            resolve()
          }, 20)
        }),
    )

    queue.enqueue(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            order.push(2)
            resolve()
          }, 10)
        }),
    )

    void vi.advanceTimersByTimeAsync(30)
    await queue.onDrain()
    expect(order).toStrictEqual([1, 2])
  })

  it('uses 2 channels for resolving', async () => {
    const order: number[] = []
    const queue = new AsyncQueue({ channels: 2 })

    queue.enqueue(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            order.push(1)
            resolve()
          }, 20)
        }),
    )

    queue.enqueue(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            order.push(2)
            resolve()
          }, 10)
        }),
    )

    queue.enqueue(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            order.push(3)
            resolve()
          }, 5)
        }),
    )

    void vi.advanceTimersByTimeAsync(50)
    await queue.onDrain()

    expect(order).toStrictEqual([2, 3, 1])
  })

  it('call drain when rejected', async () => {
    const order: number[] = []
    const queue = new AsyncQueue({ channels: 1 })
    queue.enqueue(
      () =>
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            order.push(3)
            reject()
          }, 5)
        }),
    )

    void vi.advanceTimersByTimeAsync(50)
    await queue.onDrain()
    expect(order).toStrictEqual([3])
  })
})
