import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { BookOpen, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
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
    <div className="space-y-0.5">
      {sections.map((section, i) => {
        if (section.type === "markdown") {
          return (
            <div
              key={i}
              className="prose prose-sm prose-invert max-w-none leading-7 prose-headings:text-foreground prose-headings:mt-8 prose-headings:mb-3 prose-p:text-foreground/90 prose-strong:text-foreground prose-code:text-primary prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-li:text-foreground/90 prose-hr:border-border prose-hr:my-6 prose-blockquote:border-primary/30"
            >
              <ReactMarkdown>{section.text}</ReactMarkdown>
            </div>
          );
        }

        if (section.type === "internal-link") {
          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onNavigate(section.page.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-3.5 py-2.5 text-left hover:bg-primary/[0.06] hover:border-primary/25 transition-all duration-200 group"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <BookOpen className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {section.label}
                </span>
                {section.page.summary && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{section.page.summary}</p>
                )}
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">Wiki</span>
            </motion.button>
          );
        }

        if (section.type === "external-link-line") {
          return (
            <a
              key={i}
              href={section.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-3 rounded-lg border border-border/30 bg-secondary/20 px-3.5 py-2.5 text-left hover:bg-secondary/40 hover:border-border/50 transition-all duration-200 group"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground group-hover:text-foreground transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-medium text-foreground/75 group-hover:text-foreground transition-colors truncate">
                {section.label}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">External</span>
            </a>
          );
        }

        return null;
      })}
    </div>
  );
};

export default WikiContentRenderer;
