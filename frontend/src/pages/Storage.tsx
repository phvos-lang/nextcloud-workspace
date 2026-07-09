import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cloud, Eye, EyeOff, TestTube, Save, Trash2, ExternalLink,
  CheckCircle, XCircle, Folder, File, Download, Upload,
  FolderPlus, ArrowLeft, ChevronRight, RefreshCw, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import client from "@/api/client";
import { cn } from "@/lib/utils";

interface NcUserConfig {
  system_url: string; system_configured: boolean;
  personal_url: string; personal_username: string;
  has_personal_password: boolean;
  effective_url: string; effective_username: string; mount_path: string;
}

interface FileEntry {
  name: string; path: string; type: "file" | "dir";
  size: number; modified: string; mime: string;
}

// ── File browser ──────────────────────────────────────────────────────────────

function formatSize(bytes: number) {
  if (bytes === 0) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0; let v = bytes;
  while (v >= 1024 && i < 3) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}

function FileBrowser() {
  const qc = useQueryClient();
  const [path, setPath] = useState("/");
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: cfg } = useQuery<NcUserConfig>({
    queryKey: ["storage", "nextcloud"],
    queryFn: () => client.get("/api/storage/nextcloud").then((r) => r.data),
  });

  const { data: files = [], isLoading, isError, refetch } = useQuery<FileEntry[]>({
    queryKey: ["storage", "files", path],
    queryFn: () => client.get("/api/storage/files", { params: { path } }).then((r) => r.data),
    enabled: !!(cfg?.system_configured || cfg?.personal_url || cfg?.has_personal_password),
    retry: false,
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return client.post("/api/storage/files/upload", fd, { params: { path } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["storage", "files", path] }); toast.success("Uploaded"); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Upload failed"),
  });

  const mkdir = useMutation({
    mutationFn: (name: string) =>
      client.post("/api/storage/files/mkdir", null, { params: { path: path.replace(/\/$/, "") + "/" + name } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["storage", "files", path] });
      setNewFolder(""); setShowNewFolder(false);
      toast.success("Folder created");
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Failed"),
  });

  const remove = useMutation({
    mutationFn: (filePath: string) => client.delete("/api/storage/files", { params: { path: filePath } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["storage", "files", path] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Delete failed"),
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    Array.from(e.dataTransfer.files).forEach((f) => upload.mutate(f));
  }, [upload]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((f) => upload.mutate(f));
    e.target.value = "";
  };

  const download = (entry: FileEntry) => {
    const a = document.createElement("a");
    a.href = `/api/storage/files/download?path=${encodeURIComponent(entry.path)}`;
    a.download = entry.name;
    a.click();
  };

  // Breadcrumb from path
  const crumbs = path.split("/").filter(Boolean);

  const ncConfigured = cfg?.system_configured || !!(cfg?.personal_url);

  if (!ncConfigured) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-sm text-gray-400">
        <Cloud className="h-10 w-10 opacity-30" />
        <p>No Nextcloud configured.</p>
        <p className="text-xs">Go to the <strong>Settings</strong> tab to connect your Nextcloud.</p>
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col h-full min-h-0", dragging && "ring-2 ring-indigo-400 ring-inset rounded-xl")}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 pb-3 flex-wrap shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm flex-1 min-w-0 overflow-hidden">
          <button
            onClick={() => setPath("/")}
            className="shrink-0 text-indigo-500 hover:text-indigo-400 font-medium"
          >
            Files
          </button>
          {crumbs.map((seg, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <button
                onClick={() => setPath("/" + crumbs.slice(0, i + 1).join("/") + "/")}
                className={cn(
                  "truncate hover:text-indigo-400",
                  i === crumbs.length - 1 ? "text-gray-700 dark:text-gray-200 font-medium" : "text-gray-500",
                )}
              >
                {seg}
              </button>
            </span>
          ))}
        </div>

        {/* Actions */}
        {path !== "/" && (
          <button
            onClick={() => setPath("/" + crumbs.slice(0, -1).join("/") + "/")}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        )}
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setShowNewFolder((v) => !v)}
          className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <FolderPlus className="h-3.5 w-3.5" /> New folder
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          <Upload className="h-3.5 w-3.5" /> Upload
        </button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFiles} />
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="mb-2 flex gap-2 shrink-0">
          <input
            autoFocus
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolder.trim()) mkdir.mutate(newFolder.trim());
              if (e.key === "Escape") { setShowNewFolder(false); setNewFolder(""); }
            }}
            placeholder="Folder name"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
          />
          <button
            onClick={() => newFolder.trim() && mkdir.mutate(newFolder.trim())}
            disabled={!newFolder.trim() || mkdir.isPending}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            Create
          </button>
        </div>
      )}

      {/* Drag hint */}
      {dragging && (
        <div className="mb-2 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/50 py-6 text-sm text-indigo-600 dark:bg-indigo-900/20 shrink-0">
          <Upload className="h-5 w-5" /> Drop files to upload
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : isError ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-red-400">
            <XCircle className="h-5 w-5" /> Failed to load files
            <button onClick={() => refetch()} className="text-xs underline">Retry</button>
          </div>
        ) : files.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">
            {dragging ? "" : "Empty folder — drop files here to upload"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400">
                <th className="pb-1.5 text-left font-medium">Name</th>
                <th className="pb-1.5 text-right font-medium pr-4">Size</th>
                <th className="pb-1.5 text-right font-medium">Modified</th>
                <th className="pb-1.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {files.map((entry) => (
                <tr
                  key={entry.path}
                  className={cn(
                    "group border-b border-gray-50 dark:border-gray-800/50 transition-colors",
                    entry.type === "dir" && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50",
                  )}
                  onClick={() => entry.type === "dir" && setPath(entry.path)}
                >
                  <td className="py-1.5 flex items-center gap-2.5">
                    {entry.type === "dir"
                      ? <Folder className="h-4 w-4 shrink-0 text-indigo-400" />
                      : <File className="h-4 w-4 shrink-0 text-gray-400" />}
                    <span className={cn("truncate", entry.type === "dir" && "font-medium")}>
                      {entry.name}
                    </span>
                  </td>
                  <td className="py-1.5 text-right pr-4 text-gray-400 tabular-nums">
                    {entry.type === "file" ? formatSize(entry.size) : "—"}
                  </td>
                  <td className="py-1.5 text-right text-gray-400 text-xs tabular-nums whitespace-nowrap">
                    {entry.modified ? new Date(entry.modified).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {entry.type === "file" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); download(entry); }}
                          title="Download"
                          className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-indigo-500"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${entry.name}"?`)) remove.mutate(entry.path);
                        }}
                        title="Delete"
                        className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {upload.isPending && (
        <div className="mt-2 flex items-center gap-2 text-xs text-indigo-500 shrink-0">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
        </div>
      )}
    </div>
  );
}

// ── NC settings (user personal override) ─────────────────────────────────────

function NcSettings() {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; version?: string; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: cfg, isLoading } = useQuery<NcUserConfig>({
    queryKey: ["storage", "nextcloud"],
    queryFn: () => client.get("/api/storage/nextcloud").then((r) => r.data),
  });

  useEffect(() => {
    if (!cfg) return;
    setUrl(cfg.personal_url);
    setUsername(cfg.personal_username);
  }, [cfg]);

  const save = useMutation({
    mutationFn: () => client.put("/api/storage/nextcloud", { url, username, password: password || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["storage", "nextcloud"] }); toast.success("Saved"); setPassword(""); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Save failed"),
  });

  const clearOverride = useMutation({
    mutationFn: () => client.delete("/api/storage/nextcloud"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["storage", "nextcloud"] });
      setUrl(""); setUsername(""); setPassword("");
      toast.success("Personal override removed");
    },
  });

  const testConn = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await client.post("/api/storage/nextcloud/test");
      setTestResult(r.data);
    } catch (e: any) {
      setTestResult({ ok: false, error: e.response?.data?.detail ?? "Request failed" });
    } finally { setTesting(false); }
  };

  if (isLoading) return <div className="text-sm text-gray-400">Loading…</div>;

  const hasPersonal = !!(cfg?.personal_url || cfg?.personal_username);

  return (
    <div className="space-y-4 max-w-xl">
      {cfg?.system_configured ? (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm dark:border-green-800 dark:bg-green-900/20">
          <CheckCircle className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-green-700 dark:text-green-400">Organisation Nextcloud configured</p>
            <p className="text-green-600 dark:text-green-500 text-xs mt-0.5">
              Mounted at <code className="rounded bg-green-100 px-1 dark:bg-green-900">{cfg.mount_path}</code> in every session.
            </p>
          </div>
          {cfg.effective_url && (
            <a href={cfg.effective_url.replace(/\/remote\.php.*/, "")} target="_blank" rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500">
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-900/20">
          <XCircle className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-amber-700 dark:text-amber-400">No organisation Nextcloud. Connect your personal instance below.</p>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 space-y-4">
        <div>
          <h2 className="font-semibold">Personal Nextcloud</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {cfg?.system_configured ? "Override the organisation server." : "Connect your Nextcloud for file access."}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Nextcloud URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://cloud.example.com"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder={cfg?.effective_username}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Password {cfg?.has_personal_password && <span className="text-green-500">(set)</span>}
            </label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={cfg?.has_personal_password ? "Leave blank to keep" : "Password or app token"}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm dark:border-gray-600 dark:bg-gray-800" />
              <button type="button" onClick={() => setShowPass((v) => !v)}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {testResult && (
          <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
            testResult.ok ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400")}>
            {testResult.ok
              ? <><CheckCircle className="h-4 w-4" /> Connected — Nextcloud {testResult.version}</>
              : <><XCircle className="h-4 w-4" /> {testResult.error}</>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={testConn} disabled={testing}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800">
            <TestTube className="h-4 w-4" /> {testing ? "Testing…" : "Test"}
          </button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
            <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save"}
          </button>
          {hasPersonal && (
            <button onClick={() => clearOverride.mutate()}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Tab = "files" | "settings";

export default function Storage() {
  const [tab, setTab] = useState<Tab>("files");
  const tabs: { id: Tab; label: string }[] = [
    { id: "files",    label: "📁 Files" },
    { id: "settings", label: "⚙️ Settings" },
  ];
  return (
    <div className="flex flex-col h-full p-5 min-h-0">
      <div className="mb-4 flex items-center gap-3 shrink-0">
        <Cloud className="h-5 w-5 text-indigo-500" />
        <h1 className="text-lg font-bold">Files &amp; Storage</h1>
      </div>
      <div className="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-700 shrink-0">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
            )}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "files"    && <FileBrowser />}
        {tab === "settings" && <NcSettings />}
      </div>
    </div>
  );
}
