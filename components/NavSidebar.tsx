'use client'

import { useState } from 'react'

interface NavItem {
    id: string
    label: string
    icon: string
    badge?: number
}

interface NavSidebarProps {
    activeItem: string
    onItemClick: (id: string) => void
    serverStatus?: 'online' | 'offline' | 'unknown'
}

export default function NavSidebar({ activeItem, onItemClick, serverStatus = 'unknown' }: NavSidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false)

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Tổng quan', icon: 'lni-dashboard' },
        { id: 'settings', label: 'Cài đặt Server', icon: 'lni-cog' },
        { id: 'mods', label: 'Quản lý Mod', icon: 'lni-package' },
        // { id: 'database', label: 'Database', icon: 'lni-database' },
    ]

    const statusColors = {
        online: 'bg-green-500',
        offline: 'bg-red-500',
        unknown: 'bg-yellow-500',
    }

    const statusLabels = {
        online: 'Đang chạy',
        offline: 'Tắt',
        unknown: 'Không rõ',
    }

    return (
        <aside
            className={`
        h-screen fixed left-0 top-0 z-40
        bg-zinc-900 border-r border-zinc-700
        flex flex-col
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
        >
            {/* Header */}
            <div className="p-4 border-b border-zinc-700">
                <div className="flex items-center justify-between">
                    {!isCollapsed && (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden">
                                <img
                                    src="/assets/logo.gif"
                                    alt="Logo"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        // Fallback to icon if image fails
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement!.innerHTML = '<i class="lni lni-skull text-xl text-white"></i>';
                                    }}
                                />
                            </div>
                            <div>
                                <h1 className="text-white font-semibold text-sm">PZ Manager</h1>
                                <p className="text-zinc-400 text-xs">Quản lý Server</p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-2 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-white"
                    >
                        <i className={`lni ${isCollapsed ? 'lni-chevron-right' : 'lni-chevron-left'}`}></i>
                    </button>
                </div>
            </div>

            {/* Server Status */}
            <div className={`p-4 border-b border-zinc-700 ${isCollapsed ? 'px-2' : ''}`}>
                <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className={`w-3 h-3 rounded-full ${statusColors[serverStatus]} animate-pulse`}></div>
                    {!isCollapsed && (
                        <div>
                            <p className="text-zinc-400 text-xs">Trạng thái Server</p>
                            <p className="text-white text-sm font-medium">{statusLabels[serverStatus]}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onItemClick(item.id)}
                        className={`
              w-full flex items-center gap-3 px-3 py-3 rounded-xl
              transition-all duration-200
              ${isCollapsed ? 'justify-center' : ''}
              ${activeItem === item.id
                                ? 'bg-white/10 text-white border-l-4 border-white'
                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white border-l-4 border-transparent'
                            }
            `}
                        title={isCollapsed ? item.label : undefined}
                    >
                        <i className={`lni ${item.icon} text-lg`}></i>
                        {!isCollapsed && (
                            <>
                                <span className="flex-1 text-left text-sm">{item.label}</span>
                                {item.badge !== undefined && (
                                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                                        {item.badge}
                                    </span>
                                )}
                            </>
                        )}
                    </button>
                ))}
            </nav>

            {/* Footer */}
            <div className={`p-4 border-t border-zinc-700 ${isCollapsed ? 'px-2' : ''}`}>
                {!isCollapsed ? (
                    <div className="text-zinc-500 text-xs text-center space-y-1">
                        <p>PZ Mod Manager v1.0</p>
                        <p className="text-zinc-600">@2025 <span className="text-zinc-400">bủ</span></p>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <i className="lni lni-information text-zinc-500"></i>
                    </div>
                )}
            </div>
        </aside>
    )
}
