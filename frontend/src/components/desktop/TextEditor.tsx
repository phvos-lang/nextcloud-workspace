import { useEffect, useMemo, useState } from "react";
import { FileText, X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import CodeMirror from "@uiw/react-codemirror";
import { loadLanguage } from "@uiw/codemirror-extensions-langs";
import { oneDark } from "@codemirror/theme-one-dark";
import client from "@/api/client";

// Lazy-loaded so CodeMirror + language modes ship in a separate chunk that's
// only fetched when a file is actually opened (keeps the main bundle small).

// Extension → CodeMirror language name (loadLanguage). Missing = plain text.
const LANG_BY_EXT: Record<string, string> = {
  js: "javascript", cjs: "javascript", mjs: "javascript", jsx: "jsx",
  ts: "typescript", tsx: "tsx", json: "json", jsonc: "json",
  py: "python", rb: "ruby", php: "php", go: "go", rs: "rust",
  java: "java", kt: "kotlin", swift: "swift", c: "c", h: "c",
  cpp: "cpp", hpp: "cpp", cc: "cpp", cs: "csharp",
  css: "css", scss: "sass", less: "less", html: "html", htm: "html",
  xml: "xml", svg: "xml", vue: "vue", svelte: "svelte",
  yaml: "yaml", yml: "yaml", toml: "toml",
  ini: "properties", conf: "properties", cfg: "properties", env: "properties", properties: "properties",
  md: "markdown", markdown: "markdown", sql: "sql",
  sh: "shell", bash: "shell", zsh: "shell", fish: "shell",
  tf: "hcl", hcl: "hcl", lua: "lua", r: "r", pl: "perl",
  graphql: "graphql", gql: "graphql", dockerfile: "dockerfile",
};

function langFor(name: string): string | undefined {
  if (name === "Dockerfile") return "dockerfile";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return LANG_BY_EXT[ext];
}

export default function TextEditor({ path, onClose, onSaved }: { path: string; onClose(): void; onSaved(): void }) {
  const name = path.split("/").filter(Boolean).pop() ?? "file";
  const [text, setText] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = text !== original;
  const dark = document.documentElement.classList.contains("dark");

  const extensions = useMemo(() => {
    const langName = langFor(name);
    const lang = langName ? loadLanguage(langName as any) : null;
    return lang ? [lang] : [];
  }, [name]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(`/api/storage/files/preview?path=${encodeURIComponent(path)}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((t) => { if (!cancelled) { setText(t); setOriginal(t); } })
      .catch((e) => { if (!cancelled) setError(String(e.message || e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path]);

  const save = async () => {
    setSaving(true);
    try {
      const dir = path.replace(/\/[^/]*$/, "") || "/";
      const form = new FormData();
      form.append("file", new Blob([text], { type: "text/plain" }), name);
      await client.post("/api/storage/files/upload", form, { params: { path: dir } });
      setOriginal(text);
      toast.success(`Saved ${name}`);
      onSaved();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S saves
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (dirty && !saving) save();
    }
  };

  const close = () => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-gray-50 dark:bg-[#131320]" onKeyDown={onKeyDown}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-gray-200 px-3 dark:border-white/10">
        <FileText className="h-4 w-4 text-indigo-400" />
        <span className="flex-1 truncate text-xs font-semibold text-gray-700 dark:text-white/80">
          {name}{dirty && <span className="ml-1 text-amber-500" title="Unsaved changes">●</span>}
        </span>
        <button
          onClick={save}
          disabled={!dirty || saving || loading}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40"
          title="Save (Ctrl+S)"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
        </button>
        <button
          onClick={close}
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-xs text-gray-400">Loading…</div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center text-xs text-red-400">Could not open file: {error}</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <CodeMirror
            value={text}
            onChange={setText}
            extensions={extensions}
            theme={dark ? oneDark : "light"}
            height="100%"
            basicSetup={{ lineNumbers: true, highlightActiveLine: true, tabSize: 2 } as any}
            style={{ fontSize: 12, height: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
