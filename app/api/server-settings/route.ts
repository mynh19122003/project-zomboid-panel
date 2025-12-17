import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Normalize đường dẫn Windows
function normalizePath(inputPath: string): string {
  // Loại bỏ các ký tự không hợp lệ
  let normalized = inputPath.trim()
  
  // Thay thế backslash bằng forward slash (Node.js path.join sẽ xử lý)
  // Nhưng giữ nguyên để path.join xử lý đúng trên Windows
  
  // Normalize đường dẫn
  normalized = path.normalize(normalized)
  
  return normalized
}

// Kiểm tra quyền truy cập file
function checkFileAccess(filePath: string): { accessible: boolean; error?: string } {
  try {
    // Kiểm tra file có tồn tại không
    if (!fs.existsSync(filePath)) {
      return { accessible: false, error: 'File does not exist' }
    }

    // Kiểm tra quyền đọc
    try {
      fs.accessSync(filePath, fs.constants.R_OK)
    } catch (err) {
      return { accessible: false, error: 'No read permission' }
    }

    // Kiểm tra là file (không phải thư mục)
    const stats = fs.statSync(filePath)
    if (!stats.isFile()) {
      return { accessible: false, error: 'Path is not a file' }
    }

    return { accessible: true }
  } catch (error: any) {
    return { accessible: false, error: error.message }
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const serverPath = searchParams.get('serverPath')

    if (!serverPath) {
      return NextResponse.json(
        { error: 'Server path is required' },
        { status: 400 }
      )
    }

    // Normalize đường dẫn
    const normalizedServerPath = normalizePath(serverPath)
    console.log('Original path:', serverPath)
    console.log('Normalized path:', normalizedServerPath)

    // Kiểm tra thư mục server có tồn tại không
    if (!fs.existsSync(normalizedServerPath)) {
      return NextResponse.json(
        { 
          error: 'Server directory not found',
          path: normalizedServerPath,
          originalPath: serverPath
        },
        { status: 404 }
      )
    }

    // Kiểm tra là thư mục
    const serverStats = fs.statSync(normalizedServerPath)
    if (!serverStats.isDirectory()) {
      return NextResponse.json(
        { 
          error: 'Server path is not a directory',
          path: normalizedServerPath
        },
        { status: 400 }
      )
    }

    // Tìm file server.ini trong thư mục server
    const serverIniPath = path.join(normalizedServerPath, 'server.ini')
    console.log('Looking for server.ini at:', serverIniPath)
    
    // Kiểm tra file có tồn tại không
    if (!fs.existsSync(serverIniPath)) {
      // Liệt kê các file trong thư mục để debug
      const files = fs.readdirSync(normalizedServerPath)
      console.log('Files in server directory:', files)
      
      return NextResponse.json(
        { 
          error: 'server.ini not found',
          path: serverIniPath,
          filesInDirectory: files
        },
        { status: 404 }
      )
    }

    // Kiểm tra quyền truy cập
    const accessCheck = checkFileAccess(serverIniPath)
    if (!accessCheck.accessible) {
      return NextResponse.json(
        { 
          error: `Cannot access server.ini: ${accessCheck.error}`,
          path: serverIniPath
        },
        { status: 403 }
      )
    }

    // Đọc file
    let content: string
    try {
      content = fs.readFileSync(serverIniPath, 'utf-8')
      console.log('Successfully read server.ini, size:', content.length, 'bytes')
    } catch (readError: any) {
      console.error('Error reading file:', readError)
      return NextResponse.json(
        { 
          error: `Cannot read server.ini: ${readError.message}`,
          path: serverIniPath
        },
        { status: 500 }
      )
    }

    const settings: Record<string, string> = {}

    // Parse INI file
    content.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith(';') && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          const value = match[2].trim()
          settings[key] = value
        }
      }
    })

    console.log('Parsed settings count:', Object.keys(settings).length)

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Server settings GET error:', error)
    return NextResponse.json(
      { 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { serverPath, settings } = await request.json()

    if (!serverPath || !settings) {
      return NextResponse.json(
        { error: 'Server path and settings are required' },
        { status: 400 }
      )
    }

    // Normalize đường dẫn
    const normalizedServerPath = normalizePath(serverPath)
    const serverIniPath = path.join(normalizedServerPath, 'server.ini')
    
    console.log('POST: Writing to server.ini at:', serverIniPath)
    
    if (!fs.existsSync(serverIniPath)) {
      return NextResponse.json(
        { 
          error: 'server.ini not found',
          path: serverIniPath
        },
        { status: 404 }
      )
    }

    // Kiểm tra quyền ghi
    try {
      fs.accessSync(serverIniPath, fs.constants.W_OK)
    } catch (err) {
      return NextResponse.json(
        { 
          error: 'No write permission for server.ini',
          path: serverIniPath
        },
        { status: 403 }
      )
    }

    // Đọc file hiện tại để giữ lại comments và format
    const currentContent = fs.readFileSync(serverIniPath, 'utf-8')
    const lines = currentContent.split('\n')
    const newLines: string[] = []

    // Tạo map của settings mới
    const settingsMap = new Map(Object.entries(settings))

    // Xử lý từng dòng
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Giữ lại comments và empty lines
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
        newLines.push(line)
        continue
      }

      // Tìm và thay thế setting
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        if (settingsMap.has(key)) {
          newLines.push(`${key}=${settingsMap.get(key)}`)
          settingsMap.delete(key) // Đánh dấu đã xử lý
        } else {
          newLines.push(line) // Giữ nguyên nếu không có thay đổi
        }
      } else {
        newLines.push(line)
      }
    }

    // Thêm các settings mới chưa có trong file
    settingsMap.forEach((value, key) => {
      newLines.push(`${key}=${value}`)
    })

    // Ghi file
    fs.writeFileSync(serverIniPath, newLines.join('\n'), 'utf-8')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

