import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

function normalizePath(inputPath: string): string {
  let normalized = inputPath.trim()
  normalized = path.normalize(normalized)
  return normalized
}

// Parse SandboxVars.lua format
// Hỗ trợ cấu trúc: SandboxVars = { Section = { key = value, }, key = value, }
function parseSandboxVarsLua(content: string): Record<string, any> {
  const result: Record<string, any> = {}

  // Remove comments
  let cleanContent = content
    .replace(/--\[\[[\s\S]*?\]\]/g, '') // Multi-line comments
    .replace(/--.*$/gm, '') // Single-line comments

  // Parse key = value patterns
  // This regex matches: key = value (where value can be number, boolean, string, or table start)
  const keyValueRegex = /([a-zA-Z_][a-zA-Z0-9_.]*)\s*=\s*([^,}\n]+)/g

  let match
  while ((match = keyValueRegex.exec(cleanContent)) !== null) {
    const key = match[1].trim()
    let value = match[2].trim()

    // Skip if value starts with { (table definition)
    if (value === '{' || value.startsWith('{')) {
      continue
    }

    // Remove trailing comma
    value = value.replace(/,\s*$/, '')

    // Parse value type
    if (value === 'true') {
      result[key] = 'true'
    } else if (value === 'false') {
      result[key] = 'false'
    } else if (!isNaN(Number(value))) {
      result[key] = value
    } else if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
      result[key] = value.slice(1, -1)
    } else {
      result[key] = value
    }
  }

  return result
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filePath = searchParams.get('filePath')

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    const normalizedFilePath = normalizePath(filePath)
    console.log('Reading file:', normalizedFilePath)

    if (!fs.existsSync(normalizedFilePath)) {
      return NextResponse.json(
        { error: 'File not found', path: normalizedFilePath },
        { status: 404 }
      )
    }

    const stats = fs.statSync(normalizedFilePath)
    if (!stats.isFile()) {
      return NextResponse.json(
        { error: 'Path is not a file', path: normalizedFilePath },
        { status: 400 }
      )
    }

    // Kiểm tra quyền đọc
    try {
      fs.accessSync(normalizedFilePath, fs.constants.R_OK)
    } catch (err) {
      return NextResponse.json(
        { error: 'No read permission', path: normalizedFilePath },
        { status: 403 }
      )
    }

    // Đọc file
    const content = fs.readFileSync(normalizedFilePath, 'utf-8')
    const extension = path.extname(normalizedFilePath).toLowerCase()

    // Parse file dựa trên extension
    let parsedContent: Record<string, any> = {}

    if (extension === '.ini') {
      // Parse INI file
      content.split('\n').forEach((line, index) => {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith(';') && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/)
          if (match) {
            const key = match[1].trim()
            const value = match[2].trim()
            parsedContent[key] = value
          }
        }
      })
    } else if (extension === '.lua') {
      // Parse SandBoxVars.lua file
      // Format: SandboxVars = { section = { key = value, }, }

      // Detect if this is a SandboxVars file
      const isSandboxVars = content.includes('SandboxVars') || path.basename(normalizedFilePath).toLowerCase().includes('sandboxvars')

      if (isSandboxVars) {
        // Parse SandboxVars format
        parsedContent = parseSandboxVarsLua(content)
      } else {
        // Parse simple lua format
        const lines = content.split('\n')
        lines.forEach(line => {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith('--') && !trimmed.startsWith('--[[')) {
            const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/)
            if (match) {
              const key = match[1].trim()
              let value = match[2].trim()
              value = value.replace(/;?\s*$/, '')
              if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1)
              }
              parsedContent[key] = value
            }
          }
        })
      }
    }

    return NextResponse.json({
      content: parsedContent,
      rawContent: content,
      fileName: path.basename(normalizedFilePath),
      filePath: normalizedFilePath,
      extension: extension,
      size: stats.size,
    })
  } catch (error: any) {
    console.error('Read file error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { filePath, content } = await request.json()

    if (!filePath || content === undefined) {
      return NextResponse.json(
        { error: 'File path and content are required' },
        { status: 400 }
      )
    }

    const normalizedFilePath = normalizePath(filePath)

    if (!fs.existsSync(normalizedFilePath)) {
      return NextResponse.json(
        { error: 'File not found', path: normalizedFilePath },
        { status: 404 }
      )
    }

    // Kiểm tra quyền ghi
    try {
      fs.accessSync(normalizedFilePath, fs.constants.W_OK)
    } catch (err) {
      return NextResponse.json(
        { error: 'No write permission', path: normalizedFilePath },
        { status: 403 }
      )
    }

    // Ghi file
    fs.writeFileSync(normalizedFilePath, content, 'utf-8')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}





