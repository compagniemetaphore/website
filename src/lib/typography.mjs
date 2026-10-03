/**
 * French typography: non-breaking spaces before ? ! : ; and inside « »,
 * so the punctuation never starts a new line.
 */
const NNBSP = ' '; // narrow no-break space
const NBSP = ' ';

export function frenchSpacing(text) {
    return text
        .replace(/ ([?!;])/g, `${NNBSP}$1`)
        .replace(/ :(?=\s|$)/g, `${NBSP}:`)
        .replace(/« /g, `«${NBSP}`)
        .replace(/ »/g, `${NBSP}»`);
}

/** Rehype plugin applying frenchSpacing to every text of the markdown content. */
export function rehypeFrenchSpacing() {
    const visit = (node) => {
        if (node.type === 'text') node.value = frenchSpacing(node.value);
        if (node.tagName === 'code' || node.tagName === 'pre') return;
        node.children?.forEach(visit);
    };
    return (tree) => visit(tree);
}
