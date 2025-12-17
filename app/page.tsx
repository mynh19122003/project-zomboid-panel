'use client'

import { useState, useEffect } from 'react'
import ServerSettings from '@/components/ServerSettings'
import ModManager from '@/components/ModManager'
import NavSidebar from '@/components/NavSidebar'
import Dashboard from '@/components/Dashboard'
import Toast, { getStoredToast, StoredToast } from '@/components/Toast'
import DatabaseViewer from '@/components/DatabaseViewer'

export default function Home() {
  const [activeNav, setActiveNav] = useState<'dashboard' | 'settings' | 'mods' | 'database'>('dashboard')
  const [serverPath, setServerPath] = useState<string>('')
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'unknown'>('unknown')
  const [toast, setToast] = useState<StoredToast | null>(null)

  useEffect(() => {
    const savedPath = localStorage.getItem('zomboidServerPath')
    if (savedPath) {
      setServerPath(savedPath)
    }

    const storedToast = getStoredToast()
    if (storedToast) {
      setToast(storedToast)
    }
  }, [])

  const handlePathChange = (path: string) => {
    setServerPath(path)
    localStorage.setItem('zomboidServerPath', path)
  }

  const handleStatusChange = (status: 'online' | 'offline' | 'checking') => {
    setServerStatus(status === 'checking' ? 'unknown' : status)
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Sidebar */}
      <NavSidebar
        activeItem={activeNav}
        onItemClick={(id) => setActiveNav(id as 'dashboard' | 'settings' | 'mods' | 'database')}
        serverStatus={serverStatus}
      />

      {/* Main Content */}
      <main className="ml-64 min-h-screen transition-all duration-300">
        <div className="p-6">
          {/* Server Path Configuration - Only show for settings/mods/database */}
          {activeNav !== 'dashboard' && (
            <div className="mb-6 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <i className="lni lni-folder absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"></i>
                    <input
                      type="text"
                      value={serverPath}
                      onChange={(e) => handlePathChange(e.target.value)}
                      placeholder="C:\Users\YourName\Zomboid\Server"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:outline-none focus:border-zinc-500 text-sm"
                    />
                  </div>
                  <input
                    type="file"
                    id="folderPicker"
                    {...({ webkitdirectory: '', directory: '' } as any)}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const files = e.target.files
                      if (files && files.length > 0) {
                        const path = prompt('Nhập đường dẫn thư mục server:', serverPath || '')
                        if (path) handlePathChange(path)
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      document.getElementById('folderPicker')?.click()
                    }}
                    className="px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl transition-colors flex items-center gap-2 text-sm"
                  >
                    <i className="lni lni-upload"></i>
                    Browse
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Page Content */}
          <div className="animate-fade-in">
            {activeNav === 'dashboard' && (
              <Dashboard 
                serverPath={serverPath} 
                onStatusChange={handleStatusChange}
              />
            )}
            {activeNav === 'settings' && <ServerSettings serverPath={serverPath} />}
            {activeNav === 'mods' && <ModManager serverPath={serverPath} />}
            {activeNav === 'database' && <DatabaseViewer serverPath={serverPath} />}
          </div>
        </div>
      </main>
    </div>
  )
}
