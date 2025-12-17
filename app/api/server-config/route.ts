import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface ServerConfig {
    maxMemory: string | null  // e.g., "6G", "4096M"
    maxMemoryMB: number | null
    minMemory: string | null
    minMemoryMB: number | null
    batFilePath: string | null
    error?: string
}

// Parse memory string like "6G" or "4096M" to MB
function parseMemoryToMB(memStr: string): number {
    const num = parseFloat(memStr)
    if (memStr.toUpperCase().endsWith('G')) {
        return num * 1024
    } else if (memStr.toUpperCase().endsWith('M')) {
        return num
    } else if (memStr.toUpperCase().endsWith('K')) {
        return num / 1024
    }
    return num // Assume MB if no suffix
}

// Find and read StartServer64.bat to get memory settings
function findBatFile(serverPath: string): string | null {
    // Common locations to search
    const possiblePaths = [
        path.join(serverPath, 'StartServer64.bat'),
        path.join(serverPath, '..', 'StartServer64.bat'),
        path.join(serverPath, '..', '..', 'StartServer64.bat'),
        path.join(serverPath, '..', '..', '..', 'StartServer64.bat'),
        // Project Zomboid Dedicated Server typical path
        path.dirname(serverPath).includes('Zomboid')
            ? path.join(path.dirname(serverPath), '..', '..', 'steamapps', 'common', 'Project Zomboid Dedicated Server', 'StartServer64.bat')
            : null,
    ].filter(Boolean) as string[]

    for (const batPath of possiblePaths) {
        try {
            const normalizedPath = path.normalize(batPath)
            if (fs.existsSync(normalizedPath)) {
                return normalizedPath
            }
        } catch {
            // Continue to next path
        }
    }

    return null
}

// Extract memory settings from bat file content
function extractMemorySettings(content: string): { maxMemory: string | null, minMemory: string | null } {
    let maxMemory: string | null = null
    let minMemory: string | null = null

    // Look for -Xmx parameter (max heap)
    const xmxMatch = content.match(/-Xmx(\d+[GgMmKk]?)/i)
    if (xmxMatch) {
        maxMemory = xmxMatch[1]
    }

    // Look for -Xms parameter (min heap)
    const xmsMatch = content.match(/-Xms(\d+[GgMmKk]?)/i)
    if (xmsMatch) {
        minMemory = xmsMatch[1]
    }

    return { maxMemory, minMemory }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const serverPath = searchParams.get('serverPath') || ''

        if (!serverPath) {
            return NextResponse.json({
                maxMemory: null,
                maxMemoryMB: null,
                minMemory: null,
                minMemoryMB: null,
                batFilePath: null,
                error: 'Chưa cung cấp đường dẫn server'
            })
        }

        // Find the bat file
        const batPath = findBatFile(serverPath)

        if (!batPath) {
            return NextResponse.json({
                maxMemory: null,
                maxMemoryMB: null,
                minMemory: null,
                minMemoryMB: null,
                batFilePath: null,
                error: 'Không tìm thấy file StartServer64.bat'
            })
        }

        // Read the bat file
        const content = fs.readFileSync(batPath, 'utf8')
        const { maxMemory, minMemory } = extractMemorySettings(content)

        const config: ServerConfig = {
            maxMemory,
            maxMemoryMB: maxMemory ? parseMemoryToMB(maxMemory) : null,
            minMemory,
            minMemoryMB: minMemory ? parseMemoryToMB(minMemory) : null,
            batFilePath: batPath,
        }

        return NextResponse.json(config)
    } catch (error: any) {
        console.error('Error reading server config:', error)
        return NextResponse.json({
            maxMemory: null,
            maxMemoryMB: null,
            minMemory: null,
            minMemoryMB: null,
            batFilePath: null,
            error: error.message
        }, { status: 500 })
    }
}
