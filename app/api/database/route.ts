import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

interface TableInfo {
  name: string
  rowCount: number
}

interface DatabaseInfo {
  path: string
  tables: TableInfo[]
  error?: string
}

import os from 'os'

// Find database files in the server directory
function findDatabaseFiles(serverPath: string): string[] {
  const dbFiles: string[] = []
  
  // Common locations for PZ database files
  const searchPaths = [
    path.join(serverPath, 'db'),
    path.join(serverPath, '..', 'db'), // Parent folder
    serverPath,
    path.join(os.homedir(), 'Zomboid', 'db'), // Default Windows User Save location
    path.join(os.homedir(), 'Zomboid', 'Saves'), // Check specific save folders if needed
  ]
  
  for (const searchPath of searchPaths) {
    try {
      if (fs.existsSync(searchPath) && fs.statSync(searchPath).isDirectory()) {
        const files = fs.readdirSync(searchPath)
        for (const file of files) {
          if (file.endsWith('.db')) {
            dbFiles.push(path.join(searchPath, file))
          }
        }
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  return dbFiles
}

// GET - List databases and tables
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const serverPath = searchParams.get('serverPath') || ''
    const dbPath = searchParams.get('dbPath') || ''
    const tableName = searchParams.get('table') || ''
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // If no specific db path, list all databases
    if (!dbPath) {
      if (!serverPath) {
        return NextResponse.json({ 
          error: 'Chưa cung cấp đường dẫn server',
          databases: [] 
        })
      }
      
      const dbFiles = findDatabaseFiles(serverPath)
      const databases: DatabaseInfo[] = []
      
      for (const dbFile of dbFiles) {
        try {
          const db = new Database(dbFile, { readonly: true })
          const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]
          
          const tableInfos: TableInfo[] = []
          for (const table of tables) {
            try {
              const countResult = db.prepare(`SELECT COUNT(*) as count FROM "${table.name}"`).get() as { count: number }
              tableInfos.push({ name: table.name, rowCount: countResult.count })
            } catch {
              tableInfos.push({ name: table.name, rowCount: 0 })
            }
          }
          
          db.close()
          databases.push({ path: dbFile, tables: tableInfos })
        } catch (error: any) {
          databases.push({ path: dbFile, tables: [], error: error.message })
        }
      }
      
      return NextResponse.json({ databases })
    }

    // If db path provided, query specific table
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: `File không tồn tại: ${dbPath}` }, { status: 404 })
    }

    const db = new Database(dbPath, { readonly: true })

    if (!tableName) {
      // List tables in this database
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]
      
      const tableInfos: TableInfo[] = []
      for (const table of tables) {
        try {
          const countResult = db.prepare(`SELECT COUNT(*) as count FROM "${table.name}"`).get() as { count: number }
          tableInfos.push({ name: table.name, rowCount: countResult.count })
        } catch {
          tableInfos.push({ name: table.name, rowCount: 0 })
        }
      }
      
      db.close()
      return NextResponse.json({ tables: tableInfos })
    }

    // Query specific table
    // Get table schema
    const schemaInfo = db.prepare(`PRAGMA table_info("${tableName}")`).all() as { 
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: any
      pk: number
    }[]

    // Get total count
    const totalResult = db.prepare(`SELECT COUNT(*) as total FROM "${tableName}"`).get() as { total: number }
    
    // Get data with pagination
    const data = db.prepare(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`).all(limit, offset)
    
    db.close()

    return NextResponse.json({
      table: tableName,
      schema: schemaInfo,
      total: totalResult.total,
      limit,
      offset,
      data,
    })

  } catch (error: any) {
    console.error('Database error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Execute operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, dbPath, tableName } = body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Database path not found' }, { status: 404 })
    }

    // Handle File Deletion (No need to open DB)
    if (action === 'delete_db') {
        try {
            // Check if file seems locked (simple check via append mode opening attempt, or just try delete)
            // Note: If PZ server is running, this will likely fail with EBUSY
            fs.unlinkSync(dbPath)
            return NextResponse.json({ success: true, message: `Deleted database file` })
        } catch (err: any) {
            console.error('Delete error:', err)
            if (err.code === 'EBUSY' || err.code === 'EPERM') {
                return NextResponse.json({ error: 'File đang bị khóa. Hãy TẮT SERVER trước khi xóa!' }, { status: 409 })
            }
            return NextResponse.json({ error: `Failed to delete file: ${err.message}` }, { status: 500 })
        }
    }

    // Only open DB for table operations
    const db = new Database(dbPath)

    if (action === 'drop_table') {
        if (!tableName) {
            db.close()
            return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
        }
        
        try {
            const stmt = db.prepare(`DROP TABLE IF EXISTS "${tableName}"`)
            stmt.run()
            db.close()
            return NextResponse.json({ success: true, message: `Dropped table ${tableName}` })
        } catch (err: any) {
            db.close()
            throw err
        }
    }

    db.close()
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Database write error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
