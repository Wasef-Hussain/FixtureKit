import { useState } from 'react'
import type { FixtureOutput } from '../lib/generator/generateFixture'
import type { OutputTab } from '../hooks/useFixtureGen'

interface Props {
  output: FixtureOutput | null
  activeTab: OutputTab
  onTabChange: (tab: OutputTab) => void
}

const ALL_TABS: OutputTab[] = ['ts', 'json', 'msw', 'playwright']

const TAB_META: Record<OutputTab, { label: string; ext: string; mime: string }> = {
  ts:          { label: '.ts',         ext: '.ts',          mime: 'text/typescript' },
  json:        { label: '.json',       ext: '.json',        mime: 'application/json' },
  msw:         { label: '.msw',        ext: '.handler.ts',  mime: 'text/typescript' },
  playwright:  { label: '.playwright', ext: '.spec.ts',     mime: 'text/typescript' },
}

export default function OutputPane({ output, activeTab, onTabChange }: Props) {
  const empty = output === null
  const activeCode = empty ? '' : output[activeTab]

  return (
    <div style={styles.wrapper}>
      {/* --- Tab row --- */}
      <div style={styles.tabRow}>
        {ALL_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
          >
            {TAB_META[tab].label}
          </button>
        ))}
        <span style={styles.spacer} />
        <CopyBtn code={activeCode} disabled={empty} />
        <DownloadBtn code={activeCode} disabled={empty} meta={TAB_META[activeTab]} />
      </div>

      {/* --- Code display --- */}
      <pre style={styles.codeBlock}>
        {empty ? (
          <span style={styles.placeholder}>Generated fixture will appear here</span>
        ) : (
          <code>{activeCode}</code>
        )}
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
        // Fallback for older browsers / non-HTTPS
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
      {copied ? 'Copied!' : 'Copy'}
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
  function handleDownload() {
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
  }

  return (
    <button style={styles.actionBtn} onClick={handleDownload} disabled={disabled}>
      Download{meta.ext}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    height: '100%',
  },
  tabRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    borderBottom: '1px solid #d1d5db',
    marginBottom: '12px',
  },
  tab: {
    padding: '8px 16px',
    fontSize: '12px',
    fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    color: '#6b7280',
    cursor: 'pointer',
    outline: 'none',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: '#2563eb',
    borderBottomColor: '#2563eb',
  },
  spacer: {
    flex: 1,
  },
  actionBtn: {
    padding: '5px 12px',
    fontSize: '12px',
    fontFamily: 'inherit',
    fontWeight: 500,
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#ffffff',
    color: '#374151',
    cursor: 'pointer',
    outline: 'none',
    marginLeft: '8px',
  },
  btnCopied: {
    background: '#10b981',
    color: '#ffffff',
    borderColor: '#10b981',
  },
  codeBlock: {
    flex: 1,
    margin: 0,
    padding: '16px',
    fontSize: '14px',
    fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
    lineHeight: 1.7,
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#1e1e2e',
    color: '#cdd6f4',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  placeholder: {
    color: '#6c7086',
    fontStyle: 'italic',
  },
}
