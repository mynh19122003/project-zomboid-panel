'use client'

import { useState } from 'react'
import axios from 'axios'
import { SteamWorkshopItem } from '@/types'
import { formatFileSize, formatDate } from '@/lib/utils'

interface SteamWorkshopSearchProps {
  serverPath: string
}

export default function SteamWorkshopSearch({ serverPath }: SteamWorkshopSearchProps) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SteamWorkshopItem[]>([])
  const [addingMod, setAddingMod] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const searchMods = async () => {
    if (!query.trim()) return

    setSearching(true)
    try {
      const response = await axios.get('/api/steam-workshop', {
        params: {
          action: 'search',
          query: query.trim(),
        },
      })

      // Parse response từ Steam API
      if (response.data.success && response.data.response?.publishedfiledetails) {
        setResults(response.data.response.publishedfiledetails)
      } else if (response.data.response?.publishedfiledetails) {
        // Fallback cho cấu trúc response khác
        setResults(response.data.response.publishedfiledetails)
      } else {
        setResults([])
        setMessage({ type: 'error', text: 'Không tìm thấy kết quả. Vui lòng kiểm tra Steam API key.' })
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Lỗi khi tìm kiếm mod',
      })
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const addModToServer = async (workshopId: string, modName: string) => {
    if (!serverPath) {
      setMessage({ type: 'error', text: 'Vui lòng nhập đường dẫn server' })
      return
    }

    setAddingMod(workshopId)
    try {
      // Lấy danh sách mod hiện tại
      const modsResponse = await axios.get('/api/mods', {
        params: { serverPath },
      })
      const currentMods = modsResponse.data.mods || []

      // Kiểm tra xem mod đã tồn tại chưa
      if (currentMods.some((m: any) => m.workshopId === workshopId || m.id === workshopId)) {
        setMessage({ type: 'error', text: 'Mod này đã có trong danh sách' })
        return
      }

      // Thêm mod mới
      const newMods = [
        ...currentMods,
        {
          id: workshopId,
          name: modName,
          workshopId: workshopId,
        },
      ]

      // Lưu mod list
      await axios.post('/api/mods', {
        serverPath,
        mods: newMods,
      })

      setMessage({ type: 'success', text: `Đã thêm mod "${modName}" thành công!` })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Không thể thêm mod',
      })
    } finally {
      setAddingMod(null)
    }
  }

  return (
    <div>
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-900/50 text-green-300 border border-green-700'
              : 'bg-red-900/50 text-red-300 border border-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchMods()}
            placeholder="Tìm kiếm mod trên Steam Workshop..."
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={searchMods}
            disabled={searching || !query.trim()}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {searching ? 'Đang tìm...' : 'Tìm kiếm'}
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          Tìm kiếm mod cho Project Zomboid trên Steam Workshop
        </p>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">
            Kết quả tìm kiếm ({results.length})
          </h3>
          {results.map((item) => (
            <div
              key={item.publishedfileid}
              className="p-4 bg-gray-700 rounded-lg hover:bg-gray-650 transition-colors"
            >
              <div className="flex gap-4">
                {item.preview_url && (
                  <img
                    src={item.preview_url}
                    alt={item.title}
                    className="w-32 h-20 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h4 className="text-white font-semibold mb-2">{item.title}</h4>
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                    {item.description?.substring(0, 200)}...
                  </p>
                  <div className="flex gap-4 text-xs text-gray-500">
                    {item.file_size && (
                      <span>Kích thước: {formatFileSize(item.file_size)}</span>
                    )}
                    {item.time_updated && (
                      <span>Cập nhật: {formatDate(item.time_updated)}</span>
                    )}
                    {item.subscriptions && (
                      <span>Subscriptions: {item.subscriptions.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => addModToServer(item.publishedfileid, item.title)}
                      disabled={addingMod === item.publishedfileid || !serverPath}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
                    >
                      {addingMod === item.publishedfileid
                        ? 'Đang thêm...'
                        : '+ Thêm vào Server'}
                    </button>
                    <a
                      href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.publishedfileid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm inline-block"
                    >
                      Xem trên Steam
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!searching && results.length === 0 && query && (
        <div className="text-center py-12 text-gray-400">
          Không tìm thấy kết quả nào. Thử tìm kiếm với từ khóa khác.
        </div>
      )}
    </div>
  )
}

