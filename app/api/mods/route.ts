import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Normalize đường dẫn Windows
function normalizePath(inputPath: string): string {
  let normalized = inputPath.trim()
  normalized = path.normalize(normalized)
  return normalized
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const serverPath = searchParams.get('serverPath')
    const filePath = searchParams.get('filePath') // Cho phép chỉ định file cụ thể

    if (!serverPath && !filePath) {
      return NextResponse.json(
        { error: 'Server path or file path is required' },
        { status: 400 }
      )
    }

    let iniPath: string

    if (filePath) {
      // Nếu có filePath, dùng file đó
      iniPath = normalizePath(filePath)
      console.log('Mods GET: Using specified file:', iniPath)
    } else {
      // Nếu không, tìm file trong thư mục server
      const normalizedServerPath = normalizePath(serverPath!)
      console.log('Mods GET: Server path:', normalizedServerPath)

      // Kiểm tra thư mục có tồn tại không
      if (!fs.existsSync(normalizedServerPath)) {
        console.log('Mods GET: Server directory not found')
        return NextResponse.json({ mods: [] })
      }

      // Tìm file servertest.ini hoặc server.ini để đọc mod list
      const serverIniPath = path.join(normalizedServerPath, 'servertest.ini')
      const fallbackPath = path.join(normalizedServerPath, 'server.ini')
      
      console.log('Mods GET: Looking for ini files:', { serverIniPath, fallbackPath })
      
      iniPath = fs.existsSync(serverIniPath) ? serverIniPath : fallbackPath
      
      if (!fs.existsSync(iniPath)) {
        console.log('Mods GET: No ini file found')
        return NextResponse.json({ mods: [] })
      }
    }

    if (!fs.existsSync(iniPath)) {
      console.log('Mods GET: File not found:', iniPath)
      return NextResponse.json({ mods: [] })
    }

    console.log('Mods GET: Reading from:', iniPath)

    const content = fs.readFileSync(iniPath, 'utf-8')
    const mods: Array<{ id: string; name: string; workshopId?: string }> = []

    // Ưu tiên đọc WorkshopItems= trước (đây là nguồn chính xác nhất)
    // Đọc toàn bộ file và tìm dòng WorkshopItems=, sau đó đọc toàn bộ giá trị
    let workshopLine = ''
    let foundWorkshopItems = false
    
    // Cách 1: Dùng regex với multiline và dotall để match toàn bộ dòng
    // Tìm WorkshopItems= và đọc đến khi gặp newline hoặc dòng mới bắt đầu bằng key=
    const workshopMatch = content.match(/^WorkshopItems\s*=\s*([^\r\n]+(?:\r?\n(?!\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=)[^\r\n]+)*)/im)
    
    if (workshopMatch) {
      foundWorkshopItems = true
      workshopLine = workshopMatch[1]
        .replace(/\r\n/g, '') // Loại bỏ line breaks
        .replace(/\n/g, '')   // Loại bỏ line breaks
        .replace(/\r/g, '')   // Loại bỏ line breaks
        .trim()
    } else {
      // Cách 2: Đọc từng dòng nếu regex không match (fallback)
      const lines = content.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // Tìm dòng bắt đầu với WorkshopItems=
        if (/^WorkshopItems\s*=/i.test(line.trim())) {
          foundWorkshopItems = true
          // Lấy phần sau dấu =
          const match = line.match(/^WorkshopItems\s*=\s*(.+)$/i)
          if (match) {
            workshopLine = match[1].trim()
          } else {
            workshopLine = line.replace(/^WorkshopItems\s*=\s*/i, '').trim()
          }
          
          // Đọc các dòng tiếp theo nếu chúng không bắt đầu bằng key= (line continuation)
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].trim()
            // Nếu dòng tiếp theo bắt đầu bằng key= hoặc là comment hoặc empty, dừng lại
            if (nextLine === '' || 
                nextLine.startsWith(';') || 
                nextLine.startsWith('#') || 
                /^[a-zA-Z_][a-zA-Z0-9_]*\s*=/i.test(nextLine)) {
              break
            }
            // Nếu không, thêm vào workshopLine (có thể là phần tiếp theo của WorkshopItems)
            workshopLine += nextLine.trim()
          }
          break
        }
      }
    }
    
    // Parse workshop IDs từ WorkshopItems=
    const workshopIds: string[] = []
    if (foundWorkshopItems && workshopLine) {
      console.log('Found WorkshopItems line')
      console.log('  Length:', workshopLine.length, 'characters')
      console.log('  First 200 chars:', workshopLine.substring(0, 200))
      console.log('  Last 200 chars:', workshopLine.substring(Math.max(0, workshopLine.length - 200)))
      
      // Đếm số dấu chấm phẩy để ước tính số lượng IDs
      const semicolonCount = (workshopLine.match(/;/g) || []).length
      console.log('  Semicolon count:', semicolonCount, '(expected IDs:', semicolonCount + 1, ')')
      
      // Tách bằng dấu chấm phẩy (;) - format chuẩn của Project Zomboid
      // Loại bỏ tất cả whitespace và tách
      const allParts = workshopLine.split(';')
      console.log('  Split into', allParts.length, 'parts')
      
      const ids = allParts
        .map(id => id.trim())
        .filter(Boolean)
        .filter(id => {
          const isValid = /^\d+$/.test(id)
          if (!isValid && id.length > 0) {
            console.log('  Skipping invalid ID:', id.substring(0, 50))
          }
          return isValid
        }) // Chỉ lấy các ID là số
      
      workshopIds.push(...ids)
      
      console.log('Parsed Workshop IDs:')
      console.log('  Total count:', workshopIds.length)
      if (workshopIds.length > 0) {
        console.log('  First 5 IDs:', workshopIds.slice(0, 5))
        console.log('  Last 5 IDs:', workshopIds.slice(-5))
      }
      
      // Cảnh báo nếu số lượng IDs không khớp với số dấu chấm phẩy
      if (workshopIds.length !== semicolonCount + 1 && semicolonCount > 0) {
        console.warn('  WARNING: Expected', semicolonCount + 1, 'IDs but got', workshopIds.length)
      }
    } else {
      console.log('WorkshopItems not found in file')
    }

    // Thêm tất cả workshop IDs vào danh sách mods
    workshopIds.forEach(workshopId => {
      mods.push({
        id: workshopId,
        name: workshopId, // Tạm thời dùng ID làm tên, sẽ được cập nhật khi load details
        workshopId: workshopId
      })
    })

    // Nếu không có WorkshopItems, thử đọc từ Mods=
    if (mods.length === 0) {
      const modsMatch = content.match(/Mods\s*=\s*(.+)/i)
      if (modsMatch) {
        const modsLine = modsMatch[1].trim()
        console.log('Found Mods line (fallback):', modsLine)
        
        const modNames = modsLine
          .split(/[;,]/)
          .map(id => id.trim())
          .filter(Boolean)
        
        modNames.forEach(name => {
          const isWorkshopId = /^\d+$/.test(name)
          mods.push({
            id: name,
            name: name,
            workshopId: isWorkshopId ? name : undefined
          })
        })
      }
    }

    console.log('Total mods found:', mods.length)

    return NextResponse.json({ mods })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { serverPath, mods } = await request.json()

    if (!serverPath || !mods) {
      return NextResponse.json(
        { error: 'Server path and mods are required' },
        { status: 400 }
      )
    }

    // Normalize đường dẫn
    const normalizedServerPath = normalizePath(serverPath)
    console.log('Mods POST: Server path:', normalizedServerPath)

    const serverIniPath = path.join(normalizedServerPath, 'servertest.ini')
    const fallbackPath = path.join(normalizedServerPath, 'server.ini')
    
    const iniPath = fs.existsSync(serverIniPath) ? serverIniPath : fallbackPath
    
    console.log('Mods POST: Writing to:', iniPath)
    
    if (!fs.existsSync(iniPath)) {
      return NextResponse.json(
        { 
          error: 'Server ini file not found',
          path: iniPath,
          serverPath: normalizedServerPath
        },
        { status: 404 }
      )
    }

    // Kiểm tra quyền ghi
    try {
      fs.accessSync(iniPath, fs.constants.W_OK)
    } catch (err) {
      return NextResponse.json(
        { 
          error: 'No write permission for ini file',
          path: iniPath
        },
        { status: 403 }
      )
    }

    let content = fs.readFileSync(iniPath, 'utf-8')
    const lines = content.split('\n')

    // Tách mods thành regular mods và workshop items
    const regularMods = mods.filter((m: any) => !m.workshopId).map((m: any) => m.id)
    const workshopItems = mods.filter((m: any) => m.workshopId).map((m: any) => m.workshopId || m.id)

    // Cập nhật Mods=
    const modsLineIndex = lines.findIndex(line => /^Mods\s*=/i.test(line.trim()))
    if (modsLineIndex !== -1) {
      lines[modsLineIndex] = `Mods=${regularMods.join(';')}`
    } else if (regularMods.length > 0) {
      lines.push(`Mods=${regularMods.join(';')}`)
    }

    // Cập nhật WorkshopItems=
    const workshopLineIndex = lines.findIndex(line => /^WorkshopItems\s*=/i.test(line.trim()))
    if (workshopLineIndex !== -1) {
      lines[workshopLineIndex] = `WorkshopItems=${workshopItems.join(';')}`
    } else if (workshopItems.length > 0) {
      lines.push(`WorkshopItems=${workshopItems.join(';')}`)
    }

    fs.writeFileSync(iniPath, lines.join('\n'), 'utf-8')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

