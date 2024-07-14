import { describe, expect, it } from 'vitest'
import { TaskRepeater } from './TaskRepeater.ts'

describe('TaskRepeater', () => {
  it('should', async () => {
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
})
