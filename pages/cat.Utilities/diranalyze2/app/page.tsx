"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  FolderIcon,
  FileIcon,
  UploadIcon,
  DownloadIcon,
  CheckIcon,
  XIcon,
  ExpandIcon,
  ListCollapseIcon as CollapseIcon,
  CopyIcon,
  SaveIcon,
  SettingsIcon,
  SunIcon,
  MoonIcon,
  FolderOpenIcon,
  CodeIcon,
  TrashIcon,
} from "lucide-react"
import type { JSX } from "react/jsx-runtime"

interface AppState {
  files: Map<string, string>
  fileTree: any
  selectedFiles: Set<string>
  committedFiles: Set<string>
  expandedFolders: Set<string>
  currentFile: string | null
  hasUnsavedChanges: boolean
  viewMode: "tree" | "editor"
  filters: {
    include: string
    exclude: string
    showHidden: boolean
  }
  gitignorePatterns: string[]
  placeholders: Map<string, { count: number; size: number; name: string }>
  lastLoadedFiles: File[]
  isDarkMode: boolean
}

const DEFAULT_GITIGNORE = `
node_modules/
.git/
.gitignore
dist/
build/
*.log
.DS_Store
.env
.env.local
.cache
.parcel-cache
.next
.nuxt
.vscode/
.idea/
*.swp
*.swo
*~
.npm
.yarn/
coverage/
.nyc_output
`

