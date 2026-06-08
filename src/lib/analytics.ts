// Lightweight analytics abstraction layer.
// We are logging to the console for now until a provider (like Vercel Analytics) is chosen.

export type AnalyticsEvent = 
  | 'generate_clicked'
  | 'input_mode_changed'
  | 'parse_success'
  | 'parse_failure'
  | 'schema_generated'

export const Analytics = {
  track: (event: AnalyticsEvent, payload?: Record<string, any>) => {
    // Determine the environment. We don't want to spam tests.
    const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
    if (isTest) return

    // Currently stubbed. Just logs to the console for telemetry simulation.
    console.log(\`[Analytics] \${event}\`, payload ? payload : '')
    
    // In the future:
    // if (window.va) window.va.track(event, payload)
    // or PostHog/Plausible integration here.
  }
}
