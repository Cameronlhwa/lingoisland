'use client'

import { usePostHog } from 'posthog-js/react'
import { useCallback, useEffect, useState } from 'react'

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
    (eventName: string, properties?: Record<string, unknown>) => {
      if (posthog) {
        posthog.capture(eventName, properties)
      }
    },
    [posthog]
  )

  const identify = useCallback(
    (userId: string, properties?: Record<string, unknown>) => {
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

/**
 * Hook to read a PostHog feature flag variant.
 * Returns the variant string (e.g. "control" | "test"), true/false for boolean flags,
 * or undefined while PostHog is still loading.
 *
 * Usage:
 *   const variant = useFeatureFlag('five-or-ten-free-words')
 *   // variant === 'test'   → test group
 *   // variant === 'control' → control group
 *   // variant === undefined → not yet loaded
 */
export function useFeatureFlag(flagKey: string): string | boolean | undefined {
  const posthog = usePostHog()
  const [variant, setVariant] = useState<string | boolean | undefined>(undefined)

  useEffect(() => {
    if (!posthog) return

    // onFeatureFlags fires once flags are loaded (or immediately if already loaded)
    const unsubscribe = posthog.onFeatureFlags(() => {
      setVariant(posthog.getFeatureFlag(flagKey) as string | boolean | undefined)
    })

    // Also resolve synchronously in case flags are already available
    const current = posthog.getFeatureFlag(flagKey)
    if (current !== undefined) setVariant(current as string | boolean | undefined)

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [posthog, flagKey])

  return variant
}
