/**
 * Static section stylesheet injection.
 *
 * The component CSS is authored as a real CSS file and imported as text
 * (`esbuild` `loader: { '.css': 'text' }`), so there is no runtime CSS-module
 * machinery and no second bundler concern. One style element per plugin
 * instance; the disposer removes it with the fiber.
 */
import uiCss from './ui.css'

/** Attribute marking the section's static style element. */
export const UI_STYLE_ATTRIBUTE = 'data-dsh-tweakit-ui'

/**
 * Install the section stylesheet.
 * @param target - document to own (injectable for tests).
 * @returns a disposer removing every element this plugin created.
 */
export function installUiStyle(target: Document = document): () => void {
  if (uiCss.trim() === '') return () => {}

  const style = target.createElement('style')
  style.setAttribute(UI_STYLE_ATTRIBUTE, '')
  style.textContent = uiCss
  target.head.appendChild(style)

  return () => {
    style.remove()
    target.querySelectorAll(`style[${UI_STYLE_ATTRIBUTE}]`).forEach((element) => {
      element.remove()
    })
  }
}
