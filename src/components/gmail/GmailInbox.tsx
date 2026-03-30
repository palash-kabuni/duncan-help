import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, Mail, MailOpen, ChevronRight, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGmailEmails, useGmailSearch, type GmailEmail } from "@/hooks/useGmailIntegration";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isValid } from "date-fns";

interface GmailInboxProps {
  onSelectEmail: (id: string) => void;
  selectedId?: string;
}

function formatEmailDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (!isValid(d)) return dateStr;
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return format(d, "h:mm a");
    }
    return format(d, "MMM d");
  } catch {
    return dateStr;
  }
}

function extractName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.split("@")[0];
}

const GmailInbox = ({ onSelectEmail, selectedId }: GmailInboxProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [pageToken, setPageToken] = useState<string | undefined>();
  const qc = useQueryClient();

  const { data: listData, isLoading: listLoading } = useGmailEmails(pageToken);
  const { results: searchResults, loading: searchLoading, search, clear } = useGmailSearch();

  const isSearchMode = searchQuery.trim().length > 0 && searchResults !== null;
  const emails: GmailEmail[] = isSearchMode ? (searchResults?.emails || []) : (listData?.emails || []);
  const isLoading = isSearchMode ? searchLoading : listLoading;
  const nextToken = isSearchMode ? searchResults?.nextPageToken : listData?.nextPageToken;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) search(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    clear();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-border">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) handleClearSearch();
            }}
            placeholder="Search emails..."
            className="pl-9 pr-10 h-9 bg-secondary/30 border-border text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </form>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            {isSearchMode ? "Search Results" : "Inbox"}
          </span>
          <button
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["gmail-emails"] });
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Mail className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">{isSearchMode ? "No emails found" : "No emails"}</p>
          </div>
        ) : (
          <>
            {emails.map((email, i) => (
              <motion.button
                key={email.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => onSelectEmail(email.id)}
                className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-secondary/40 transition-colors group ${
                  selectedId === email.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                } ${email.isUnread ? "" : "opacity-80"}`}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    {email.isUnread ? (
                      <Mail className="h-4 w-4 text-primary" />
                    ) : (
                      <MailOpen className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs truncate ${email.isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/70"}`}>
                        {extractName(email.from)}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {formatEmailDate(email.date)}
                      </span>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${email.isUnread ? "font-medium text-foreground" : "text-foreground/60"}`}>
                      {email.subject || "(no subject)"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {email.snippet}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 mt-1 transition-colors" />
                </div>
              </motion.button>
            ))}

            {/* Load more */}
            {nextToken && (
              <button
                onClick={() => {
                  if (isSearchMode) {
                    search(searchQuery, nextToken);
                  } else {
                    setPageToken(nextToken);
                  }
                }}
                className="w-full py-3 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GmailInbox;
