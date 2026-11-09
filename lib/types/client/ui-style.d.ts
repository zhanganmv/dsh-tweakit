/** Attribute marking the section's static style element. */
export declare const UI_STYLE_ATTRIBUTE = "data-dsh-tweakit-ui";
/**
 * Install the section stylesheet.
 * @param target - document to own (injectable for tests).
 * @returns a disposer removing every element this plugin created.
 */
export declare function installUiStyle(target?: Document): () => void;
