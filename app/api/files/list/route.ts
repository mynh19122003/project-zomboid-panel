import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

function normalizePath(inputPath: string): string {
  let normalized = inputPath.trim()
  normalized = path.normalize(normalized)
  return normalized
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const directoryPath = searchParams.get('directoryPath')
    const fileExtensions = searchParams.get('extensions')?.split(',') || ['.ini', '.lua']

    if (!directoryPath) {
      return NextResponse.json(
        { error: 'Directory path is required' },
        { status: 400 }
      )
    }

    const normalizedPath = normalizePath(directoryPath)

    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json(
        { error: 'Directory not found', path: normalizedPath },
        { status: 404 }
      )
    }

    const stats = fs.statSync(normalizedPath)
    if (!stats.isDirectory()) {
      return NextResponse.json(
        { error: 'Path is not a directory', path: normalizedPath },
        { status: 400 }
      )
    }

    // Đọc tất cả files trong thư mục
    const files = fs.readdirSync(normalizedPath, { withFileTypes: true })
    
    const fileList = files
      .filter(file => {
        if (!file.isFile()) return false
        const ext = path.extname(file.name).toLowerCase()
        return fileExtensions.some(ext2 => ext === ext2.toLowerCase())
      })
      .map(file => ({
        name: file.name,
        path: path.join(normalizedPath, file.name),
        extension: path.extname(file.name).toLowerCase(),
        size: fs.statSync(path.join(normalizedPath, file.name)).size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ files: fileList })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}