export default function DirAnalyze() {
  const [state, setState] = useState<AppState>({
    files: new Map(),
    fileTree: null,
    selectedFiles: new Set(),
    committedFiles: new Set(),
    expandedFolders: new Set(),
    currentFile: null,
    hasUnsavedChanges: false,
    viewMode: "tree",
    filters: {
      include: "",
      exclude: "node_modules,.git,dist,build,.DS_Store",
      showHidden: false,
    },
    gitignorePatterns: [],
    placeholders: new Map(),
    lastLoadedFiles: [],
    isDarkMode: false,
  })

  const [notification, setNotification] = useState<{
    message: string
    type: "success" | "error" | "warning" | "info"
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [patchModalOpen, setPatchModalOpen] = useState(false)
  const [patchInput, setPatchInput] = useState("")
  const [sidebarWidth, setSidebarWidth] = useState(400)
  const [isResizing, setIsResizing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const patterns = parseGitignore(DEFAULT_GITIGNORE)
    setState((prev) => ({ ...prev, gitignorePatterns: patterns }))

    const savedTheme = localStorage.getItem("diranalyze-theme")
    if (savedTheme === "dark") {
      setState((prev) => ({ ...prev, isDarkMode: true }))
      document.documentElement.classList.add("dark")
    }
  }, [])

  const parseGitignore = (content: string): string[] => {
    const lines = content.split("\n")
    const patterns: string[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith("#")) {
        patterns.push(trimmed)
      }
    }
    return patterns
  }

  const matchesGitignore = (path: string, patterns: string[]): boolean => {
    const p = path.replace(/\\/g, "/")
    for (const raw of patterns) {
      if (!raw) continue
      const pattern = raw.trim()
      if (!pattern || pattern.startsWith("#")) continue
      if (pattern.startsWith("!")) continue

      if (pattern.endsWith("/")) {
        const dir = pattern.slice(0, -1)
        if (p.split("/").includes(dir)) return true
        continue
      }

      const rx = globToRegExp(pattern)
      if (rx.test(p)) return true
    }
    return false
  }

  const globToRegExp = (glob: string): RegExp => {
    let g = glob.replace(/\\/g, "/")
    g = g.replace(/([.+^$(){}|\\])/g, "\\$1")
    g = g.replace(/\*\*/g, "§§DS§§")
    g = g.replace(/\*/g, "[^/]*")
    g = g.replace(/§§DS§§/g, ".*")
    g = g.replace(/\?/g, "[^/]")
    return new RegExp("(^|/)" + g + "($|/)?")
  }

  const showNotification = (message: string, type: "success" | "error" | "warning" | "info" = "info") => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleFilesLoaded = async (fileList: File[]) => {
    setIsLoading(true)
    try {
      const newFiles = new Map<string, string>()
      const newSelectedFiles = new Set<string>()
      const newCommittedFiles = new Set<string>()
      const newPlaceholders = new Map<string, { count: number; size: number; name: string }>()

      showNotification(`Loading ${fileList.length} files...`)

      // Discover .gitignore
      let gitignoreContent = ""
      for (const file of fileList) {
        const p = file.webkitRelativePath || file.name
        if (p.endsWith(".gitignore") || p === ".gitignore") {
          gitignoreContent = await readFileContent(file)
          break
        }
      }

      const gitignorePatterns = parseGitignore(
        gitignoreContent ? DEFAULT_GITIGNORE + "\n" + gitignoreContent : DEFAULT_GITIGNORE,
      )

      // Known build/cache dirs for placeholders
      const KNOWN_BUILD_DIRS = new Set([
        "node_modules",
        ".next",
        ".nuxt",
        "dist",
        "build",
        ".parcel-cache",
        ".cache",
        "coverage",
        ".git",
        ".vscode",
        ".idea",
        "out",
        ".svelte-kit",
        ".angular",
        ".vercel",
        ".turbo",
        "target",
        "bin",
        "obj",
      ])

      // Process files
      for (const file of fileList) {
        const path = file.webkitRelativePath || file.name
        const isIgnored = matchesGitignore(path, gitignorePatterns)

        if (isIgnored) {
          // Record placeholder stats
          const parts = path.split("/")
          const stack: string[] = []
          for (let i = 0; i < parts.length - 1; i++) {
            const seg = parts[i]
            stack.push(seg)
            if (KNOWN_BUILD_DIRS.has(seg)) {
              const dirPath = stack.join("/")
              const rec = newPlaceholders.get(dirPath) || { count: 0, size: 0, name: seg }
              rec.count += 1
              rec.size += typeof file.size === "number" ? file.size : 0
              newPlaceholders.set(dirPath, rec)
              break
            }
          }
          continue
        }

        if (!shouldIncludeFile(path, state.filters)) continue

        const content = await readFileContent(file)
        newFiles.set(path, content)
        newSelectedFiles.add(path)
        newCommittedFiles.add(path)
      }

      setState((prev) => ({
        ...prev,
        files: newFiles,
        selectedFiles: newSelectedFiles,
        committedFiles: newCommittedFiles,
        placeholders: newPlaceholders,
        lastLoadedFiles: Array.from(fileList),
        gitignorePatterns,
        currentFile: null,
        hasUnsavedChanges: false,
      }))

      buildFileTree(newFiles)
      showNotification(`Loaded ${newFiles.size} files`, "success")
    } catch (error) {
      console.error("Error loading files:", error)
      showNotification("Error loading files", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve((e.target?.result as string) || "")
      reader.onerror = () => resolve("")
      reader.readAsText(file)
    })
  }

  const shouldIncludeFile = (path: string, filters: AppState["filters"]): boolean => {
    // Exclude filter
    const excludePatterns = filters.exclude
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
    for (const pattern of excludePatterns) {
      if (pattern && path.includes(pattern)) return false
    }

    // Hidden files
    if (!filters.showHidden && path.split("/").some((part) => part.startsWith("."))) {
      return false
    }

    // Include filter
    const includePatterns = filters.include
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
    if (includePatterns.length > 0) {
      const matches = includePatterns.some((pattern) => {
        const safe = pattern
          .split("*")
          .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join(".*")
        const regex = new RegExp("^" + safe + "$")
        return regex.test(path)
      })
      if (!matches) return false
    }

    return true
  }

  const buildFileTree = (files: Map<string, string>) => {
    const tree: any = {}
    for (const [path] of files) {
      const parts = path.split("/")
      let current = tree
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (i === parts.length - 1) {
          current[part] = { type: "file", path }
        } else {
          if (!current[part]) {
            current[part] = { type: "folder", children: {} }
          }
          current = current[part].children
        }
      }
    }
    setState((prev) => ({ ...prev, fileTree: tree }))
  }

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase()
    const icons: Record<string, string> = {
      js: "📜",
      jsx: "⚛️",
      ts: "📘",
      tsx: "⚛️",
      json: "📋",
      html: "🌐",
      css: "🎨",
      md: "📝",
      txt: "📄",
      py: "🐍",
      rb: "💎",
      go: "🐹",
      rs: "🦀",
      java: "☕",
      png: "🖼️",
      jpg: "🖼️",
      jpeg: "🖼️",
      gif: "🖼️",
      svg: "🎨",
      default: "📄",
    }
    if (filename === ".gitignore") return "🚫"
    if (filename === "package.json") return "📦"
    if (filename === "README.md") return "📖"
    return icons[ext || "default"] || icons.default
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(2) + " MB"
  }

  const toggleSelection = (path: string) => {
    setState((prev) => {
      const newSelected = new Set(prev.selectedFiles)
      const newCommitted = new Set(prev.committedFiles)

      // Check if this is a folder
      const isFolder = checkIfFolder(prev.fileTree, path)

      if (isFolder) {
        // For folders, toggle all contents recursively
        const shouldSelect = !newSelected.has(path)

        // Get all files and folders under this path
        const allPaths = getAllPathsUnder(path)

        if (shouldSelect) {
          // Select folder and all contents
          allPaths.forEach((p) => {
            if (!matchesGitignore(p, prev.gitignorePatterns)) {
              newSelected.add(p)
              newCommitted.add(p)
            }
          })
        } else {
          // Deselect folder and all contents
          allPaths.forEach((p) => {
            newSelected.delete(p)
            newCommitted.delete(p)
          })
        }
      } else {
        // For files, just toggle the file
        if (newSelected.has(path)) {
          newSelected.delete(path)
          newCommitted.delete(path)
        } else {
          newSelected.add(path)
          newCommitted.add(path)
        }
      }

      return {
        ...prev,
        selectedFiles: newSelected,
        committedFiles: newCommitted,
      }
    })
  }

  const toggleFolder = (path: string) => {
    setState((prev) => {
      const newExpanded = new Set(prev.expandedFolders)
      if (newExpanded.has(path)) {
        newExpanded.delete(path)
      } else {
        newExpanded.add(path)
      }
      return { ...prev, expandedFolders: newExpanded }
    })
  }

  const selectAll = (select: boolean) => {
    setState((prev) => {
      const newSelected = new Set<string>()
      const newCommitted = new Set<string>()

      if (select) {
        // Select all files
        for (const [path] of prev.files) {
          if (!matchesGitignore(path, prev.gitignorePatterns)) {
            newSelected.add(path)
            newCommitted.add(path)
          }
        }

        const addAllFolders = (node: any, currentPath = "") => {
          if (!node) return

          for (const [name, item] of Object.entries(node)) {
            const itemPath = currentPath ? `${currentPath}/${name}` : name
            if (item && typeof item === "object" && item.type === "folder") {
              if (!matchesGitignore(itemPath, prev.gitignorePatterns)) {
                newSelected.add(itemPath)
                newCommitted.add(itemPath)
              }
              if (item.children) {
                addAllFolders(item.children, itemPath)
              }
            }
          }
        }

        if (prev.fileTree) {
          addAllFolders(prev.fileTree)
        }
      }

      return {
        ...prev,
        selectedFiles: newSelected,
        committedFiles: newCommitted,
      }
    })
  }

  const expandAll = (expand: boolean) => {
    setState((prev) => {
      const newExpanded = new Set<string>()

      if (expand) {
        const findFolders = (node: any, path: string) => {
          for (const [name, value] of Object.entries(node)) {
            const fullPath = path ? `${path}/${name}` : name
            if (value && typeof value === "object" && value.type === "folder") {
              newExpanded.add(fullPath)
              findFolders(value.children, fullPath)
            }
          }
        }
        findFolders(prev.fileTree || {}, "")
      }

      return { ...prev, expandedFolders: newExpanded }
    })
  }

  const openFile = (path: string) => {
    if (state.hasUnsavedChanges && state.currentFile) {
      if (!confirm("You have unsaved changes. Continue?")) {
        return
      }
    }

    setState((prev) => ({
      ...prev,
      currentFile: path,
      viewMode: "editor",
      hasUnsavedChanges: false,
    }))
  }

  const handleEditorChange = (content: string) => {
    if (state.currentFile) {
      setState((prev) => {
        const newFiles = new Map(prev.files)
        newFiles.set(state.currentFile!, content)
        return {
          ...prev,
          files: newFiles,
          hasUnsavedChanges: true,
        }
      })
    }
  }

  const saveCurrentFile = () => {
    if (state.currentFile) {
      setState((prev) => ({ ...prev, hasUnsavedChanges: false }))
      showNotification("File saved", "success")
    }
  }

  const exitEditor = () => {
    if (state.hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Continue?")) {
        return
      }
    }
    setState((prev) => ({
      ...prev,
      currentFile: null,
      viewMode: "tree",
      hasUnsavedChanges: false,
    }))
  }

  const clearProject = () => {
    if (confirm("Are you sure you want to clear the entire project? This cannot be undone.")) {
      setState({
        files: new Map(),
        fileTree: null,
        selectedFiles: new Set(),
        committedFiles: new Set(),
        expandedFolders: new Set(),
        currentFile: null,
        hasUnsavedChanges: false,
        viewMode: "tree",
        filters: {
          include: "",
          exclude: "node_modules,.git,dist,build,.DS_Store",
          showHidden: false,
        },
        gitignorePatterns: [],
        placeholders: new Map(),
        lastLoadedFiles: [],
        isDarkMode: false,
      })
      showNotification("Project cleared", "success")
    }
  }

  const copyWithLineNumbers = () => {
    if (!state.currentFile || !editorRef.current) {
      showNotification("No file open", "error")
      return
    }

    const content = state.files.get(state.currentFile) || ""
    const textarea = editorRef.current
    let selection: string, startLine: number

    if (textarea.selectionStart !== textarea.selectionEnd) {
      selection = content.substring(textarea.selectionStart, textarea.selectionEnd)
      const beforeSelection = content.substring(0, textarea.selectionStart)
      startLine = beforeSelection.split("\n").length
    } else {
      selection = content
      startLine = 1
    }

    const lines = selection.split("\n")
    const numbered: string[] = []
    numbered.push(`FILE: ${state.currentFile}`)
    numbered.push(`LINES: ${startLine}-${startLine + lines.length - 1}`)
    numbered.push("=".repeat(40))
    lines.forEach((line, i) => numbered.push(`${startLine + i}: ${line}`))

    const output = numbered.join("\n")
    navigator.clipboard.writeText(output)
    showNotification("Copied with line numbers!", "success")
  }

  const applyFilters = () => {
    if (state.lastLoadedFiles.length > 0) {
      handleFilesLoaded(state.lastLoadedFiles)
    }
  }

  const exportTextReport = () => {
    const reportText = generateReport(true)
    navigator.clipboard.writeText(reportText)
    showNotification("Text report copied to clipboard!", "success")
  }

  const exportCombinedText = () => {
    const selected = state.committedFiles.size > 0 ? Array.from(state.committedFiles) : Array.from(state.files.keys())

    if (selected.length === 0) {
      showNotification("No files committed for export", "error")
      return
    }

    const output: string[] = []
    output.push("//--- COMPREHENSIVE TEXT REPORT ---//")
    output.push(`// Timestamp: ${new Date().toISOString()}`)
    output.push(`// Files: ${selected.length}`)
    output.push("//")
    output.push("//--- DIRECTORY STRUCTURE ---")
    output.push(generateDetailedTreeStructure(true))
    output.push("")
    output.push("//--- FILE CONTENTS WITH LINE NUMBERS ---")
    output.push("")

    for (const path of selected.sort()) {
      const content = state.files.get(path) || ""
      output.push(`=== FILE: ${path} ===`)
      const lines = content.split("\n")
      lines.forEach((line, i) => output.push(`${i + 1}: ${line}`))
      output.push("")
    }

    const combinedText = output.join("\n")
    const blob = new Blob([combinedText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `diranalyze-combined-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showNotification(`Combined export downloaded (${selected.length} files)`, "success")
  }

  const generateDetailedTreeStructure = (committedOnly: boolean): string => {
    const files = committedOnly ? Array.from(state.committedFiles) : Array.from(state.files.keys())
    if (files.length === 0) return ""

    // Build tree structure
    const tree: any = {}
    files.forEach((path) => {
      const parts = path.split("/")
      let current = tree
      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 ? null : {}
        }
        if (index < parts.length - 1) {
          current = current[part]
        }
      })
    })

    // Generate tree string with proper indentation
    const generateTreeString = (obj: any, prefix = "", isLast = true): string[] => {
      const lines: string[] = []
      const entries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))

      entries.forEach(([key, value], index) => {
        const isLastEntry = index === entries.length - 1
        const connector = isLastEntry ? "└── " : "├── "
        const fullPath = prefix ? `${prefix}/${key}` : key

        if (value === null) {
          // It's a file
          const content = state.files.get(fullPath)
          const size = content ? formatSize(content.length) : "0 B"
          lines.push(`${prefix}${connector}${key} (${size})`)
        } else {
          // It's a folder
          lines.push(`${prefix}${connector}${key}/`)
          const newPrefix = prefix + (isLastEntry ? "    " : "│   ")
          lines.push(...generateTreeString(value, newPrefix, isLastEntry))
        }
      })

      return lines
    }

    return generateTreeString(tree).join("\n")
  }

  const generateReport = (committedOnly: boolean): string => {
    const lines: string[] = []
    lines.push("//--- DIRANALYSE MATRIX REPORT (v2.1) ---//")
    lines.push(`// Timestamp: ${new Date().toISOString()}`)
    lines.push(`// Scope: ${committedOnly ? "Committed (staged) files + placeholders" : "Full scanned directory"}`)
    lines.push("//")
    lines.push("//--- DIRECTORY STRUCTURE ---")
    lines.push(generateDetailedTreeStructure(committedOnly))
    lines.push("//")
    lines.push("//--- SUMMARY ---")

    const fileCount = committedOnly ? state.committedFiles.size : state.files.size
    let totalSize = 0
    const fileSet = committedOnly ? state.committedFiles : new Set(state.files.keys())

    for (const path of fileSet) {
      const content = state.files.get(path)
      if (content) totalSize += content.length
    }

    lines.push(`Total Files: ${fileCount}`)
    lines.push(`Total Size: ${formatSize(totalSize)}`)
    lines.push("//")
    lines.push("//--- END OF REPORT ---//")

    return lines.join("\n")
  }

  const applyPatches = () => {
    const patchText = patchInput.trim()
    if (!patchText) {
      showNotification("No patches to apply", "error")
      return
    }

    try {
      const patches = parsePatchText(patchText)
      let appliedCount = 0
      let failedCount = 0

      for (const patch of patches) {
        if (applyPatch(patch)) appliedCount++
        else failedCount++
      }

      if (appliedCount > 0) {
        const message =
          failedCount > 0
            ? `Applied ${appliedCount} patches (${failedCount} failed)`
            : `Applied ${appliedCount} patches successfully!`
        showNotification(message, failedCount > 0 ? "warning" : "success")
      } else {
        showNotification("No patches could be applied", "error")
      }

      setPatchModalOpen(false)
      setPatchInput("")
    } catch (error) {
      showNotification(`Error: ${(error as Error).message}`, "error")
    }
  }

  const parsePatchText = (text: string) => {
    const patches: any[] = []
    const lines = text.split("\n")
    let i = 0

    while (i < lines.length) {
      if (lines[i].startsWith("FILE:")) {
        const filename = lines[i].substring(5).trim()
        i++
        while (i < lines.length && !lines[i].match(/^\d+-\d+:/)) i++
        if (i < lines.length) {
          const rangeMatch = lines[i].match(/^(\d+)-(\d+):/)
          if (rangeMatch) {
            const startLine = Number.parseInt(rangeMatch[1])
            const endLine = Number.parseInt(rangeMatch[2])
            i++
            const replacementLines: string[] = []
            while (i < lines.length && !lines[i].startsWith("FILE:") && !lines[i].match(/^\d+-\d+:/)) {
              let line = lines[i]
              line = line.replace(/^\s*\d+:\s?/, "")
              replacementLines.push(line)
              i++
            }
            patches.push({ file: filename, startLine, endLine, replacement: replacementLines.join("\n") })
          }
        }
      } else {
        i++
      }
    }
    return patches
  }

  const applyPatch = (patch: any): boolean => {
    if (!state.files.has(patch.file)) {
      console.warn(`File not found: ${patch.file}`)
      return false
    }

    const content = state.files.get(patch.file)!
    const lines = content.split("\n")

    if (patch.startLine < 1 || patch.endLine > lines.length) {
      console.warn(`Invalid line range for ${patch.file}: ${patch.startLine}-${patch.endLine}`)
      return false
    }

    const newLines = [
      ...lines.slice(0, patch.startLine - 1),
      ...patch.replacement.split("\n"),
      ...lines.slice(patch.endLine),
    ]

    setState((prev) => {
      const newFiles = new Map(prev.files)
      newFiles.set(patch.file, newLines.join("\n"))
      return { ...prev, files: newFiles }
    })

    return true
  }

  const toggleTheme = () => {
    setState((prev) => {
      const newDarkMode = !prev.isDarkMode
      if (newDarkMode) {
        document.documentElement.classList.add("dark")
        localStorage.setItem("diranalyze-theme", "dark")
      } else {
        document.documentElement.classList.remove("dark")
        localStorage.setItem("diranalyze-theme", "light")
      }
      return { ...prev, isDarkMode: newDarkMode }
    })
  }

  const renderTreeNode = (node: any, path: string, depth: number): JSX.Element[] => {
    const entries = Object.entries(node).sort(([a, aVal]: [string, any], [b, bVal]: [string, any]) => {
      if (aVal.type !== bVal.type) {
        return aVal.type === "folder" ? -1 : 1
      }
      return a.localeCompare(b)
    })

    return entries.map(([name, value]: [string, any]) => {
      const fullPath = path ? `${path}/${name}` : name
      const isExpanded = state.expandedFolders.has(fullPath)
      const isSelected = state.selectedFiles.has(value.path || fullPath)

      return (
        <div key={fullPath}>
          <div
            className={`flex items-center gap-2 py-1 px-2 hover:bg-muted/50 cursor-pointer rounded-sm ${
              state.currentFile === value.path ? "bg-primary/10" : ""
            }`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleSelection(value.path || fullPath)}
              onClick={(e) => e.stopPropagation()}
            />

            {value.type === "folder" ? (
              <div className="flex items-center gap-1 flex-1" onClick={() => toggleFolder(fullPath)}>
                {isExpanded ? <FolderOpenIcon className="w-4 h-4" /> : <FolderIcon className="w-4 h-4" />}
                <span className="text-sm">{name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-1" onClick={() => openFile(value.path)}>
                <FileIcon className="w-4 h-4" />
                <span className="text-sm">{name}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatSize(state.files.get(value.path)?.length || 0)}
                </span>
              </div>
            )}
          </div>

          {value.type === "folder" && isExpanded && <div>{renderTreeNode(value.children, fullPath, depth + 1)}</div>}
        </div>
      )
    })
  }

  const generateTreeReport = () => {
    if (!state.fileTree) return ""

    const renderTreeText = (node: any, path: string, depth: number, isLast: boolean[] = []): string => {
      const entries = Object.entries(node).sort(([a, aVal]: [string, any], [b, bVal]: [string, any]) => {
        if (aVal.type !== bVal.type) {
          return aVal.type === "folder" ? -1 : 1
        }
        return a.localeCompare(b)
      })

      let result = ""

      entries.forEach(([name, value]: [string, any], index) => {
        const fullPath = path ? `${path}/${name}` : name
        const isCommitted = state.committedFiles.has(value.path || fullPath)

        if (!isCommitted) return // Only show committed files

        const isLastItem = index === entries.length - 1
        const prefix = isLast
          .map((last, i) => (i === isLast.length - 1 ? (isLastItem ? "└── " : "├── ") : last ? "    " : "│   "))
          .join("")

        if (value.type === "folder") {
          result += `${prefix}${name}/\n`
          const childResult = renderTreeText(value.children, fullPath, depth + 1, [...isLast, isLastItem])
          if (childResult) result += childResult
        } else {
          const size = state.files.get(value.path)?.length || 0
          result += `${prefix}${name} (Size: ${formatSize(size)})\n`
        }
      })

      return result
    }

    return renderTreeText(state.fileTree, "", 0)
  }

  // Helper function to check if a path is a folder
  const checkIfFolder = (fileTree: any, targetPath: string): boolean => {
    if (!fileTree) return false

    const findInTree = (node: any, path: string): boolean => {
      for (const [name, item] of Object.entries(node)) {
        if (path === name && item && typeof item === "object" && item.type === "folder") {
          return true
        }
        if (item && typeof item === "object" && item.children) {
          if (findInTree(item.children, path)) return true
        }
      }
      return false
    }

    return findInTree(fileTree, targetPath)
  }

  const getAllPathsUnder = (folderPath: string): string[] => {
    const paths: string[] = []

    const addSubfolders = (currentPath: string, items: any) => {
      if (!items || typeof items !== "object") return

      const itemsArray = Array.isArray(items) ? items : Object.entries(items)

      for (const item of itemsArray) {
        let itemPath: string, itemData: any

        if (Array.isArray(item)) {
          ;[itemPath, itemData] = item
          itemPath = currentPath ? `${currentPath}/${itemPath}` : itemPath
        } else if (typeof item === "object" && item.path) {
          itemPath = item.path
          itemData = item
        } else {
          continue
        }

        paths.push(itemPath)

        if (itemData && typeof itemData === "object" && itemData !== null) {
          const children = itemData.children || itemData.items || itemData
          if (children && typeof children === "object") {
            addSubfolders(itemPath, children)
          }
        }
      }
    }

    paths.push(folderPath)

    const findFolderContents = (tree: any, targetPath: string): any => {
      if (!tree || typeof tree !== "object") return null

      if (tree[targetPath]) {
        return tree[targetPath]
      }

      for (const [key, value] of Object.entries(tree)) {
        if (key === targetPath) {
          return value
        }
        if (typeof value === "object" && value !== null) {
          const found = findFolderContents(value, targetPath)
          if (found) return found
        }
      }

      return null
    }

    const folderContents = findFolderContents(state.fileTree, folderPath)
    if (folderContents) {
      addSubfolders(folderPath, folderContents)
    }

    return paths
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800`}>
      {/* Header */}
      <header
        className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50"
        onClick={() => state.viewMode === "editor" && exitEditor()}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="DirAnalyze" className="h-8" />
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">DirAnalyze 2.0</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Directory Analysis Tool</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={clearProject}>
              <TrashIcon className="w-4 h-4 mr-1" />
              Clear Project
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setState((prev) => ({ ...prev, isDarkMode: !prev.isDarkMode }))}
            >
              {state.isDarkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div
          className="w-80 border-r bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex flex-col"
          onClick={() => state.viewMode === "editor" && exitEditor()}
        >
          {/* Resize handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition-colors"
            onMouseDown={(e) => {
              setIsResizing(true)
              e.preventDefault()
            }}
          />

          {state.files.size === 0 ? (
            <div className="p-6">
              <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <UploadIcon className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Drop Folder Here</h3>
                  <p className="text-sm text-muted-foreground mb-4">Drag and drop a folder or click to select</p>
                  <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                    {isLoading ? "Loading..." : "Select Folder"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length > 0) {
                        handleFilesLoaded(files)
                      }
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {/* Controls */}
              <div className="p-4 border-b bg-muted/20">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Button size="sm" variant="outline" onClick={exportTextReport}>
                    <DownloadIcon className="w-4 h-4 mr-1" />
                    Text Report
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportCombinedText}>
                    <CodeIcon className="w-4 h-4 mr-1" />
                    Combined
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <Button size="sm" variant="ghost" onClick={() => selectAll(true)}>
                    <CheckIcon className="w-4 h-4 mr-1" />
                    All
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => selectAll(false)}>
                    <XIcon className="w-4 h-4 mr-1" />
                    None
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="ghost" onClick={() => expandAll(true)}>
                    <ExpandIcon className="w-4 h-4 mr-1" />
                    Expand
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => expandAll(false)}>
                    <CollapseIcon className="w-4 h-4 mr-1" />
                    Collapse
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <div className="p-4 border-b bg-background/50">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="include-filter" className="text-xs font-medium">
                      Include patterns
                    </Label>
                    <Input
                      id="include-filter"
                      placeholder="*.js, *.css"
                      value={state.filters.include}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          filters: { ...prev.filters, include: e.target.value },
                        }))
                      }
                      onBlur={applyFilters}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <Label htmlFor="exclude-filter" className="text-xs font-medium">
                      Exclude patterns
                    </Label>
                    <Input
                      id="exclude-filter"
                      placeholder="node_modules, .git"
                      value={state.filters.exclude}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          filters: { ...prev.filters, exclude: e.target.value },
                        }))
                      }
                      onBlur={applyFilters}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show-hidden"
                      checked={state.filters.showHidden}
                      onCheckedChange={(checked) => {
                        setState((prev) => ({
                          ...prev,
                          filters: { ...prev.filters, showHidden: checked as boolean },
                        }))
                        applyFilters()
                      }}
                    />
                    <Label htmlFor="show-hidden" className="text-xs">
                      Show hidden files
                    </Label>
                  </div>
                </div>
              </div>

              {/* File Tree */}
              <ScrollArea className="flex-1">
                <div className="p-2">{state.fileTree && renderTreeNode(state.fileTree, "", 0)}</div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {state.viewMode === "editor" && state.currentFile ? (
            <>
              {/* Editor Toolbar */}
              <div className="flex items-center justify-between p-4 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={copyWithLineNumbers}>
                    <CopyIcon className="w-4 h-4 mr-1" />
                    Copy with Lines
                  </Button>

                  <Dialog open={patchModalOpen} onOpenChange={setPatchModalOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <SettingsIcon className="w-4 h-4 mr-1" />
                        Apply Patch
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>Apply AI Patches</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                          <p>Paste patches in the format below. The AI should respond with FILE: and line ranges.</p>
                          <pre className="mt-2 p-3 bg-muted rounded text-xs">
                            {`FILE: path/to/file.js
45-47:
    new code here`}
                          </pre>
                        </div>
                        <Textarea
                          placeholder={`PATCHES:

FILE: src/main.js
45-47:
    const updated = true;
    console.log('Updated');

FILE: src/utils.js
10-15:
    function helper() {
        return processData();
    }`}
                          value={patchInput}
                          onChange={(e) => setPatchInput(e.target.value)}
                          className="min-h-[300px] font-mono text-sm"
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setPatchModalOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={applyPatches}>Apply Patches</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button size="sm" variant="outline" onClick={saveCurrentFile} disabled={!state.hasUnsavedChanges}>
                    <SaveIcon className="w-4 h-4 mr-1" />
                    Save
                  </Button>

                  <Button size="sm" variant="outline" onClick={exitEditor}>
                    <XIcon className="w-4 h-4 mr-1" />
                    Close
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  {state.currentFile}
                  {state.hasUnsavedChanges ? " (modified)" : ""}
                </div>
              </div>

              {/* Editor */}
              <div className="flex-1 flex">
                <div className="w-16 bg-muted/30 border-r flex flex-col items-end p-2 text-xs text-muted-foreground font-mono">
                  {state.files
                    .get(state.currentFile)
                    ?.split("\n")
                    .map((_, i) => (
                      <div key={i} className="leading-6">
                        {i + 1}
                      </div>
                    ))}
                </div>
                <Textarea
                  ref={editorRef}
                  value={state.files.get(state.currentFile) || ""}
                  onChange={(e) => handleEditorChange(e.target.value)}
                  className="flex-1 border-0 rounded-none font-mono text-sm leading-6 resize-none"
                  style={{ minHeight: "100%" }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* Tree View Header */}
              <div className="flex items-center justify-between p-4 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Directory Structure</h3>
                  <Badge variant="secondary">{state.committedFiles.size} committed files</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const treeText = generateTreeReport()
                    navigator.clipboard.writeText(treeText)
                    showNotification("Tree structure copied to clipboard", "success")
                  }}
                  disabled={state.committedFiles.size === 0}
                >
                  <CopyIcon className="w-4 h-4 mr-1" />
                  Copy Report
                </Button>
              </div>

              {/* Tree View Content */}
              <div className="flex-1 p-4 overflow-auto">
                {state.committedFiles.size > 0 ? (
                  <div className="bg-muted/30 rounded-lg p-4">
                    <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed">{generateTreeReport()}</pre>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-md">
                      <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center">
                        <FileIcon className="w-12 h-12 text-primary/60" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">
                        {state.files.size === 0 ? "No files loaded" : "No files committed"}
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        {state.files.size === 0
                          ? "Drop a folder to get started with directory analysis"
                          : "Select files in the sidebar and click 'Commit' to see the directory structure"}
                      </p>
                      {state.files.size > 0 && (
                        <div className="space-y-2">
                          <Badge variant="secondary">{state.files.size} total files</Badge>
                          <Badge variant="secondary">{state.selectedFiles.size} selected</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t bg-primary text-primary-foreground px-6 py-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <span>{state.files.size} files</span>
            <span>{state.selectedFiles.size} selected</span>
            <span>
              {formatSize(
                Array.from(state.committedFiles.size > 0 ? state.committedFiles : state.files.keys()).reduce(
                  (total, path) => total + (state.files.get(path)?.length || 0),
                  0,
                ),
              )}
            </span>
          </div>
          <div>{notification ? notification.message : "Ready"}</div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            notification.type === "success"
              ? "bg-green-500"
              : notification.type === "error"
                ? "bg-red-500"
                : notification.type === "warning"
                  ? "bg-yellow-500"
                  : "bg-blue-500"
          } text-white`}
        >
          {notification.message}
        </div>
      )}

      {/* Resize handler */}
      {isResizing && (
        <div
          className="fixed inset-0 cursor-ew-resize z-50"
          onMouseMove={(e) => {
            if (isResizing) {
              const newWidth = e.clientX
              if (newWidth > 300 && newWidth < 800) {
                setSidebarWidth(newWidth)
              }
            }
          }}
          onMouseUp={() => setIsResizing(false)}
        />
      )}
    </div>
  )
}
