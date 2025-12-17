'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'

interface TableInfo {
    name: string
    rowCount: number
}

interface DatabaseInfo {
    path: string
    tables: TableInfo[]
    error?: string
}

interface ColumnSchema {
    cid: number
    name: string
    type: string
    notnull: number
    dflt_value: any
    pk: number
}

interface TableData {
    table: string
    schema: ColumnSchema[]
    total: number
    limit: number
    offset: number
    data: Record<string, any>[]
}

interface DatabaseViewerProps {
    serverPath: string
}

export default function DatabaseViewer({ serverPath }: DatabaseViewerProps) {
    const [databases, setDatabases] = useState<DatabaseInfo[]>([])
    const [selectedDb, setSelectedDb] = useState<string>('')
    const [selectedTable, setSelectedTable] = useState<string>('')
    const [tableData, setTableData] = useState<TableData | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [page, setPage] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const pageSize = 50

    // Load databases on mount or serverPath change
    useEffect(() => {
        if (serverPath) {
            loadDatabases()
        }
    }, [serverPath])

    const loadDatabases = async () => {
        setLoading(true)
        setError('')
        try {
            const response = await axios.get('/api/database', {
                params: { serverPath }
            })
            setDatabases(response.data.databases || [])
        } catch (err: any) {
            setError(err.response?.data?.error || err.message)
        } finally {
            setLoading(false)
        }
    }

    const loadTableData = async (dbPath: string, tableName: string, offset = 0) => {
        setLoading(true)
        setError('')
        try {
            const response = await axios.get('/api/database', {
                params: {
                    dbPath,
                    table: tableName,
                    limit: pageSize,
                    offset
                }
            })
            setTableData(response.data)
            setPage(offset / pageSize)
        } catch (err: any) {
            setError(err.response?.data?.error || err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSelectTable = (dbPath: string, tableName: string) => {
        setSelectedDb(dbPath)
        setSelectedTable(tableName)
        setPage(0)
        loadTableData(dbPath, tableName, 0)
    }

    const handlePageChange = (newPage: number) => {
        loadTableData(selectedDb, selectedTable, newPage * pageSize)
    }

    const handleDeleteTable = async (dbPath: string, tableName: string) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa bảng "${tableName}" không? Hành động này không thể hoàn tác!`)) {
            return
        }

        setLoading(true)
        try {
            await axios.post('/api/database', {
                action: 'drop_table',
                dbPath,
                tableName
            })
            // Reload databases to refresh table list
            loadDatabases()
            // Clear current view if deleted table was selected
            if (selectedTable === tableName) {
                setTableData(null)
                setSelectedTable('')
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteDb = async (dbPath: string) => {
        const dbName = dbPath.split(/[/\\]/).pop()
        if (!confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ file database "${dbName}" không?\n\nĐường dẫn: ${dbPath}\n\nViệc này sẽ xóa vĩnh viễn file này và máy chủ sẽ tạo lại file mới khi khởi động. Hành động này KHÔNG THỂ hoàn tác!`)) {
            return
        }

        setLoading(true)
        try {
            await axios.post('/api/database', {
                action: 'delete_db',
                dbPath
            })
            // Reload databases to refresh list
            loadDatabases()
            // Clear current view if deleted db was selected
            if (selectedDb === dbPath) {
                setTableData(null)
                setSelectedTable('')
                setSelectedDb('')
            }
            setError('') // Clear previous errors
        } catch (err: any) {
            setError(err.response?.data?.error || err.message)
        } finally {
            setLoading(false)
        }
    }

    const filteredData = tableData?.data?.filter(row => {
        if (!searchQuery) return true
        return Object.values(row).some(val => 
            String(val).toLowerCase().includes(searchQuery.toLowerCase())
        )
    }) || []

    const totalPages = tableData ? Math.ceil(tableData.total / pageSize) : 0

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-white">Database Viewer</h2>
                    <p className="text-zinc-400 text-sm mt-1">Xem và quản lý SQLite database của server</p>
                </div>
                <button
                    onClick={loadDatabases}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl text-sm flex items-center gap-2"
                    disabled={loading}
                >
                    <i className={`lni lni-reload ${loading ? 'animate-spin' : ''}`}></i>
                    Làm mới
                </button>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl">
                    <i className="lni lni-warning mr-2"></i>
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Database & Table List */}
                <div className="lg:col-span-1 bg-zinc-800 border border-zinc-700 rounded-xl p-4">
                    <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                        <i className="lni lni-database"></i>
                        Databases
                    </h3>
                    
                    {databases.length === 0 ? (
                        <div className="text-zinc-500 text-sm text-center py-8">
                            {loading ? 'Đang tải...' : 'Không tìm thấy database. Kiểm tra đường dẫn server.'}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {databases.map((db, idx) => {
                                const filename = db.path.split(/[/\\]/).pop()
                                const parentDir = db.path.split(/[/\\]/).slice(-2, -1)[0]
                                
                                return (
                                <div key={idx} className="space-y-1">
                                    <div className="flex items-center justify-between group/db">
                                        <div className="text-xs text-zinc-400 font-mono flex-1 flex flex-col" title={db.path}>
                                            <span className="text-zinc-300 font-medium truncate">
                                                <i className="lni lni-database mr-2"></i>
                                                {filename}
                                            </span>
                                            <span className="text-zinc-500 text-[10px] ml-2 break-all opacity-70">
                                                {db.path}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteDb(db.path)
                                            }}
                                            className="ml-2 p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover/db:opacity-100 transition-all"
                                            title="Xóa toàn bộ file database này"
                                        >
                                            <i className="lni lni-trash-can"></i>
                                        </button>
                                    </div>
                                    {db.error ? (
                                        <div className="text-red-400 text-xs pl-4">{db.error}</div>
                                    ) : (
                                        <div className="pl-4 space-y-1">
                                            {db.tables.map((table) => (
                                                <div key={table.name} className="flex items-center gap-1 group">
                                                    <button
                                                        onClick={() => handleSelectTable(db.path, table.name)}
                                                        className={`flex-1 text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between
                                                            ${selectedDb === db.path && selectedTable === table.name 
                                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                                                                : 'hover:bg-zinc-700 text-zinc-300'
                                                            }`}
                                                    >
                                                        <span className="truncate">
                                                            <i className="lni lni-layers mr-2"></i>
                                                            {table.name}
                                                        </span>
                                                        <span className="text-xs text-zinc-500">
                                                            {table.rowCount}
                                                        </span>
                                                    </button>
                                                    
                                                    {['whitelist_new'].includes(table.name) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleDeleteTable(db.path, table.name)
                                                            }}
                                                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-100 transition-opacity"
                                                            title="Xóa bảng này"
                                                        >
                                                            <i className="lni lni-trash-can"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )})}

                        </div>
                    )}
                </div>

                {/* Table Data Viewer */}
                <div className="lg:col-span-3 bg-zinc-800 border border-zinc-700 rounded-xl p-4">
                    {!tableData ? (
                        <div className="text-zinc-500 text-center py-20">
                            <i className="lni lni-database text-4xl mb-4 block opacity-50"></i>
                            Chọn một bảng để xem dữ liệu
                        </div>
                    ) : (
                        <>
                            {/* Table Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-white font-medium flex items-center gap-2">
                                        <i className="lni lni-layers"></i>
                                        {tableData.table}
                                        <span className="text-xs text-zinc-500 font-normal">
                                            ({tableData.total} rows)
                                        </span>
                                    </h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Tìm kiếm..."
                                        className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg border border-zinc-600 focus:outline-none focus:border-zinc-500 text-sm w-48"
                                    />
                                </div>
                            </div>

                            {/* Data Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-zinc-900/50">
                                            {tableData.schema.map((col) => (
                                                <th 
                                                    key={col.name} 
                                                    className="px-3 py-2 text-left text-zinc-400 font-medium border-b border-zinc-700"
                                                >
                                                    <div className="flex flex-col">
                                                        <span>{col.name}</span>
                                                        <span className="text-xs text-zinc-600 font-normal">
                                                            {col.type}
                                                            {col.pk ? ' PK' : ''}
                                                        </span>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredData.map((row, rowIdx) => (
                                            <tr 
                                                key={rowIdx} 
                                                className="hover:bg-zinc-700/50 border-b border-zinc-700/50"
                                            >
                                                {tableData.schema.map((col) => (
                                                    <td 
                                                        key={col.name} 
                                                        className="px-3 py-2 text-zinc-300 font-mono text-xs max-w-xs truncate"
                                                        title={String(row[col.name] ?? '')}
                                                    >
                                                        {row[col.name] === null ? (
                                                            <span className="text-zinc-600 italic">NULL</span>
                                                        ) : (
                                                            String(row[col.name])
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-700">
                                    <div className="text-zinc-500 text-sm">
                                        Trang {page + 1} / {totalPages}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handlePageChange(page - 1)}
                                            disabled={page === 0 || loading}
                                            className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <i className="lni lni-chevron-left"></i>
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(page + 1)}
                                            disabled={page >= totalPages - 1 || loading}
                                            className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <i className="lni lni-chevron-right"></i>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Schema Info */}
            {tableData && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                        <i className="lni lni-code"></i>
                        Schema: {tableData.table}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {tableData.schema.map((col) => (
                            <div 
                                key={col.name} 
                                className={`px-3 py-2 rounded-lg text-xs ${
                                    col.pk ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-zinc-700'
                                }`}
                            >
                                <div className="text-white font-medium">{col.name}</div>
                                <div className="text-zinc-400">{col.type}</div>
                                {col.pk ? <div className="text-yellow-400">Primary Key</div> : null}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
