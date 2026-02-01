import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

    if (!posthogKey) {
      throw new Error('NEXT_PUBLIC_POSTHOG_KEY is not set')
    }

    posthogClient = new PostHog(posthogKey, {
      host: posthogHost || 'https://us.i.posthog.com',
      flushAt: 1, // Flush after each event in serverless environments
      flushInterval: 0, // Don't flush on an interval
    })
  }

  return posthogClient
}

/**
 * Helper to capture a server-side event
 * Usage in API routes or server actions:
 * 
 * import { captureServerEvent } from '@/lib/posthog/server'
 * 
 * await captureServerEvent({
 *   distinctId: user.id,
 *   event: 'subscription_created',
 *   properties: { plan: 'pro', amount: 10 }
 * })
 */
export async function captureServerEvent({
  distinctId,
  event,
  properties = {},
}: {
  distinctId: string
  event: string
  properties?: Record<string, any>
}) {
  const posthog = getPostHogClient()
  
  posthog.capture({
    distinctId,
    event,
    properties,
  })

  // Flush immediately in serverless environments
  await posthog.shutdown()
}
