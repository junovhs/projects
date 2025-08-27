"use client"

import { useState } from "react"
import type { FileData } from "@/lib/file-utils"

interface FileTreeProps {
  files: Map<string, FileData>
  selectedFiles: Set<string>
  currentFile: string | null
  onFileSelect: (path: string) => void
  onSelectionChange: (path: string, selected: boolean) => void
}

interface TreeNode {
  type: "file" | "folder"
  path?: string
  children?: Record<string, TreeNode>
  size?: number
}

export function FileTree({ files, selectedFiles, currentFile, onFileSelect, onSelectionChange }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Build tree structure
  const tree = buildTree(files)

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFolders(newExpanded)
  }

  const renderNode = (name: string, node: TreeNode, path: string, depth: number) => {
    const isExpanded = expandedFolders.has(path)
    const isSelected = node.path ? selectedFiles.has(node.path) : false
    const isCurrent = node.path === currentFile

    return (
      <div key={path}>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded-sm cursor-pointer group ${
            isCurrent ? "bg-primary/10 text-primary" : ""
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.type === "folder") {
              toggleFolder(path)
            } else if (node.path) {
              onFileSelect(node.path)
            }
          }}
        >
          {node.type === "folder" && (
            <span className="text-xs w-4 flex justify-center">{isExpanded ? "📂" : "📁"}</span>
          )}

          {node.type === "file" && node.path && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation()
                onSelectionChange(node.path!, e.target.checked)
              }}
              className="w-3 h-3 rounded border-2"
            />
          )}

          <span className="text-xs w-4 flex justify-center">{node.type === "file" ? getFileIcon(name) : ""}</span>

          <span className="flex-1 text-sm truncate">{name}</span>

          {node.type === "file" && node.size && (
            <span className="text-xs text-muted-foreground">{formatSize(node.size)}</span>
          )}
        </div>

        {node.type === "folder" && isExpanded && node.children && (
          <div>
            {Object.entries(node.children)
              .sort(([a, aNode], [b, bNode]) => {
                if (aNode.type !== bNode.type) {
                  return aNode.type === "folder" ? -1 : 1
                }
                return a.localeCompare(b)
              })
              .map(([childName, childNode]) => renderNode(childName, childNode, `${path}/${childName}`, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-2 space-y-1">
      {Object.entries(tree)
        .sort(([a, aNode], [b, bNode]) => {
          if (aNode.type !== bNode.type) {
            return aNode.type === "folder" ? -1 : 1
          }
          return a.localeCompare(b)
        })
        .map(([name, node]) => renderNode(name, node, name, 0))}
    </div>
  )
}

function buildTree(files: Map<string, FileData>): Record<string, TreeNode> {
  const tree: Record<string, TreeNode> = {}

  for (const [path, fileData] of files) {
    const parts = path.split("/")
    let current = tree

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]

      if (i === parts.length - 1) {
        // File
        current[part] = {
          type: "file",
          path,
          size: fileData.content.length,
        }
      } else {
        // Folder
        if (!current[part]) {
          current[part] = {
            type: "folder",
            children: {},
          }
        }
        current = current[part].children!
      }
    }
  }

  return tree
}

function getFileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  const icons: Record<string, string> = {
    js: "📜",
    jsx: "⚛️",
    ts: "📘",
    tsx: "⚛️",
    json: "📋",
    html: "🌐",
    css: "🎨",
    scss: "🎨",
    md: "📝",
    txt: "📄",
    py: "🐍",
    java: "☕",
    png: "🖼️",
    jpg: "🖼️",
    gif: "🖼️",
    svg: "🎨",
  }
  return icons[ext || ""] || "📄"
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}
