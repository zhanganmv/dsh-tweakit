// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { TweakNav, type NavGroup } from '../src/client/TweakNav'
import { copyFor } from '../src/client/i18n'

afterEach(() => {
  cleanup()
})

/** Read one list entry without a non-null assertion. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new Error(`missing item at ${index}`)
  return item
}

const GROUPS: readonly NavGroup[] = [
  {
    id: 'dsh',
    title: 'DSH',
    tweaks: [
      { id: 'panel', title: 'Settings window' },
      { id: 'typography', title: 'Typography' },
    ],
  },
  {
    id: 'other',
    title: 'Other',
    tweaks: [{ id: 'ext', title: 'Extension' }],
  },
]

/** Stateful wrapper so selection changes render like they do in the section. */
function Harness(props: {
  readonly compact?: boolean
  readonly showGroupHeaders?: boolean
  readonly groups?: readonly NavGroup[]
}) {
  const groups = props.groups ?? GROUPS
  const first = at(groups, 0)
  const [selection, setSelection] = useState({ group: first.id, tweak: at(first.tweaks, 0).id })

  return (
    <>
      <TweakNav
        groups={groups}
        selection={selection}
        showGroupHeaders={props.showGroupHeaders ?? true}
        compact={props.compact ?? false}
        copy={copyFor('en')}
        idPrefix="t"
        onSelect={(group, tweak) => {
          setSelection({ group, tweak })
        }}
      />
      <div id="t-panel" role="tabpanel" aria-label="panel" />
      <div data-testid="selection">{`${selection.group}/${selection.tweak}`}</div>
    </>
  )
}

/** Text of the current selection readout. */
function selected(): string | null {
  return screen.getByTestId('selection').textContent
}

describe('TweakNav', () => {
  it('renders only the selected group and marks the selected tab', () => {
    render(<Harness />)

    expect(screen.getByRole('button', { name: 'DSH' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Other' }).getAttribute('aria-expanded')).toBe(
      'false',
    )
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Settings window',
      'Typography',
    ])

    const tab = screen.getByRole('tab', { name: 'Settings window' })
    expect(tab.getAttribute('aria-selected')).toBe('true')
    expect(tab.getAttribute('aria-controls')).toBe('t-panel')
    expect(tab.getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('vertical')
  })

  it('expands another group and selects its remembered tweak', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('tab', { name: 'Typography' }))
    expect(selected()).toBe('dsh/typography')

    fireEvent.click(screen.getByRole('button', { name: 'Other' }))
    expect(selected()).toBe('other/ext')
    expect(screen.queryByRole('tab', { name: 'Typography' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'DSH' }))
    expect(selected()).toBe('dsh/typography')
    expect(screen.getByRole('tab', { name: 'Typography' }).getAttribute('aria-selected')).toBe(
      'true',
    )
  })

  it('collapses the open group without changing the content selection', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'DSH' }))
    expect(screen.getByRole('button', { name: 'DSH' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(selected()).toBe('dsh/panel')
  })

  it('moves selection and focus with the arrow keys, Home, and End', () => {
    render(<Harness />)
    const first = screen.getByRole('tab', { name: 'Settings window' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(selected()).toBe('dsh/typography')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Typography' }))

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Typography' }), { key: 'Home' })
    expect(selected()).toBe('dsh/panel')

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Settings window' }), { key: 'End' })
    expect(selected()).toBe('dsh/typography')
  })

  it('expands and collapses with the horizontal arrows on a group header', () => {
    render(<Harness />)

    const other = screen.getByRole('button', { name: 'Other' })
    other.focus()
    fireEvent.keyDown(other, { key: 'ArrowRight' })
    expect(selected()).toBe('other/ext')

    fireEvent.keyDown(screen.getByRole('button', { name: 'Other' }), { key: 'ArrowLeft' })
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('switches to a group picker and a horizontal strip when compact', () => {
    render(<Harness compact />)

    expect(screen.queryByRole('button', { name: 'DSH' })).toBeNull()
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('horizontal')
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Settings window',
      'Typography',
    ])

    fireEvent.change(screen.getByRole('combobox', { name: 'Group' }), {
      target: { value: 'other' },
    })
    expect(selected()).toBe('other/ext')
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Extension'])
  })

  it('omits group headers and indentation for a single group', () => {
    render(<Harness showGroupHeaders={false} groups={[at(GROUPS, 0)]} />)

    expect(screen.queryByRole('button', { name: 'DSH' })).toBeNull()
    expect(screen.getByRole('navigation').getAttribute('data-headers')).toBe('false')
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })
})
