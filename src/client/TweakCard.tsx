/**
 * One tweak's card: declarative title/description, the generated fields, an
 * optional custom extra (readout/preview), and the reset action.
 */
import type { ReactNode } from 'react'
import type { TweakUi } from '../shared/prefs'
import { TweakForm, text, type Lang } from './TweakForm'
import type { Copy } from './i18n'
import type { SaveStatus } from './store'

/** Props of one generated tweak card. */
export interface TweakCardProps<P extends object> {
  readonly ui: TweakUi<P>
  readonly prefs: P
  readonly lang: Lang
  readonly copy: Copy
  readonly status: SaveStatus
  readonly disabled: boolean
  readonly onPatch: (next: Partial<P>) => void
  readonly onReset: () => void
  /** Custom content rendered below the generated fields. */
  readonly extra?: ReactNode
}

/** Save feedback badge. */
function StatusBadge({ status, copy }: { readonly status: SaveStatus; readonly copy: Copy }) {
  if (status === 'idle') return null
  const label =
    status === 'saving' ? copy.saving : status === 'saved' ? copy.saved : copy.saveFailed
  const tone = status === 'error' ? 'error' : status === 'saved' ? 'success' : 'idle'
  return (
    <span className="tk-status" data-tone={tone} role="status" aria-live="polite">
      {label}
    </span>
  )
}

/**
 * Render one tweak group card.
 * @param props - metadata, values, and callbacks.
 * @returns the card.
 */
export function TweakCard<P extends object>(props: TweakCardProps<P>) {
  const { ui, prefs, lang, copy, status, disabled, onPatch, onReset, extra } = props

  return (
    <section className="tk-card">
      <header className="tk-card-head">
        <div>
          <h3 className="tk-card-title">{text(ui.title, lang)}</h3>
          <p className="tk-card-desc">{text(ui.description, lang)}</p>
        </div>
        <StatusBadge status={status} copy={copy} />
      </header>

      <TweakForm ui={ui} prefs={prefs} lang={lang} disabled={disabled} onPatch={onPatch} />

      {extra}

      <div className="tk-footer">
        <button type="button" className="tk-button" disabled={disabled} onClick={onReset}>
          {copy.reset}
        </button>
      </div>
    </section>
  )
}
