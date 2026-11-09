// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TweakitSection } from '../src/client/TweakitSection'
import { copyFor } from '../src/client/i18n'
import type { PrefsState, PrefsStore } from '../src/client/store'
import { createDefaultPrefs, normalizePrefs } from '../src/shared/prefs'

afterEach(() => {
  cleanup()
})

/** A store stub over a fixed snapshot. */
function createStore(
  state: PrefsState,
  overrides: Partial<PrefsStore> = {},
): PrefsStore & { patchAny: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn> } {
  return {
    getSnapshot: () => state,
    subscribe: () => () => {},
    start: () => {},
    refresh: vi.fn(),
    patch: vi.fn(),
    patchAny: vi.fn(),
    reset: vi.fn(),
    dispose: () => {},
    ...overrides,
  } as PrefsStore & { patchAny: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn> }
}

/** A loaded state with the default settings-panel tweak. */
function loadedState(): PrefsState {
  return {
    prefs: createDefaultPrefs(),
    revision: 3,
    writable: true,
    loaded: true,
    status: 'idle',
    error: null,
  }
}

describe('Tweaks section', () => {
  it('renders the group and the effective-size readout from declarative fields', () => {
    const store = createStore(loadedState())
    render(<TweakitSection store={store} copy={copyFor('en')} lang="en" close={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Tweaks', level: 2 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Settings window', level: 3 })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Custom' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeTruthy()
    expect(screen.getByRole('spinbutton', { name: 'Height' })).toBeTruthy()
    expect(screen.getByRole('spinbutton', { name: 'Margin' })).toBeTruthy()
  })

  it('patches the mode and the slider value', () => {
    const store = createStore(loadedState())
    render(<TweakitSection store={store} copy={copyFor('en')} lang="en" close={() => {}} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Full' }))
    expect(store.patchAny).toHaveBeenCalledWith('settings-panel', { mode: 'full' })

    store.patchAny.mockClear()
    fireEvent.change(screen.getByRole('slider', { name: 'Width' }), {
      target: { value: '1500' },
    })
    expect(store.patchAny).toHaveBeenCalledWith('settings-panel', { width: 1500 })
  })

  it('commits a typed value on Enter and clamps it', () => {
    const store = createStore(loadedState())
    render(<TweakitSection store={store} copy={copyFor('en')} lang="en" close={() => {}} />)

    const width = screen.getByRole('spinbutton', { name: 'Width' })
    fireEvent.change(width, { target: { value: '99' } })
    fireEvent.keyDown(width, { key: 'Enter' })
    expect(store.patchAny).toHaveBeenCalledWith('settings-panel', { width: 640 })
  })

  it('hides width and height fields outside custom mode', () => {
    const store = createStore({
      ...loadedState(),
      prefs: normalizePrefs({ tweaks: { 'settings-panel': { mode: 'full', margin: 12 } } }),
    })
    render(<TweakitSection store={store} copy={copyFor('en')} lang="en" close={() => {}} />)

    expect(screen.queryByRole('spinbutton', { name: 'Width' })).toBeNull()
    expect(screen.queryByRole('spinbutton', { name: 'Height' })).toBeNull()
    expect(screen.getByRole('spinbutton', { name: 'Margin' })).toBeTruthy()
  })

  it('disables the generated controls and offers retry when the namespace is unavailable', () => {
    const refresh = vi.fn(() => {})
    const store = createStore(
      {
        ...loadedState(),
        writable: false,
        error: { code: 'settings-unavailable', message: 'missing', source: 'load' },
      },
      { refresh },
    )
    render(<TweakitSection store={store} copy={copyFor('en')} lang="en" close={() => {}} />)

    expect(screen.getByRole('alert').textContent).toContain('cannot save settings')
    const radios = screen.getAllByRole('radio')
    expect(radios.every((radio) => (radio as HTMLButtonElement).disabled)).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('restores defaults from the card action', () => {
    const store = createStore(loadedState())
    render(<TweakitSection store={store} copy={copyFor('en')} lang="en" close={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    expect(store.reset).toHaveBeenCalledWith('settings-panel')
  })

  it('uses the zh field metadata when the locale is zh', () => {
    const store = createStore(loadedState())
    render(<TweakitSection store={store} copy={copyFor('zh')} lang="zh" close={() => {}} />)

    expect(screen.getByRole('heading', { name: '设置窗口' })).toBeTruthy()
    expect(screen.getByRole('spinbutton', { name: '宽度' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '全屏' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: '配置项导航' })).toBeTruthy()
  })

  it('renders the navigation and points the panel at the selected tweak', () => {
    const store = createStore(loadedState())
    render(<TweakitSection store={store} copy={copyFor('en')} lang="en" close={() => {}} />)

    const tab = screen.getByRole('tab', { name: 'Settings window' })
    expect(tab.getAttribute('aria-selected')).toBe('true')
    expect(tab.getAttribute('aria-controls')).toContain('-panel')
    expect(screen.getByRole('tabpanel').getAttribute('aria-label')).toBe('Settings window')

    // One owning group: no group header, no indentation, no group picker.
    expect(screen.queryByRole('button', { name: 'DSH' })).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
