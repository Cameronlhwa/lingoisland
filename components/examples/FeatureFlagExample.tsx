'use client'

import { useFeatureFlagEnabled, useFeatureFlagVariantKey } from 'posthog-js/react'
import { useAnalytics } from '@/lib/posthog/client'
import { useEffect } from 'react'

/**
 * Example component showing how to use PostHog feature flags
 * 
 * To use this:
 * 1. Go to https://us.i.posthog.com/feature_flags
 * 2. Create a flag with key "example-feature-flag"
 * 3. Set it to 100% rollout (or whatever you want)
 * 4. Add this component to any page to test
 */
export default function FeatureFlagExample() {
  const { captureEvent } = useAnalytics()
  
  // Simple on/off flag
  const showNewFeature = useFeatureFlagEnabled('example-feature-flag')
  
  // A/B test variant (control, test-a, test-b, etc.)
  const variant = useFeatureFlagVariantKey('example-ab-test')
  
  // Track when feature is shown (for analytics)
  useEffect(() => {
    if (showNewFeature) {
      captureEvent('feature_flag_exposed', {
        flag: 'example-feature-flag',
        enabled: true,
      })
    }
  }, [showNewFeature, captureEvent])

  return (
    <div className="p-6 bg-gray-100 rounded-lg space-y-4">
      <h2 className="text-2xl font-bold">Feature Flag Examples</h2>
      
      {/* Example 1: Simple on/off flag */}
      <div className="bg-white p-4 rounded">
        <h3 className="font-semibold mb-2">Simple Feature Toggle</h3>
        <p className="text-sm text-gray-600 mb-2">
          Flag: <code className="bg-gray-100 px-1">example-feature-flag</code>
        </p>
        {showNewFeature ? (
          <div className="text-green-600">
            ✅ New feature is ENABLED for you!
          </div>
        ) : (
          <div className="text-gray-500">
            ❌ New feature is disabled (showing old version)
          </div>
        )}
      </div>

      {/* Example 2: A/B test variants */}
      <div className="bg-white p-4 rounded">
        <h3 className="font-semibold mb-2">A/B Test Variant</h3>
        <p className="text-sm text-gray-600 mb-2">
          Flag: <code className="bg-gray-100 px-1">example-ab-test</code>
        </p>
        <div>
          Your variant: <strong>{variant || 'control (default)'}</strong>
        </div>
        
        {/* Show different content based on variant */}
        {variant === 'test-a' && (
          <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-500">
            🔵 You're seeing Test Variant A
          </div>
        )}
        {variant === 'test-b' && (
          <div className="mt-2 p-2 bg-purple-50 border-l-4 border-purple-500">
            🟣 You're seeing Test Variant B
          </div>
        )}
        {(!variant || variant === 'control') && (
          <div className="mt-2 p-2 bg-gray-50 border-l-4 border-gray-500">
            ⚪️ You're seeing the Control group
          </div>
        )}
      </div>

      {/* Example 3: Button with A/B test */}
      <div className="bg-white p-4 rounded">
        <h3 className="font-semibold mb-2">A/B Test Button</h3>
        <p className="text-sm text-gray-600 mb-3">
          Different button styles based on variant
        </p>
        
        {variant === 'test-a' ? (
          <button
            onClick={() => captureEvent('example_button_clicked', { variant: 'test-a' })}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all"
          >
            🚀 Get Started (Variant A)
          </button>
        ) : variant === 'test-b' ? (
          <button
            onClick={() => captureEvent('example_button_clicked', { variant: 'test-b' })}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg"
          >
            ⭐️ Try Now - Free! (Variant B)
          </button>
        ) : (
          <button
            onClick={() => captureEvent('example_button_clicked', { variant: 'control' })}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-all"
          >
            Get Started (Control)
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded">
        <h3 className="font-semibold text-blue-900 mb-2">📝 How to Test</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Go to <a href="https://us.i.posthog.com/feature_flags" target="_blank" rel="noopener noreferrer" className="underline">PostHog Feature Flags</a></li>
          <li>Create flag: <code className="bg-blue-100 px-1">example-feature-flag</code></li>
          <li>Create flag: <code className="bg-blue-100 px-1">example-ab-test</code> with variants: control, test-a, test-b</li>
          <li>Set rollout percentages and save</li>
          <li>Refresh this page to see changes!</li>
        </ol>
      </div>
    </div>
  )
}
