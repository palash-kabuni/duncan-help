import { useState } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useCreateWikiPage, useUpdateWikiPage, type WikiPage, type WikiCategory } from "@/hooks/useWiki";
import { toast } from "sonner";

interface WikiEditorProps {
  page?: WikiPage;
  categories: WikiCategory[];
  onClose: () => void;
  onSaved: (id: string) => void;
}

const WikiEditor = ({ page, categories, onClose, onSaved }: WikiEditorProps) => {
  const [title, setTitle] = useState(page?.title ?? "");
  const [content, setContent] = useState(page?.content ?? "");
  const [summary, setSummary] = useState(page?.summary ?? "");
  const [categoryId, setCategoryId] = useState(page?.category_id ?? "");
  const [tagsInput, setTagsInput] = useState(page?.tags?.join(", ") ?? "");

  const createPage = useCreateWikiPage();
  const updatePage = useUpdateWikiPage();
  const saving = createPage.isPending || updatePage.isPending;

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      if (page) {
        const result = await updatePage.mutateAsync({
          id: page.id,
          title: title.trim(),
          content,
          summary: summary || undefined,
          category_id: categoryId || null,
          tags,
        });
        onSaved(result.id);
        toast.success("Page updated");
      } else {
        const result = await createPage.mutateAsync({
          title: title.trim(),
          content,
          summary: summary || undefined,
          category_id: categoryId || undefined,
          tags,
        });
        onSaved(result.id);
        toast.success("Page created");
      }
    } catch {
      toast.error("Failed to save page");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-8 py-4">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {page ? "Update" : "Publish"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <input
            type="text"
            placeholder="Page title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-2xl font-bold text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Brief summary (optional)"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground/30 focus:outline-none"
          />
          <div className="flex items-center gap-4">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/40"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40"
            />
          </div>
          <textarea
            placeholder="Write your content in Markdown…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={24}
            className="w-full rounded-xl border border-border bg-card px-5 py-4 text-sm text-foreground font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 resize-y"
          />
        </div>
      </div>
    </>
  );
};

export default WikiEditor;
