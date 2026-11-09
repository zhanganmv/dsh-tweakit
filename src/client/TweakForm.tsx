/**
 * Generic renderer for declarative tweak fields.
 *
 * Every control maps to one `TweakField` kind, so a new tweak contributes
 * field metadata instead of React. Labels/hints/units come from the shared
 * field spec; only behaviour (clamp, commit, keyboard) lives here.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  clamp,
  type LocalizedText,
  type TweakField,
  type TweakNumberField,
  type TweakSegmentedField,
  type TweakUi,
} from '../shared/prefs'

/** Locale ids the shared field specs carry. */
export type Lang = 'zh' | 'en'

/** Resolve one bilingual text. */
export function text(value: LocalizedText, lang: Lang): string {
  return lang === 'zh' ? value.zh : value.en
}

/** Props of the generic form. */
export interface TweakFormProps<P extends object> {
  readonly ui: TweakUi<P>
  readonly prefs: P
  readonly lang: Lang
  readonly disabled: boolean
  readonly onPatch: (next: Partial<P>) => void
}

/** One field wrapper: label, control slot, optional hint. */
function FieldShell(props: {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly children: ReactNode
}) {
  return (
    <div className="tk-field">
      <label className="tk-label" htmlFor={props.id}>
        {props.label}
      </label>
      {props.children}
      {props.hint === undefined ? null : <div className="tk-hint">{props.hint}</div>}
    </div>
  )
}

/** Slider paired with a typable numeric value. */
function NumberControl(props: {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly spec: TweakNumberField<Record<string, unknown>>
  readonly value: number
  readonly disabled: boolean
  readonly onCommit: (value: number) => void
}) {
  const { id, label, hint, spec, value, disabled, onCommit } = props
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = (): void => {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const next = clamp(Math.round(parsed), spec.min, spec.max)
    setDraft(String(next))
    if (next !== value) onCommit(next)
  }

  return (
    <FieldShell id={id} label={label} hint={hint}>
      <div className="tk-value">
        <input
          id={id}
          className="tk-input"
          type="number"
          inputMode="numeric"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={draft}
          disabled={disabled}
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commit()
          }}
        />
        {spec.unit === undefined ? null : <span className="tk-unit">{spec.unit}</span>}
      </div>
      {spec.kind !== 'slider' ? null : (
        <input
          className="tk-slider"
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => {
            const next = clamp(Math.round(Number(event.target.value)), spec.min, spec.max)
            if (next !== value) onCommit(next)
          }}
        />
      )}
    </FieldShell>
  )
}

/** Segmented radiogroup with arrow-key selection. */
function SegmentedControl(props: {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly spec: TweakSegmentedField<Record<string, unknown>>
  readonly value: string
  readonly lang: Lang
  readonly disabled: boolean
  readonly onChange: (value: string) => void
}) {
  const { id, label, hint, spec, value, lang, disabled, onChange } = props
  const buttons = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const index = spec.options.findIndex((option) => option.value === value)
    const delta = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (index + delta + spec.options.length) % spec.options.length
    const next = spec.options[nextIndex]
    if (next === undefined) return
    onChange(next.value)
    buttons.current[nextIndex]?.focus()
  }

  return (
    <div className="tk-field tk-field-segmented">
      <span className="tk-label" id={`${id}-label`}>
        {label}
      </span>
      <div
        className="tk-segmented"
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        onKeyDown={onKeyDown}
      >
        {spec.options.map((option, index) => (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className="tk-segment"
            disabled={disabled}
            tabIndex={value === option.value ? 0 : -1}
            onClick={() => {
              if (option.value !== value) onChange(option.value)
            }}
          >
            {text(option.label, lang)}
          </button>
        ))}
      </div>
      {hint === undefined ? null : <div className="tk-hint">{hint}</div>}
    </div>
  )
}

/** Boolean switch. */
function SwitchControl(props: {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly value: boolean
  readonly disabled: boolean
  readonly onChange: (value: boolean) => void
}) {
  const { id, label, hint, value, disabled, onChange } = props
  return (
    <div className="tk-field">
      <span className="tk-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        aria-labelledby={`${id}-label`}
        className="tk-switch"
        disabled={disabled}
        onClick={() => {
          onChange(!value)
        }}
      >
        <span className="tk-switch-thumb" />
      </button>
      {hint === undefined ? null : <div className="tk-hint">{hint}</div>}
    </div>
  )
}

/** Free-text input. */
function TextControl(props: {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly placeholder?: string
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (value: string) => void
}) {
  const { id, label, hint, placeholder, value, disabled, onChange } = props
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <input
        id={id}
        className="tk-input tk-input-wide"
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </FieldShell>
  )
}

/** Render one field by kind. */
function Field(props: {
  readonly field: TweakField<Record<string, unknown>>
  readonly prefs: Record<string, unknown>
  readonly id: string
  readonly lang: Lang
  readonly disabled: boolean
  readonly onPatch: (next: Record<string, unknown>) => void
}) {
  const { field, prefs, id, lang, disabled, onPatch } = props
  const label = text(field.label, lang)
  const hint = field.hint === undefined ? undefined : text(field.hint, lang)
  const fieldDisabled = disabled || (field.disabledWhen?.(prefs) ?? false)

  switch (field.kind) {
    case 'segmented':
      return (
        <SegmentedControl
          id={id}
          label={label}
          hint={hint}
          spec={field}
          value={String(prefs[field.field] ?? '')}
          lang={lang}
          disabled={fieldDisabled}
          onChange={(value) => {
            onPatch({ [field.field]: value })
          }}
        />
      )
    case 'number':
    case 'slider':
      return (
        <NumberControl
          id={id}
          label={label}
          hint={hint}
          spec={field}
          value={Number(prefs[field.field] ?? 0)}
          disabled={fieldDisabled}
          onCommit={(value) => {
            onPatch({ [field.field]: value })
          }}
        />
      )
    case 'switch':
      return (
        <SwitchControl
          id={id}
          label={label}
          hint={hint}
          value={Boolean(prefs[field.field])}
          disabled={fieldDisabled}
          onChange={(value) => {
            onPatch({ [field.field]: value })
          }}
        />
      )
    case 'text':
      return (
        <TextControl
          id={id}
          label={label}
          hint={hint}
          placeholder={field.placeholder === undefined ? undefined : text(field.placeholder, lang)}
          value={String(prefs[field.field] ?? '')}
          disabled={fieldDisabled}
          onChange={(value) => {
            onPatch({ [field.field]: value })
          }}
        />
      )
  }
}

/**
 * Render every visible field of one tweak.
 * @param props - field metadata, current preferences, and the patch callback.
 * @returns the form body.
 */
export function TweakForm<P extends object>({
  ui,
  prefs,
  lang,
  disabled,
  onPatch,
}: TweakFormProps<P>) {
  const prefix = useId()
  const values = prefs as unknown as Record<string, unknown>

  return (
    <div className="tk-fields">
      {ui.fields.map((field) => {
        if (field.visibleWhen?.(prefs) === false) return null
        return (
          <Field
            key={field.key}
            field={field as unknown as TweakField<Record<string, unknown>>}
            prefs={values}
            id={`${prefix}-${field.key}`}
            lang={lang}
            disabled={disabled}
            onPatch={(next) => {
              onPatch(next as Partial<P>)
            }}
          />
        )
      })}
    </div>
  )
}
