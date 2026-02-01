'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
      const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

      if (!posthogKey) {
        console.warn('PostHog key not found. Analytics will be disabled.')
        return
      }

      posthog.init(posthogKey, {
        api_host: posthogHost || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false, // We'll capture pageviews manually with usePostHog
        capture_pageleave: true,
        
        // Session Replay Configuration
        session_recording: {
          recordCrossOriginIframes: false, // Don't record iframes from other domains
          maskAllInputs: true, // Mask all input fields by default (privacy)
          maskTextSelector: '.sensitive', // Mask elements with 'sensitive' class
        },
        
        // Privacy & Performance
        autocapture: {
          dom_event_allowlist: ['click', 'submit'], // Only capture clicks and form submits
          capture_copied_text: false, // Don't capture copied text
        },
        
        // Disable session replay in development (optional)
        disable_session_recording: process.env.NODE_ENV === 'development',
      })
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
