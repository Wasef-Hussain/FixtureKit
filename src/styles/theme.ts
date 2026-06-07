// Shared design tokens — keep UI consistent across panes.

export const theme = {
  font: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  },
  color: {
    bg: '#f8fafc',
    surface: '#ffffff',
    surfaceMuted: '#f1f5f9',
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',
    text: '#0f172a',
    textMuted: '#64748b',
    textSubtle: '#94a3b8',
    accent: '#4f46e5',
    accentSoft: '#eef2ff',
    accentHover: '#4338ca',
    success: '#059669',
    successSoft: '#ecfdf5',
    danger: '#dc2626',
    dangerSoft: '#fef2f2',
    codeBg: '#0f172a',
    codeText: '#e2e8f0',
    codeMuted: '#64748b',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    pill: '999px',
  },
  shadow: {
    card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04)',
    glow: '0 0 0 1px rgba(79, 70, 229, 0.08), 0 8px 32px rgba(79, 70, 229, 0.12)',
  },
} as const
