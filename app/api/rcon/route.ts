import { NextRequest, NextResponse } from 'next/server'
import { ZomboidRconClient } from 'zomboid-rcon-js'

function log(message: string, data?: any) {
    const timestamp = new Date().toISOString()
    console.log(`[RCON ${timestamp}] ${message}`, data !== undefined ? data : '')
}

// GET - Check connection status and get players
export async function GET(request: NextRequest) {
    const startTime = Date.now()
    log('=== GET /api/rcon - Check Status ===')

    const { searchParams } = new URL(request.url)
    const host = searchParams.get('host') || '127.0.0.1'
    const port = parseInt(searchParams.get('port') || '27015')
    const password = searchParams.get('password') || ''

    log('Request params:', { host, port, hasPassword: !!password })

    if (!password) {
        return NextResponse.json({
            status: 'offline',
            error: 'Chưa cấu hình mật khẩu RCON',
        })
    }

    let client: ZomboidRconClient | null = null

    try {
        log('Creating ZomboidRconClient...')
        client = new ZomboidRconClient({
            host,
            port,
            password,
            timeout: 5000, // 5 second timeout
        })

        log('Connecting...')
        await client.connect()

        const connectTime = Date.now() - startTime
        log(`Connected in ${connectTime}ms, fetching players...`)

        const players = await client.onlinePlayers()

        const elapsed = Date.now() - startTime
        log(`Request completed in ${elapsed}ms - Online, ${players.length} players`)

        return NextResponse.json({
            status: 'online',
            players: players.length,
            playerList: players,
            message: 'Đã kết nối với server',
            responseTime: elapsed,
        })
    } catch (error: any) {
        const elapsed = Date.now() - startTime
        log(`Request failed after ${elapsed}ms:`, error.message)

        return NextResponse.json({
            status: 'offline',
            error: error.message || 'Kết nối thất bại',
            responseTime: elapsed,
        })
    } finally {
        // Always disconnect
        if (client) {
            try {
                log('Disconnecting...')
                await client.disconnect()
                log('Disconnected')
            } catch (e: any) {
                log('Disconnect error (ignored):', e.message)
            }
        }
    }
}

// POST - Execute RCON command
export async function POST(request: NextRequest) {
    const startTime = Date.now()
    log('=== POST /api/rcon - Execute Command ===')

    let client: ZomboidRconClient | null = null

    try {
        const body = await request.json()
        const { host = '127.0.0.1', port = 27015, password, command } = body

        log('Command:', command)

        if (!password) {
            return NextResponse.json({ error: 'Chưa cấu hình mật khẩu RCON' }, { status: 400 })
        }

        if (!command) {
            return NextResponse.json({ error: 'Chưa nhập lệnh' }, { status: 400 })
        }

        log('Creating ZomboidRconClient...')
        client = new ZomboidRconClient({
            host,
            port,
            password,
            timeout: 5000,
        })

        log('Connecting...')
        await client.connect()

        const connectTime = Date.now() - startTime
        log(`Connected in ${connectTime}ms, executing command...`)

        // Execute command based on type
        let response = ''
        const cmd = command.toLowerCase().trim()

        if (cmd === 'players') {
            const players = await client.onlinePlayers()
            response = `Players connected (${players.length}): ${players.join(', ')}`
        } else if (cmd === 'save') {
            response = await client.save()
        } else if (cmd.startsWith('servermsg ')) {
            const msg = command.substring(10).replace(/^["']|["']$/g, '')
            response = await client.serverMessage(msg)
        } else {
            // For other commands, use the underlying client directly
            response = await client.client.send(command)
        }

        const elapsed = Date.now() - startTime
        log(`Command executed in ${elapsed}ms, response:`, response)

        return NextResponse.json({
            success: true,
            response: response || 'Đã thực hiện lệnh',
            responseTime: elapsed,
        })
    } catch (error: any) {
        const elapsed = Date.now() - startTime
        log(`Command failed after ${elapsed}ms:`, error.message)

        return NextResponse.json({
            success: false,
            error: error.message || 'Lệnh thất bại',
            responseTime: elapsed,
        }, { status: 500 })
    } finally {
        if (client) {
            try {
                log('Disconnecting...')
                await client.disconnect()
                log('Disconnected')
            } catch (e: any) {
                log('Disconnect error (ignored):', e.message)
            }
        }
    }
}
