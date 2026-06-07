import { useState } from 'react'
import type { FixtureOutput } from '../lib/generator/generateFixture'
import type { OutputTab } from '../hooks/useFixtureGen'
import { theme } from '../styles/theme'

interface Props {
  output: FixtureOutput | null
  activeTab: OutputTab
  onTabChange: (tab: OutputTab) => void
}

const ALL_TABS: OutputTab[] = ['ts', 'json', 'msw', 'playwright']

const TAB_META: Record<OutputTab, { label: string; hint: string; ext: string; mime: string }> = {
  ts:         { label: 'TypeScript', ext: '.ts',          mime: 'text/typescript', hint: 'Copy-ready const' },
  json:       { label: 'JSON',       ext: '.json',        mime: 'application/json', hint: 'API response body' },
  msw:        { label: 'MSW',        ext: '.handler.ts',  mime: 'text/typescript', hint: 'Mock Service Worker' },
  playwright: { label: 'Playwright', ext: '.spec.ts',     mime: 'text/typescript', hint: 'Route interception' },
}

const { font, color, radius } = theme

export default function OutputPane({ output, activeTab, onTabChange }: Props) {
  const empty = output === null
  const activeCode = empty ? '' : output[activeTab]
  const meta = TAB_META[activeTab]

  return (
    <div style={styles.wrapper}>
      {/* Toolbar: format picker + actions — no stray divider line */}
      <div style={styles.toolbar}>
        <div style={styles.formatGroup} role="tablist" aria-label="Output format">
          {ALL_TABS.map((tab) => {
            const active = activeTab === tab
            const t = TAB_META[tab]
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(tab)}
                style={{
                  ...styles.formatBtn,
                  ...(active ? styles.formatBtnActive : {}),
                }}
              >
                <span style={{
                  ...styles.formatLabel,
                  ...(active ? styles.formatLabelActive : {}),
                }}>{t.label}</span>
                <span style={{
                  ...styles.formatHint,
                  ...(active ? styles.formatHintActive : {}),
                }}>
                  {t.hint}
                </span>
              </button>
            )
          })}
        </div>
        <div style={styles.actions}>
          <CopyBtn code={activeCode} disabled={empty} />
          <DownloadBtn code={activeCode} disabled={empty} meta={meta} />
        </div>
      </div>

      <pre style={styles.codeBlock}>
        {empty ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>{'{ }'}</div>
            <p style={styles.emptyTitle}>Your fixture will appear here</p>
            <p style={styles.emptyHint}>
              Paste a schema on the left — pick a format above to export as TypeScript, JSON, MSW, or Playwright.
            </p>
          </div>
        ) : (
          <code>{activeCode}</code>
        )}
      </pre>
    </div>
  )
}

function CopyBtn({ code, disabled }: { code: string; disabled: boolean }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (disabled) return
    navigator.clipboard.writeText(code).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {
        const ta = document.createElement('textarea')
        ta.value = code
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
    )
  }

  return (
    <button
      style={{ ...styles.actionBtn, ...(copied ? styles.btnCopied : {}) }}
      onClick={handleCopy}
      disabled={disabled}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function DownloadBtn({
  code,
  disabled,
  meta,
}: {
  code: string
  disabled: boolean
  meta: { ext: string; mime: string }
}) {
  return (
    <button
      style={styles.actionBtnPrimary}
      onClick={() => {
        if (disabled) return
        const blob = new Blob([code], { type: meta.mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `fixture${meta.ext}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }}
      disabled={disabled}
    >
      Download
    </button>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    padding: '12px 14px',
    background: color.surfaceMuted,
    borderBottom: `1px solid ${color.border}`,
  },
  formatGroup: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    padding: '3px',
    background: color.surface,
    borderRadius: radius.md,
    border: `1px solid ${color.border}`,
  },
  formatBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '1px',
    padding: '6px 12px',
    border: 'none',
    borderRadius: radius.sm,
    background: 'transparent',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '88px',
  },
  formatBtnActive: {
    background: color.accent,
    boxShadow: '0 1px 4px rgba(79, 70, 229, 0.35)',
  },
  formatLabel: {
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: font.sans,
    color: color.textMuted,
    lineHeight: 1.2,
  },
  formatLabelActive: {
    color: '#ffffff',
  },
  formatHint: {
    fontSize: '10px',
    fontWeight: 500,
    fontFamily: font.sans,
    color: color.textSubtle,
    lineHeight: 1.2,
  },
  formatHintActive: {
    color: 'rgba(255,255,255,0.75)',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  actionBtn: {
    padding: '7px 14px',
    fontSize: '13px',
    fontFamily: font.sans,
    fontWeight: 500,
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    background: color.surface,
    color: color.text,
    cursor: 'pointer',
    outline: 'none',
  },
  actionBtnPrimary: {
    padding: '7px 14px',
    fontSize: '13px',
    fontFamily: font.sans,
    fontWeight: 600,
    border: 'none',
    borderRadius: radius.sm,
    background: color.accent,
    color: '#ffffff',
    cursor: 'pointer',
    outline: 'none',
  },
  btnCopied: {
    background: color.successSoft,
    color: color.success,
    borderColor: color.success,
  },
  codeBlock: {
    flex: 1,
    margin: 0,
    padding: '18px 20px',
    fontSize: '13px',
    fontFamily: font.mono,
    lineHeight: 1.65,
    background: color.codeBg,
    color: color.codeText,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    overflowWrap: 'anywhere',
    minHeight: 0,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '48px 24px',
    height: '100%',
    minHeight: 0,
  },
  emptyIcon: {
    fontSize: '32px',
    fontFamily: font.mono,
    fontWeight: 500,
    color: color.codeMuted,
    marginBottom: '16px',
    padding: '12px 20px',
    borderRadius: radius.md,
    border: `1px dashed ${color.codeMuted}`,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: font.sans,
    color: color.codeText,
    margin: '0 0 8px',
  },
  emptyHint: {
    fontSize: '13px',
    fontFamily: font.sans,
    color: color.codeMuted,
    margin: 0,
    maxWidth: '320px',
    lineHeight: 1.5,
  },
}
