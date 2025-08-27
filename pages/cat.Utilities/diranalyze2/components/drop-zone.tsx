"use client"

import type React from "react"

import { useCallback } from "react"

interface DropZoneProps {
  onFilesLoaded: (files: File[]) => void
  isLoading: boolean
}

export function DropZone({ onFilesLoaded, isLoading }: DropZoneProps) {
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()

      const items = Array.from(e.dataTransfer.items)
      const files: File[] = []

      for (const item of items) {
        if (item.kind === "file") {
          const entry = item.webkitGetAsEntry()
          if (entry) {
            await traverseFileTree(entry, files)
          }
        }
      }

      if (files.length > 0) {
        onFilesLoaded(files)
      }
    },
    [onFilesLoaded],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        onFilesLoaded(files)
      }
    },
    [onFilesLoaded],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer group"
        onClick={() => document.getElementById("folder-input")?.click()}
      >
        {isLoading ? (
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Loading files...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto bg-muted rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <span className="text-2xl">📁</span>
            </div>
            <div>
              <p className="font-medium mb-1">Drop folder here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
          </div>
        )}
      </div>

      <input id="folder-input" type="file" webkitdirectory="" multiple className="hidden" onChange={handleFileInput} />
    </div>
  )
}

async function traverseFileTree(entry: any, files: File[], path = ""): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file: File) => {
        Object.defineProperty(file, "webkitRelativePath", {
          value: path + entry.name,
          configurable: true,
        })
        files.push(file)
        resolve()
      })
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      reader.readEntries(async (entries: any[]) => {
        for (const childEntry of entries) {
          await traverseFileTree(childEntry, files, path + entry.name + "/")
        }
        resolve()
      })
    } else {
      resolve()
    }
  })
}
