import { NextRequest, NextResponse } from 'next/server'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

// Store server process and output
let serverProcess: ChildProcess | null = null
let serverOutput: string[] = []
const MAX_OUTPUT_LINES = 500

function log(message: string, data?: any) {
    const timestamp = new Date().toISOString()
    console.log(`[SERVER-CONTROL ${timestamp}] ${message}`, data !== undefined ? data : '')
}

function addOutput(line: string) {
    const timestamp = new Date().toLocaleTimeString('vi-VN')
    serverOutput.push(`[${timestamp}] ${line}`)
    if (serverOutput.length > MAX_OUTPUT_LINES) {
        serverOutput = serverOutput.slice(-MAX_OUTPUT_LINES)
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, serverPath } = body

        log(`Action: ${action}`, { serverPath })

        if (action === 'start') {
            if (!serverPath) {
                return NextResponse.json({
                    success: false,
                    error: 'Chưa cấu hình đường dẫn server'
                }, { status: 400 })
            }

            // Find StartServer64.bat
            const possiblePaths = [
                path.join(serverPath, 'StartServer64.bat'),
                serverPath.endsWith('.bat') ? serverPath : null,
            ].filter(Boolean) as string[]

            let batPath: string | null = null
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    batPath = p
                    break
                }
            }

            if (!batPath) {
                return NextResponse.json({
                    success: false,
                    error: `Không tìm thấy StartServer64.bat tại ${serverPath}`
                }, { status: 400 })
            }

            // Check if server is already running
            if (serverProcess && !serverProcess.killed) {
                return NextResponse.json({
                    success: false,
                    error: 'Server đang chạy. Dừng server trước khi khởi động lại.'
                }, { status: 400 })
            }

            log(`Starting server from: ${batPath}`)

            // Clear previous output
            serverOutput = []
            addOutput('=== Đang khởi động Project Zomboid Server ===')
            addOutput(`Đường dẫn: ${batPath}`)

            // Get the directory containing the bat file
            const batDir = path.dirname(batPath)

            // Start the server and capture output
            serverProcess = spawn('cmd.exe', ['/c', batPath], {
                cwd: batDir,
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: false,
            })

            // Capture stdout
            serverProcess.stdout?.on('data', (data: Buffer) => {
                const lines = data.toString().split('\n').filter(l => l.trim())
                lines.forEach(line => addOutput(line))
            })

            // Capture stderr
            serverProcess.stderr?.on('data', (data: Buffer) => {
                const lines = data.toString().split('\n').filter(l => l.trim())
                lines.forEach(line => addOutput(`[ERROR] ${line}`))
            })

            serverProcess.on('close', (code) => {
                addOutput(`=== Server đã dừng (exit code: ${code}) ===`)
                serverProcess = null
            })

            serverProcess.on('error', (err) => {
                addOutput(`[ERROR] ${err.message}`)
                serverProcess = null
            })

            log('Server process started with PID:', serverProcess.pid)

            return NextResponse.json({
                success: true,
                message: 'Đã khởi động server',
                pid: serverProcess.pid,
                batPath,
            })
        }

        if (action === 'stop') {
            if (!serverProcess || serverProcess.killed) {
                return NextResponse.json({
                    success: false,
                    error: 'Server không đang chạy'
                }, { status: 400 })
            }

            addOutput('=== Đang dừng server... ===')
            serverProcess.kill('SIGTERM')

            // Force kill after 5 seconds if not stopped
            setTimeout(() => {
                if (serverProcess && !serverProcess.killed) {
                    serverProcess.kill('SIGKILL')
                    addOutput('=== Server đã bị buộc dừng ===')
                }
            }, 5000)

            return NextResponse.json({
                success: true,
                message: 'Đang dừng server...'
            })
        }

        if (action === 'status') {
            return NextResponse.json({
                success: true,
                running: serverProcess !== null && !serverProcess.killed,
                pid: serverProcess?.pid,
            })
        }

        if (action === 'logs') {
            return NextResponse.json({
                success: true,
                logs: serverOutput,
                running: serverProcess !== null && !serverProcess.killed,
            })
        }

        return NextResponse.json({
            success: false,
            error: 'Action không hợp lệ'
        }, { status: 400 })

    } catch (error: any) {
        log('Error:', error.message)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

// GET endpoint for polling logs
export async function GET() {
    return NextResponse.json({
        success: true,
        logs: serverOutput,
        running: serverProcess !== null && !serverProcess.killed,
        pid: serverProcess?.pid,
    })
}
