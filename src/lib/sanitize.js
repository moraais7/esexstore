const ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "H2", "H3", "H4",
  "BLOCKQUOTE", "SPAN", "DIV", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "A",
]);

const BLOCKED_WITH_CONTENT = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META"]);

/**
 * Limpa o HTML vindo de descrições importadas (Nuvemshop) antes de renderizar.
 */
export function sanitizeHtml(html) {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return String(html).replace(/<[^>]*>/g, "");
  }
  const doc = new DOMParser().parseFromString(String(html), "text/html");

  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) return;
      if (child.nodeType !== 1) {
        child.remove();
        return;
      }
      if (BLOCKED_WITH_CONTENT.has(child.tagName)) {
        child.remove();
        return;
      }
      if (!ALLOWED_TAGS.has(child.tagName)) {
        const fragment = doc.createDocumentFragment();
        while (child.firstChild) fragment.appendChild(child.firstChild);
        child.replaceWith(fragment);
        walk(node);
        return;
      }
      Array.from(child.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || "");
        if (name.startsWith("on") || name === "style" || name === "srcset") {
          child.removeAttribute(attr.name);
          return;
        }
        if (name === "href" && /^\s*javascript:/i.test(value)) child.removeAttribute(attr.name);
        if (name === "src" && !/^https?:/i.test(value)) child.removeAttribute(attr.name);
      });
      walk(child);
    });
  };

  walk(doc.body);
  return doc.body.innerHTML.replace(/<p>\s*<\/p>/g, "").trim();
}

export const plainText = (html) =>
  String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();