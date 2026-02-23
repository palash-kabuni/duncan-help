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
    <div className="space-y-2">
      {sections.map((section, i) => {
        if (section.type === "markdown") {
          return (
            <div
              key={i}
              className="prose prose-sm prose-invert max-w-none leading-7 prose-headings:text-foreground prose-headings:tracking-tight prose-headings:mt-8 prose-headings:mb-3 prose-p:text-foreground/85 prose-p:leading-relaxed prose-strong:text-foreground prose-code:text-primary prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-li:text-foreground/85 prose-hr:border-border/50 prose-hr:my-6 prose-blockquote:border-primary/30 prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4"
            >
              <ReactMarkdown>{section.text}</ReactMarkdown>
            </div>
          );
        }

        if (section.type === "internal-link") {
          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025, duration: 0.25 }}
              onClick={() => onNavigate(section.page.id)}
              className="flex w-full items-center gap-3.5 rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm px-4 py-3.5 text-left hover:bg-card/80 hover:border-primary/40 hover:shadow-[0_0_16px_-4px_hsl(var(--primary)/0.15)] transition-all duration-300 group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 group-hover:scale-105 transition-all duration-300">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground/95 group-hover:text-primary transition-colors duration-200">
                  {section.label}
                </span>
                {section.page.summary && (
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate leading-snug">{section.page.summary}</p>
                )}
              </div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/40 shrink-0 group-hover:text-primary/50 transition-colors">Wiki</span>
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
              className="flex w-full items-center gap-3.5 rounded-xl border border-border/50 bg-secondary/20 backdrop-blur-sm px-4 py-3.5 text-left hover:bg-secondary/40 hover:border-border transition-all duration-300 group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground group-hover:text-foreground group-hover:bg-muted transition-all duration-300">
                <ExternalLink className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-foreground/75 group-hover:text-foreground transition-colors duration-200 truncate">
                {section.label}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/40 shrink-0">Ext</span>
            </a>
          );
        }

        return null;
      })}
    </div>
  );
};

export default WikiContentRenderer;
