import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { BookOpen, ExternalLink } from "lucide-react";

import type { WikiPage } from "@/hooks/useWiki";

interface WikiContentRendererProps {
  content: string;
  wikiPages: WikiPage[];
  onNavigate: (pageId: string) => void;
}

/**
 * Renders wiki markdown content. For the Welcome page, plain-text references
 * matching other wiki page titles are rendered as styled clickable cards.
 */
const WikiContentRenderer = ({ content, wikiPages, onNavigate }: WikiContentRendererProps) => {
  // Build a lookup: normalised title → page
  const titleMap = useMemo(() => {
    const map = new Map<string, WikiPage>();
    for (const p of wikiPages) {
      map.set(p.title.toLowerCase().trim(), p);
    }
    return map;
  }, [wikiPages]);

  // Split content into lines and process each one
  const sections = useMemo(() => {
    const lines = content.split("\n");
    const result: Array<
      | { type: "markdown"; text: string }
      | { type: "internal-link"; page: WikiPage; label: string }
      | { type: "external-link-line"; href: string; label: string }
    > = [];

    let mdBuffer = "";

    const flushMd = () => {
      if (mdBuffer.trim()) {
        result.push({ type: "markdown", text: mdBuffer });
      }
      mdBuffer = "";
    };

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect list items that are plain text matching a wiki page title
      // Patterns: "- Title", "- **Title**", "- 📊 Title — extra text"
      const listMatch = trimmed.match(/^[-*]\s+(?:\*\*)?(?:📊\s*)?(.+?)(?:\*\*)?(?:\s*—.*)?$/);
      if (listMatch) {
        const candidate = listMatch[1].trim().replace(/\*\*/g, "");
        const matched = titleMap.get(candidate.toLowerCase().trim());
        if (matched) {
          flushMd();
          result.push({ type: "internal-link", page: matched, label: candidate });
          continue;
        }
      }

      // Detect list items with "Label: wiki-title" pattern, e.g. "- **Weekly Team Meeting Agenda:** Weekly Team Meeting Agenda"
      const colonMatch = trimmed.match(/^[-*]\s+\*\*(.+?):\*\*\s*(.+)$/);
      if (colonMatch) {
        const valueText = colonMatch[2].trim();
        // Check if the value part (before any " — " suffix) matches a wiki page
        const valueBefore = valueText.split("—")[0].trim();
        const matched = titleMap.get(valueBefore.toLowerCase().trim());
        if (matched) {
          flushMd();
          result.push({ type: "internal-link", page: matched, label: colonMatch[1].trim() });
          continue;
        }
      }

      // Detect list items that are markdown external links: "- [Label](url)"
      const extLinkMatch = trimmed.match(/^[-*]\s+\[(.+?)\]\((.+?)\)\s*$/);
      if (extLinkMatch) {
        flushMd();
        result.push({ type: "external-link-line", label: extLinkMatch[1], href: extLinkMatch[2] });
        continue;
      }

      mdBuffer += line + "\n";
    }

    flushMd();
    return result;
  }, [content, titleMap]);

  return (
    <div className="space-y-6">
      {sections.map((section, i) => {
        if (section.type === "markdown") {
          return (
            <div
              key={i}
              className="prose prose-sm prose-invert max-w-none leading-relaxed prose-headings:text-foreground prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:border-border/40 prose-h2:pb-2 prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-p:text-foreground/85 prose-p:leading-7 prose-strong:text-foreground prose-code:text-primary prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-li:text-foreground/85 prose-hr:border-border/30 prose-blockquote:border-primary/30 prose-blockquote:text-foreground/70"
            >
              <ReactMarkdown>{section.text}</ReactMarkdown>
            </div>
          );
        }

        if (section.type === "internal-link") {
          return (
            <button
              key={i}
              onClick={() => onNavigate(section.page.id)}
              className="flex items-center gap-2 pl-4 py-0.5 text-left group w-full"
            >
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              <span className="text-sm text-primary/80 underline decoration-primary/20 underline-offset-2 group-hover:text-primary group-hover:decoration-primary/50 transition-colors">
                {section.label}
              </span>
            </button>
          );
        }

        if (section.type === "external-link-line") {
          return (
            <a
              key={i}
              href={section.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 pl-4 py-0.5 group w-full"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <span className="text-sm text-foreground/60 underline decoration-border/40 underline-offset-2 group-hover:text-foreground/80 group-hover:decoration-border transition-colors">
                {section.label}
              </span>
            </a>
          );
        }

        return null;
      })}
    </div>
  );
};

export default WikiContentRenderer;
