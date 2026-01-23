/**
 * Concurrency limiter utility
 * Limits the number of concurrent async operations
 */

export class ConcurrencyLimiter {
  private queue: Array<() => Promise<void>> = []
  private running = 0
  private limit: number

  constructor(limit: number) {
    if (limit < 1) {
      throw new Error('Concurrency limit must be at least 1')
    }
    this.limit = limit
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.running--
          this.processQueue()
        }
      })

      this.processQueue()
    })
  }

  private processQueue() {
    while (this.running < this.limit && this.queue.length > 0) {
      const task = this.queue.shift()
      if (task) {
        this.running++
        task()
      }
    }
  }

  async waitForAll(): Promise<void> {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
}

/**
 * Execute an array of async functions with a concurrency limit
 * @param tasks Array of async functions to execute
 * @param limit Maximum number of concurrent executions
 * @returns Array of results in the same order as input
 */
export async function limitConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const limiter = new ConcurrencyLimiter(limit)
  const results = await Promise.all(
    tasks.map((task) => limiter.execute(task))
  )
  return results
}

