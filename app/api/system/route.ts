import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const execAsync = promisify(exec)

interface ProcessStats {
    found: boolean
    processName: string
    pid?: number
    cpuPercent?: number
    memoryMB?: number
    memoryPercent?: number
    commandLine?: string
}

interface SystemStats {
    cpu: {
        cores: number
        model: string
        usage: number
    }
    memory: {
        total: number
        used: number
        free: number
        usagePercent: number
    }
    uptime: number
    platform: string
    hostname: string
    pzServer?: ProcessStats
}

// Get CPU usage of the system
function getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
        const cpus1 = os.cpus()

        setTimeout(() => {
            const cpus2 = os.cpus()
            let totalIdle = 0
            let totalTick = 0

            for (let i = 0; i < cpus1.length; i++) {
                const cpu1 = cpus1[i]
                const cpu2 = cpus2[i]

                const idle1 = cpu1.times.idle
                const idle2 = cpu2.times.idle

                const total1 = cpu1.times.user + cpu1.times.nice + cpu1.times.sys + cpu1.times.idle + cpu1.times.irq
                const total2 = cpu2.times.user + cpu2.times.nice + cpu2.times.sys + cpu2.times.idle + cpu2.times.irq

                totalIdle += idle2 - idle1
                totalTick += total2 - total1
            }

            const usage = totalTick > 0 ? 100 - (totalIdle / totalTick * 100) : 0
            resolve(Math.round(usage * 10) / 10)
        }, 100)
    })
}

// Find PZ server process (Java process running PZ)
async function findPZServerProcess(): Promise<ProcessStats> {
    const platform = os.platform()

    try {
        if (platform === 'win32') {
            // Windows: Use WMIC to find Java processes with PZ-related command lines
            const { stdout } = await execAsync(
                'wmic process where "name like \'%java%\'" get ProcessId,WorkingSetSize,CommandLine /format:csv',
                { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
            )

            const lines = stdout.trim().split('\n').filter(line => line.trim())

            for (const line of lines) {
                const parts = line.split(',')
                if (parts.length >= 4) {
                    const commandLine = parts.slice(1, -2).join(',').toLowerCase()

                    // Check if this is a PZ server process
                    if (commandLine.includes('zomboid') ||
                        commandLine.includes('projectzomboid') ||
                        commandLine.includes('pzserver') ||
                        commandLine.includes('zombie.network.gameserver')) {

                        const pid = parseInt(parts[parts.length - 1])
                        const memoryBytes = parseInt(parts[parts.length - 2]) || 0
                        const memoryMB = Math.round(memoryBytes / (1024 * 1024))
                        const totalMemMB = os.totalmem() / (1024 * 1024)
                        const memoryPercent = Math.round((memoryMB / totalMemMB) * 100 * 10) / 10

                        return {
                            found: true,
                            processName: 'java.exe (PZ Server)',
                            pid,
                            memoryMB,
                            memoryPercent,
                            commandLine: parts.slice(1, -2).join(',').substring(0, 100) + '...',
                        }
                    }
                }
            }

            // Fallback: Look for any Java process with significant memory usage
            const { stdout: fallbackStdout } = await execAsync(
                'wmic process where "name like \'%java%\'" get ProcessId,WorkingSetSize,Name /format:csv',
                { encoding: 'utf8' }
            )

            const fallbackLines = fallbackStdout.trim().split('\n').filter(line => line.trim() && !line.includes('Node'))
            let largestJavaProcess: ProcessStats | null = null
            let maxMemory = 0

            for (const line of fallbackLines) {
                const parts = line.split(',')
                if (parts.length >= 4) {
                    const name = parts[1]
                    const memoryBytes = parseInt(parts[3]) || 0
                    const pid = parseInt(parts[2])

                    if (name && name.toLowerCase().includes('java') && memoryBytes > maxMemory) {
                        maxMemory = memoryBytes
                        const memoryMB = Math.round(memoryBytes / (1024 * 1024))
                        const totalMemMB = os.totalmem() / (1024 * 1024)
                        const memoryPercent = Math.round((memoryMB / totalMemMB) * 100 * 10) / 10

                        largestJavaProcess = {
                            found: true,
                            processName: 'java.exe (có thể là PZ Server)',
                            pid,
                            memoryMB,
                            memoryPercent,
                        }
                    }
                }
            }

            if (largestJavaProcess && maxMemory > 500 * 1024 * 1024) { // At least 500MB
                return largestJavaProcess
            }
        } else {
            // Linux: Use ps command
            const { stdout } = await execAsync(
                'ps aux | grep -i "zomboid\\|pzserver" | grep -v grep | head -1',
                { encoding: 'utf8' }
            )

            if (stdout.trim()) {
                const parts = stdout.trim().split(/\s+/)
                const pid = parseInt(parts[1])
                const cpuPercent = parseFloat(parts[2])
                const memoryPercent = parseFloat(parts[3])

                return {
                    found: true,
                    processName: 'PZ Server',
                    pid,
                    cpuPercent,
                    memoryPercent,
                }
            }
        }
    } catch (error) {
        console.error('Error finding PZ process:', error)
    }

    return {
        found: false,
        processName: 'Không tìm thấy process PZ Server',
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const includePZ = searchParams.get('pz') !== 'false'

        const cpuUsage = await getCpuUsage()
        const cpus = os.cpus()
        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const usedMem = totalMem - freeMem

        const stats: SystemStats = {
            cpu: {
                cores: cpus.length,
                model: cpus[0]?.model || 'Unknown',
                usage: cpuUsage,
            },
            memory: {
                total: totalMem,
                used: usedMem,
                free: freeMem,
                usagePercent: Math.round((usedMem / totalMem) * 100 * 10) / 10,
            },
            uptime: os.uptime(),
            platform: os.platform(),
            hostname: os.hostname(),
        }

        // Find PZ server process if requested
        if (includePZ) {
            stats.pzServer = await findPZServerProcess()
        }

        return NextResponse.json(stats)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
