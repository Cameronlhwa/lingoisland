'use client'

import { usePostHog } from 'posthog-js/react'
import { useCallback } from 'react'

/**
 * Custom hook for PostHog analytics
 * Provides type-safe event tracking methods
 * 
 * Usage:
 * const { captureEvent, identify } = useAnalytics()
 * 
 * captureEvent('button_clicked', { button_name: 'upgrade' })
 * identify(user.id, { email: user.email, plan: 'pro' })
 */
export function useAnalytics() {
  const posthog = usePostHog()

  const captureEvent = useCallback(
    (eventName: string, properties?: Record<string, any>) => {
      if (posthog) {
        posthog.capture(eventName, properties)
      }
    },
    [posthog]
  )

  const identify = useCallback(
    (userId: string, properties?: Record<string, any>) => {
      if (posthog) {
        posthog.identify(userId, properties)
      }
    },
    [posthog]
  )

  const reset = useCallback(() => {
    if (posthog) {
      posthog.reset()
    }
  }, [posthog])

  return {
    captureEvent,
    identify,
    reset,
    posthog,
  }
}
