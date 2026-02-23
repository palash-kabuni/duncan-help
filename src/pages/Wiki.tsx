import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Search, Plus, ArrowLeft, Edit3, Trash2, Tag, Clock, Eye, Folder } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Sidebar from "@/components/Sidebar";
import WikiEditor from "@/components/wiki/WikiEditor";
import WikiContentRenderer from "@/components/wiki/WikiContentRenderer";
import { useWikiPages, useWikiCategories, useWikiPage, useDeleteWikiPage } from "@/hooks/useWiki";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const Wiki = () => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: pages = [], isLoading } = useWikiPages(selectedCategory, search);
  const { data: allPages = [] } = useWikiPages(null, "");
  const { data: categories = [] } = useWikiCategories();
  const { data: activePage } = useWikiPage(selectedPageId);
  const { isAdmin } = useIsAdmin();
  const deletePage = useDeleteWikiPage();

  const handleDelete = async (id: string) => {
    try {
      await deletePage.mutateAsync(id);
      setSelectedPageId(null);
      toast.success("Page deleted");
    } catch {
      toast.error("Failed to delete page");
    }
  };

  // Editor view
  if (creating || editing) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="ml-64 flex-1 flex flex-col h-screen">
          <WikiEditor
            page={editing && activePage ? activePage : undefined}
            categories={categories}
            onClose={() => { setCreating(false); setEditing(false); }}
            onSaved={(id) => { setCreating(false); setEditing(false); setSelectedPageId(id); }}
          />
        </main>
      </div>
    );
  }

  // Page detail view
  if (selectedPageId && activePage) {
    const category = categories.find((c) => c.id === activePage.category_id);
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="ml-64 flex-1 flex flex-col h-screen">
          <div className="pointer-events-none fixed top-0 left-64 right-0 h-72 gradient-radial z-0" />
          <div className="relative z-10 flex items-center justify-between border-b border-border px-8 py-4">
            <button onClick={() => setSelectedPageId(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Wiki
            </button>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Edit3 className="h-3 w-3" /> Edit
                </button>
                <button onClick={() => handleDelete(activePage.id)} className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-card px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            )}
          </div>
          <div className="relative z-10 flex-1 overflow-y-auto px-8 py-8">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl">
              {category && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary mb-4">
                  <Folder className="h-3 w-3" /> {category.name}
                </span>
              )}
              <h1 className="text-3xl font-bold text-foreground mb-2">{activePage.title}</h1>
              {activePage.summary && <p className="text-muted-foreground text-sm mb-4">{activePage.summary}</p>}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-8">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Updated {formatDistanceToNow(new Date(activePage.updated_at), { addSuffix: true })}</span>
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {activePage.view_count} views</span>
              </div>
              {activePage.tags.length > 0 && (
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  {activePage.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                      <Tag className="h-2.5 w-2.5" /> {tag}
                    </span>
                  ))}
                </div>
              )}
              {activePage.title.includes("Welcome") ? (
                <WikiContentRenderer
                  content={activePage.content}
                  wikiPages={allPages}
                  onNavigate={(id) => setSelectedPageId(id)}
                />
              ) : (
                <div className="prose prose-sm prose-invert max-w-none leading-7 prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-code:text-primary prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-li:text-foreground/90 prose-hr:border-border prose-blockquote:border-primary/30">
                  <ReactMarkdown>{activePage.content}</ReactMarkdown>
                </div>
              )}
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  // List view
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 flex-1 flex flex-col h-screen">
        <div className="pointer-events-none fixed top-0 left-64 right-0 h-72 gradient-radial z-0" />

        <div className="relative z-10 flex items-center justify-between border-b border-border px-8 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">Wiki</h2>
            <p className="text-xs text-muted-foreground font-mono">Company knowledge base · Maintained by Duncan</p>
          </div>
          {isAdmin && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-3 w-3" /> New Page
            </button>
          )}
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Search */}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 focus-within:border-primary/40 transition-all">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search wiki pages…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>

            {/* Categories */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${!selectedCategory ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${selectedCategory === cat.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Pages grid */}
            {isLoading ? (
              <div className="text-center py-20 text-muted-foreground text-sm">Loading…</div>
            ) : pages.length === 0 ? (
              <EmptyState isAdmin={isAdmin} onCreate={() => setCreating(true)} />
            ) : (
              <div className="grid gap-3">
                <AnimatePresence initial={false}>
                  {pages.map((page) => {
                    const cat = categories.find((c) => c.id === page.category_id);
                    return (
                      <motion.button
                        key={page.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        onClick={() => setSelectedPageId(page.id)}
                        className="text-left rounded-xl border border-border bg-card/60 px-5 py-4 hover:bg-card hover:border-primary/20 transition-all duration-200"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-foreground truncate">{page.title}</h3>
                            {page.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{page.summary}</p>}
                            <div className="flex items-center gap-3 mt-2">
                              {cat && <span className="text-[10px] font-mono text-primary">{cat.name}</span>}
                              <span className="text-[10px] text-muted-foreground/60">
                                {formatDistanceToNow(new Date(page.updated_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                          <BookOpen className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const EmptyState = ({ isAdmin, onCreate }: { isAdmin: boolean; onCreate: () => void }) => (
  <div className="flex flex-col items-center justify-center py-20">
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 glow-primary mb-6">
      <BookOpen className="h-8 w-8 text-primary" />
    </div>
    <h3 className="text-xl font-bold text-foreground mb-2">No wiki pages yet</h3>
    <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
      {isAdmin
        ? "Start building your company's knowledge base by creating the first page."
        : "Your team hasn't added any wiki pages yet. Ask an admin to get started."}
    </p>
    {isAdmin && (
      <button onClick={onCreate} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
        <Plus className="h-4 w-4" /> Create First Page
      </button>
    )}
  </div>
);

export default Wiki;
