"use client"

import { useState, useEffect } from "react"
import type { FileData } from "@/lib/file-utils"

interface FileEditorProps {
  file: FileData
  path: string
  onUpdate: (path: string, content: string) => void
}

export function FileEditor({ file, path, onUpdate }: FileEditorProps) {
  const [content, setContent] = useState(file.content)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setContent(file.content)
    setHasChanges(false)
  }, [file.content, path])

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    setHasChanges(newContent !== file.content)
  }

  const handleSave = () => {
    onUpdate(path, content)
    setHasChanges(false)
  }

  const handleCopy = () => {
    const lines = content.split("\n")
    const numberedContent = lines.map((line, index) => `${index + 1}: ${line}`).join("\n")

    const output = `FILE: ${path}\n${"=".repeat(50)}\n${numberedContent}`
    navigator.clipboard.writeText(output)
  }

  return (
    <div className="flex flex-direction-column h-full">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium truncate max-w-md" title={path}>
            {path}
          </span>
          {hasChanges && <span className="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
          >
            Copy with Lines
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex">
        {/* Line Numbers */}
        <div className="w-12 bg-muted/30 border-r text-right text-xs text-muted-foreground p-2 font-mono leading-6 select-none">
          {content.split("\n").map((_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="flex-1 p-4 bg-background border-none outline-none resize-none font-mono text-sm leading-6"
          placeholder="File content will appear here..."
          spellCheck={false}
        />
      </div>
    </div>
  )
}
