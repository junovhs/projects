export interface FileData {
  content: string
  size: number
  extension: string
}

export async function loadFiles(fileList: File[]): Promise<Map<string, FileData>> {
  const files = new Map<string, FileData>()

  // Filter out common build/cache directories
  const ignoredPatterns = ["node_modules/", ".git/", "dist/", "build/", ".next/", ".cache/", "coverage/", ".DS_Store"]

  for (const file of fileList) {
    const path = file.webkitRelativePath || file.name

    // Skip ignored files
    if (ignoredPatterns.some((pattern) => path.includes(pattern))) {
      continue
    }

    // Skip hidden files (except common config files)
    const parts = path.split("/")
    const hasHiddenPart = parts.some(
      (part) =>
        part.startsWith(".") &&
        !["gitignore", "env", "env.local", "env.example"].some((allowed) => part.includes(allowed)),
    )
    if (hasHiddenPart) continue

    // Skip binary files by extension
    const extension = path.split(".").pop()?.toLowerCase() || ""
    const binaryExtensions = ["png", "jpg", "jpeg", "gif", "ico", "pdf", "zip", "exe", "dll"]
    if (binaryExtensions.includes(extension)) continue

    try {
      const content = await readFileContent(file)
      files.set(path, {
        content,
        size: file.size,
        extension,
      })
    } catch (error) {
      console.warn(`Failed to read file ${path}:`, error)
    }
  }

  return files
}

function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string) || "")
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsText(file)
  })
}

export function exportFiles(files: Map<string, FileData>) {
  const output: string[] = []

  output.push("//--- DIRANALYZE EXPORT ---//")
  output.push(`// Generated: ${new Date().toISOString()}`)
  output.push(`// Files: ${files.size}`)
  output.push("//")

  // Directory structure
  output.push("//--- DIRECTORY STRUCTURE ---")
  output.push(generateTreeStructure(Array.from(files.keys())))
  output.push("")

  // File contents
  output.push("//--- FILE CONTENTS ---")
  output.push("")

  const sortedPaths = Array.from(files.keys()).sort()
  for (const path of sortedPaths) {
    const fileData = files.get(path)!
    output.push(`=== FILE: ${path} ===`)

    const lines = fileData.content.split("\n")
    lines.forEach((line, index) => {
      output.push(`${index + 1}: ${line}`)
    })
    output.push("")
  }

  output.push("//--- END OF EXPORT ---//")

  const exportText = output.join("\n")
  navigator.clipboard.writeText(exportText)

  // Also trigger download
  const blob = new Blob([exportText], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `diranalyze-export-${Date.now()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function generateTreeStructure(paths: string[]): string {
  const tree: Record<string, any> = {}

  // Build tree structure
  for (const path of paths) {
    const parts = path.split("/")
    let current = tree

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i === parts.length - 1) {
        current[part] = "file"
      } else {
        if (!current[part]) {
          current[part] = {}
        }
        current = current[part]
      }
    }
  }

  // Render tree
  const lines: string[] = []

  function renderNode(node: any, prefix = "", isLast = true) {
    const entries = Object.entries(node)
    entries.forEach(([name, value], index) => {
      const isLastEntry = index === entries.length - 1
      const connector = isLastEntry ? "└── " : "├── "
      const extension = isLastEntry ? "    " : "│   "

      if (value === "file") {
        lines.push(`${prefix}${connector}📄 ${name}`)
      } else {
        lines.push(`${prefix}${connector}📁 ${name}/`)
        renderNode(value, prefix + extension, isLastEntry)
      }
    })
  }

  renderNode(tree)
  return lines.join("\n")
}
