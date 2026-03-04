import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen, Search, Upload, FileText, File, Loader2,
  Download, Eye, HardDrive, RefreshCw
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAzureBlobStorage, type BlobFile, type BlobContent } from "@/hooks/useAzureBlobStorage";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const Documents = () => {
  const { isLoading, listFiles, searchFiles, uploadFile, getFileContent } = useAzureBlobStorage();

  const [container, setContainer] = useState("documents");
  const [path, setPath] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [files, setFiles] = useState<BlobFile[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [preview, setPreview] = useState<BlobContent | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleList = async () => {
    try {
      const result = await listFiles(container, path || undefined);
      setFiles(result);
      setHasLoaded(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to list files");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const result = await searchFiles(container, searchQuery);
      setFiles(result);
      setHasLoaded(true);
    } catch (e: any) {
      toast.error(e.message || "Search failed");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploadPath = path ? `${path}/${file.name}` : file.name;
      const result = await uploadFile(file, container, uploadPath);
      toast.success(`Uploaded to ${result.blob_path}`);
      handleList();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePreview = async (blob: BlobFile) => {
    try {
      // Extract blob path relative to container
      const blobPath = blob.name;
      const content = await getFileContent(container, blobPath);
      setPreview(content);
      setPreviewOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to load content");
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 flex-1">
        <div className="pointer-events-none fixed top-0 left-64 right-0 h-72 gradient-radial z-0" />
        <div className="relative z-10 px-8 py-8 max-w-5xl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center gap-3 mb-1">
              <HardDrive className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Documents</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Browse, upload, and search files in Azure Blob Storage.
            </p>
          </motion.div>

          <Tabs defaultValue="browse" className="space-y-4">
            <TabsList>
              <TabsTrigger value="browse" className="gap-2"><FolderOpen className="h-3.5 w-3.5" />Browse</TabsTrigger>
              <TabsTrigger value="search" className="gap-2"><Search className="h-3.5 w-3.5" />Search</TabsTrigger>
              <TabsTrigger value="upload" className="gap-2"><Upload className="h-3.5 w-3.5" />Upload</TabsTrigger>
            </TabsList>

            {/* Container selector */}
            <div className="flex items-center gap-3">
              <Select value={container} onValueChange={setContainer}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="documents">documents</SelectItem>
                  <SelectItem value="ndas">ndas</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="Folder path (optional)"
                className="flex-1 max-w-xs"
              />
            </div>

            {/* Browse tab */}
            <TabsContent value="browse" className="space-y-4">
              <Button onClick={handleList} disabled={isLoading} variant="outline" className="gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Load Files
              </Button>
              <FileTable files={files} hasLoaded={hasLoaded} isLoading={isLoading} onPreview={handlePreview} />
            </TabsContent>

            {/* Search tab */}
            <TabsContent value="search" className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by filename…"
                  className="max-w-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isLoading || !searchQuery.trim()} className="gap-2">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
              </div>
              <FileTable files={files} hasLoaded={hasLoaded} isLoading={isLoading} onPreview={handlePreview} />
            </TabsContent>

            {/* Upload tab */}
            <TabsContent value="upload" className="space-y-4">
              <div className="rounded-xl border-2 border-dashed border-border p-10 text-center">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Upload to <span className="font-mono text-foreground">{container}/{path || ""}</span>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleUpload}
                  className="hidden"
                  id="file-upload"
                />
                <Button asChild variant="outline" disabled={isLoading}>
                  <label htmlFor="file-upload" className="cursor-pointer gap-2">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Choose File
                  </label>
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Content Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-mono">
              <FileText className="h-4 w-4" />
              {preview?.name}
            </DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground bg-muted p-4 rounded-lg max-h-[60vh] overflow-y-auto">
            {preview?.content}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function FileTable({ files, hasLoaded, isLoading, onPreview }: {
  files: BlobFile[];
  hasLoaded: boolean;
  isLoading: boolean;
  onPreview: (f: BlobFile) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasLoaded) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground">
        Click <span className="font-medium text-foreground">Load Files</span> to browse the container.
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground">
        No files found.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Size</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Modified</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-2.5 font-mono text-xs flex items-center gap-2">
                <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{f.name}</span>
              </td>
              <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{formatBytes(f.size)}</td>
              <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                {f.lastModified ? new Date(f.lastModified).toLocaleDateString() : "—"}
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => onPreview(f)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Preview content"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Documents;
