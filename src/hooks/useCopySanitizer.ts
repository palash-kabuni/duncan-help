import { useEffect } from "react";

/**
 * Global copy sanitizer that strips dark-theme styles from copied content
 * across all Duncan UI areas, preserving clean document formatting.
 * Skips inputs, textareas, and contenteditable fields.
 */
export function useCopySanitizer() {
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const anchorNode = selection.anchorNode;
      if (!anchorNode) return;

      // Find the element containing the selection
      const el = anchorNode.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as HTMLElement)
        : anchorNode.parentElement;
      if (!el) return;

      // Skip editable fields
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active?.getAttribute("contenteditable") === "true"
      ) return;

      // Only intercept within Duncan app container
      const appRoot = document.getElementById("root");
      if (!appRoot || !appRoot.contains(el)) return;

      const range = selection.getRangeAt(0);
      const cloned = range.cloneContents();

      sanitizeNode(cloned);

      const wrapper = document.createElement("div");
      wrapper.style.backgroundColor = "#ffffff";
      wrapper.style.color = "#111";
      wrapper.style.fontFamily = "Arial, Helvetica, sans-serif";
      wrapper.style.fontSize = "14px";
      wrapper.style.lineHeight = "1.6";
      wrapper.appendChild(cloned);

      e.clipboardData?.setData("text/html", wrapper.outerHTML);
      e.clipboardData?.setData("text/plain", selection.toString());
      e.preventDefault();
    };

    document.addEventListener("copy", handler);
    return () => document.removeEventListener("copy", handler);
  }, []);
}

function sanitizeNode(node: Node) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    el.removeAttribute("style");
    el.removeAttribute("class");
    Array.from(el.attributes)
      .filter((a) => a.name.startsWith("data-"))
      .forEach((a) => el.removeAttribute(a.name));

    const base = { color: "#111", fontFamily: "Arial, Helvetica, sans-serif" };

    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
      const sizes: Record<string, string> = { h1: "22px", h2: "18px", h3: "16px" };
      Object.assign(el.style, { ...base, fontSize: sizes[tag] || "14px", fontWeight: "bold", margin: "16px 0 8px 0", lineHeight: "1.4" });
    } else if (tag === "p") {
      Object.assign(el.style, { ...base, fontSize: "14px", margin: "0 0 10px 0", lineHeight: "1.6" });
    } else if (tag === "li") {
      Object.assign(el.style, { ...base, fontSize: "14px", marginBottom: "4px", lineHeight: "1.6" });
    } else if (["ul", "ol"].includes(tag)) {
      Object.assign(el.style, { margin: "8px 0", paddingLeft: "24px" });
    } else if (tag === "strong" || tag === "b") {
      Object.assign(el.style, { fontWeight: "bold", color: "#111" });
    } else if (tag === "em" || tag === "i") {
      Object.assign(el.style, { fontStyle: "italic", color: "#111" });
    } else if (tag === "code") {
      Object.assign(el.style, { fontFamily: "Consolas, monospace", fontSize: "13px", backgroundColor: "#f3f4f6", color: "#111", padding: "1px 4px", borderRadius: "3px" });
    } else if (tag === "pre") {
      Object.assign(el.style, { fontFamily: "Consolas, monospace", fontSize: "13px", backgroundColor: "#f3f4f6", color: "#111", padding: "12px", borderRadius: "6px", margin: "10px 0", whiteSpace: "pre-wrap" });
    } else if (tag === "blockquote") {
      Object.assign(el.style, { borderLeft: "3px solid #d1d5db", paddingLeft: "12px", margin: "10px 0", color: "#333" });
    } else if (["td", "th"].includes(tag)) {
      Object.assign(el.style, { ...base, fontSize: "13px", padding: "6px 10px", border: "1px solid #d1d5db" });
      if (tag === "th") el.style.fontWeight = "bold";
    } else if (tag === "a") {
      Object.assign(el.style, { color: "#1a73e8", textDecoration: "underline" });
    } else if (tag === "div" || tag === "span") {
      Object.assign(el.style, { ...base, fontSize: "14px" });
    }
  }
  node.childNodes.forEach(sanitizeNode);
}
