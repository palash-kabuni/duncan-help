import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Upload, FolderOpen, File, Loader2, Cloud, HardDrive, ChevronRight, FileText, Download } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAzureBlobStorage, type AzureBlob } from "@/hooks/useAzureBlobStorage";
import { supabase } from "@/integrations/supabase/client";

const CONTAINERS = ["documents", "ndas"] as const;

function formatBytes(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const Documents = () => {
  const [activeTab, setActiveTab] = useState<"azure" | "drive">("azure");
  const [container, setContainer] = useState<typeof CONTAINERS[number]>("documents");
  const [path, setPath] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [files, setFiles] = useState<AzureBlob[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { isLoading, listFiles, searchFiles, uploadFile } = useAzureBlobStorage();

  const loadFiles = useCallback(async () => {
    try {
      const result = await listFiles(container, path || undefined);
      setFiles(result);
    } catch (err: any) {
      toast.error(err.message || "Failed to load files");
    }
  }, [container, path, listFiles]);

  useEffect(() => {
    if (activeTab === "azure") {
      loadFiles();
    }
  }, [activeTab, container, path]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadFiles();
      return;
    }
    setIsSearching(true);
    try {
      const result = await searchFiles(container, searchQuery);
      setFiles(result);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const blobPath = path ? `${path}/${file.name}` : file.name;
      await uploadFile(file, container, blobPath);
      toast.success(`Uploaded ${file.name}`);
      loadFiles();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // Google Drive state
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveSearch, setDriveSearch] = useState("");
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);

  const loadDriveFiles = useCallback(async (query?: string) => {
    setDriveLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.functions.invoke("google-drive-api", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: query ? { action: "search", query } : { action: "list" },
      });
      if (error) throw error;
      setDriveFiles(data?.files || data || []);
      setDriveConnected(true);
    } catch {
      setDriveConnected(false);
    } finally {
      setDriveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "drive") {
      loadDriveFiles();
    }
  }, [activeTab]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 flex-1">
        <div className="pointer-events-none fixed top-0 left-64 right-0 h-72 gradient-radial z-0" />

        <div className="relative z-10 px-8 py-8 max-w-6xl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Documents</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Browse, search, and upload files across Azure Storage and Google Drive.
            </p>
          </motion.div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "azure" | "drive")} className="mt-6">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="azure" className="gap-2">
                <Cloud className="h-3.5 w-3.5" />
                Azure Storage
              </TabsTrigger>
              <TabsTrigger value="drive" className="gap-2">
                <HardDrive className="h-3.5 w-3.5" />
                Google Drive
              </TabsTrigger>
            </TabsList>

            {/* Azure Tab */}
            <TabsContent value="azure" className="mt-6 space-y-4">
              {/* Controls */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
                  {CONTAINERS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setContainer(c); setPath(""); setSearchQuery(""); }}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                        container === c ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {path && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <button onClick={() => setPath("")} className="hover:text-foreground">root</button>
                    {path.split("/").map((segment, i, arr) => (
                      <span key={i} className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        <button
                          onClick={() => setPath(arr.slice(0, i + 1).join("/"))}
                          className="hover:text-foreground"
                        >
                          {segment}
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex-1" />

                <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 w-52 text-xs bg-card"
                    />
                  </div>
                </form>

                <label className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload
                  <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              </div>

              {/* File List */}
              {(isLoading || isSearching) ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <FolderOpen className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">No files found</p>
                  <p className="text-xs mt-1">Upload a file or try a different container/path.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Size</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Modified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((file) => (
                        <tr key={file.name} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <a href={file.url} target="_blank" rel="noreferrer" className="text-foreground hover:text-primary transition-colors">
                                {file.name}
                              </a>
                            </div>
                          </td>
                          <td className="text-right px-4 py-2.5 text-muted-foreground">{formatBytes(file.size)}</td>
                          <td className="text-right px-4 py-2.5 text-muted-foreground">
                            {file.lastModified ? new Date(file.lastModified).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Google Drive Tab */}
            <TabsContent value="drive" className="mt-6 space-y-4">
              {driveConnected === false ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <HardDrive className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Google Drive is not connected</p>
                  <p className="text-xs mt-1">An admin needs to connect Google Drive via the Integrations page.</p>
                </div>
              ) : (
                <>
                  <form onSubmit={(e) => { e.preventDefault(); loadDriveFiles(driveSearch || undefined); }} className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search Google Drive..."
                        value={driveSearch}
                        onChange={(e) => setDriveSearch(e.target.value)}
                        className="pl-8 h-8 text-xs bg-card"
                      />
                    </div>
                  </form>

                  {driveLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                      <FolderOpen className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm">No files found</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-secondary/30">
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Modified</th>
                          </tr>
                        </thead>
                        <tbody>
                          {driveFiles.map((file: any) => (
                            <tr key={file.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                  <a href={file.webViewLink || file.link} target="_blank" rel="noreferrer" className="text-foreground hover:text-primary transition-colors">
                                    {file.name}
                                  </a>
                                </div>
                              </td>
                              <td className="text-right px-4 py-2.5 text-muted-foreground">{(file.mimeType || file.type || "").split(".").pop()}</td>
                              <td className="text-right px-4 py-2.5 text-muted-foreground">
                                {file.modifiedTime || file.modified ? new Date(file.modifiedTime || file.modified).toLocaleDateString() : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Documents;
