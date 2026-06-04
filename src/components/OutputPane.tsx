import { useState } from 'react'

interface Props {
  output: string
}

export default function OutputPane({ output }: Props) {
  const [copied, setCopied] = useState(false)
  const empty = output.length === 0

  function handleCopy() {
    if (empty) return
    navigator.clipboard.writeText(output).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {
        // Fallback for older browsers / non-HTTPS
        const ta = document.createElement('textarea')
        ta.value = output
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

  function handleDownload() {
    if (empty) return
    const blob = new Blob([output], { type: 'text/typescript' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fixture.ts'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <span style={styles.label}>Output</span>
        <div style={styles.buttons}>
          <button
            style={{ ...styles.btn, ...(copied ? styles.btnCopied : {}) }}
            onClick={handleCopy}
            disabled={empty}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button style={styles.btn} onClick={handleDownload} disabled={empty}>
            Download .ts
          </button>
        </div>
      </div>

      <pre style={styles.codeBlock}>
        {empty ? (
          <span style={styles.placeholder}>Generated fixture will appear here</span>
        ) : (
          <code>{output}</code>
        )}
      </pre>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    height: '100%',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
  },
  buttons: {
    display: 'flex',
    gap: '8px',
  },
  btn: {
    padding: '6px 14px',
    fontSize: '13px',
    fontFamily: 'inherit',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#ffffff',
    color: '#374151',
    cursor: 'pointer',
    outline: 'none',
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
