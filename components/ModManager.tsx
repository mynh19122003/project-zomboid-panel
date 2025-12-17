'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Mod } from '@/types'
import { formatFileSize, formatDate } from '@/lib/utils'
import { storeToastForReload } from './Toast'

interface ModManagerProps {
  serverPath: string
}

export default function ModManager({ serverPath }: ModManagerProps) {
  const [mods, setMods] = useState<Mod[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (serverPath) {
      loadMods()
    }
  }, [serverPath])

  const loadMods = async () => {
    if (!serverPath) return

    setLoading(true)
    setImageErrors(new Set()) // Reset image errors
    try {
      const response = await axios.get('/api/mods', {
        params: { serverPath },
      })
      const loadedMods = response.data.mods || []
      setMods(loadedMods)

      // Tự động load thông tin chi tiết cho các workshop mods
      await loadModDetails(loadedMods)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Không thể tải mod list' })
    } finally {
      setLoading(false)
    }
  }

  const loadModDetails = async (modsToLoad: Mod[]) => {
    // Lấy danh sách workshop IDs (chỉ lấy các ID là số)
    const workshopIds = modsToLoad
      .map(mod => mod.workshopId || (mod.id.match(/^\d+$/) ? mod.id : null))
      .filter((id): id is string => id !== null)

    if (workshopIds.length === 0) {
      console.log('Không có workshop mods để tải thông tin')
      return
    }

    console.log('Đang tải thông tin cho', workshopIds.length, 'workshop mods:', workshopIds)

    setLoadingDetails(true)
    try {
      const response = await axios.post('/api/mods/details', {
        modIds: workshopIds,
      })

      console.log('Response từ API:', response.data)

      const detailsMap = response.data.mods || {}

      if (Object.keys(detailsMap).length === 0) {
        console.warn('Không có thông tin mod nào được trả về từ Steam API')
        setMessage({
          type: 'error',
          text: 'Không thể tải thông tin mod từ Steam. Kiểm tra Steam API key và kết nối internet.'
        })
        setTimeout(() => setMessage(null), 5000)
      }

      // Cập nhật mods với thông tin chi tiết
      setMods(prevMods =>
        prevMods.map(mod => {
          const workshopId = mod.workshopId || (mod.id.match(/^\d+$/) ? mod.id : null)
          if (workshopId && detailsMap[workshopId]) {
            console.log('Cập nhật mod:', workshopId, detailsMap[workshopId])
            return {
              ...mod,
              details: detailsMap[workshopId],
              name: detailsMap[workshopId].title || mod.name,
            }
          }
          return mod
        })
      )
    } catch (error: any) {
      console.error('Failed to load mod details:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Lỗi không xác định'
      setMessage({
        type: 'error',
        text: `Không thể tải thông tin mod: ${errorMessage}`
      })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setLoadingDetails(false)
    }
  }

  const saveMods = async () => {
    if (!serverPath) {
      setMessage({ type: 'error', text: 'Vui lòng nhập đường dẫn server' })
      return
    }

    setSaving(true)
    try {
      await axios.post('/api/mods', {
        serverPath,
        mods,
      })

      // Lưu toast vào localStorage và reload trang
      storeToastForReload({
        message: `Đã lưu mod list thành công! (${mods.length} mods)`,
        type: 'success'
      })
      window.location.reload()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Không thể lưu mod list' })
    } finally {
      setSaving(false)
    }
  }

  const removeMod = (index: number) => {
    setMods((prev) => prev.filter((_, i) => i !== index))
  }

  const [showAddModDialog, setShowAddModDialog] = useState(false)
  const [addModInput, setAddModInput] = useState('')
  const [addModType, setAddModType] = useState<'id' | 'name' | 'link' | 'collection'>('id')
  const [searchingMod, setSearchingMod] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [collectionItems, setCollectionItems] = useState<any[]>([])
  const [loadingCollection, setLoadingCollection] = useState(false)
  const [selectedCollectionMods, setSelectedCollectionMods] = useState<Set<string>>(new Set())

  const parseWorkshopLink = async (link: string): Promise<string | null> => {
    try {
      const response = await axios.get('/api/steam-workshop/parse-link', {
        params: { link },
      })
      return response.data.workshopId || null
    } catch (error) {
      console.error('Parse link error:', error)
      return null
    }
  }

  const searchModByName = async (name: string) => {
    setSearchingMod(true)
    try {
      const response = await axios.get('/api/steam-workshop', {
        params: {
          action: 'search',
          query: name,
          sortBy: 'subscriptions', // Sắp xếp theo số subscriptions (phổ biến nhất)
          limit: 30, // Lấy 30 kết quả
        },
      })

      if (response.data.success && response.data.response?.publishedfiledetails) {
        // Kết quả đã được sắp xếp theo subscriptions từ API
        setSearchResults(response.data.response.publishedfiledetails)
        if (response.data.response.publishedfiledetails.length === 0) {
          setMessage({ type: 'error', text: 'Không tìm thấy mod nào với tên này' })
        }
      } else {
        setSearchResults([])
        setMessage({ type: 'error', text: 'Không tìm thấy mod nào với tên này' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Lỗi khi tìm kiếm mod' })
      setSearchResults([])
    } finally {
      setSearchingMod(false)
    }
  }

  const handleAddMod = async () => {
    if (!addModInput.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập thông tin mod' })
      return
    }

    let workshopId: string | null = null

    if (addModType === 'id') {
      // Nếu là số, đó là workshop ID
      if (/^\d+$/.test(addModInput.trim())) {
        workshopId = addModInput.trim()
      } else {
        setMessage({ type: 'error', text: 'Workshop ID phải là số' })
        return
      }
    } else if (addModType === 'link') {
      // Parse link để lấy workshop ID
      workshopId = await parseWorkshopLink(addModInput.trim())
      if (!workshopId) {
        setMessage({ type: 'error', text: 'Không thể lấy Workshop ID từ link. Vui lòng kiểm tra link.' })
        return
      }
    } else if (addModType === 'name') {
      // Tìm kiếm mod theo tên
      await searchModByName(addModInput.trim())
      return // Dialog sẽ hiển thị kết quả tìm kiếm
    } else if (addModType === 'collection') {
      // Load collection
      await loadCollection(addModInput.trim())
      return // Dialog sẽ hiển thị collection items
    }

    // Thêm mod với workshop ID
    if (workshopId) {
      // Kiểm tra xem mod đã tồn tại chưa
      if (mods.some(m => m.workshopId === workshopId || m.id === workshopId)) {
        setMessage({ type: 'error', text: 'Mod này đã có trong danh sách' })
        return
      }

      setMods((prev) => [
        ...prev,
        {
          id: workshopId,
          name: workshopId, // Tạm thời, sẽ được cập nhật khi load details
          workshopId: workshopId,
        },
      ])

      setMessage({ type: 'success', text: 'Đã thêm mod thành công!' })
      setTimeout(() => setMessage(null), 3000)
      setShowAddModDialog(false)
      setAddModInput('')

      // Tự động load details cho mod mới
      setTimeout(() => {
        loadModDetails([{ id: workshopId, name: workshopId, workshopId }])
      }, 500)
    }
  }

  const loadCollection = async (collectionLink: string) => {
    setLoadingCollection(true)
    try {
      const response = await axios.get('/api/steam-workshop/collection', {
        params: { link: collectionLink },
      })

      if (response.data.success && response.data.items) {
        setCollectionItems(response.data.items)
        // Reset selected mods
        setSelectedCollectionMods(new Set())
      } else {
        setMessage({ type: 'error', text: 'Không thể tải collection hoặc collection trống' })
        setCollectionItems([])
      }
    } catch (error: any) {
      console.error('Load collection error:', error)
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Lỗi khi tải collection. Vui lòng kiểm tra link.'
      })
      setCollectionItems([])
    } finally {
      setLoadingCollection(false)
    }
  }

  const handleSelectSearchResult = (mod: any) => {
    const workshopId = mod.publishedfileid
    if (mods.some(m => m.workshopId === workshopId || m.id === workshopId)) {
      setMessage({ type: 'error', text: 'Mod này đã có trong danh sách' })
      return
    }

    setMods((prev) => [
      ...prev,
      {
        id: workshopId,
        name: mod.title || workshopId,
        workshopId: workshopId,
        details: {
          id: workshopId,
          title: mod.title || workshopId,
          description: mod.description || '',
          preview_url: mod.preview_url || '',
          file_size: mod.file_size || 0,
          subscriptions: mod.subscriptions || 0,
        },
      },
    ])

    setMessage({ type: 'success', text: `Đã thêm mod: ${mod.title}` })
    setTimeout(() => setMessage(null), 3000)
    setShowAddModDialog(false)
    setAddModInput('')
    setSearchResults([])
  }

  const toggleCollectionMod = (modId: string) => {
    setSelectedCollectionMods(prev => {
      const newSet = new Set(prev)
      if (newSet.has(modId)) {
        newSet.delete(modId)
      } else {
        newSet.add(modId)
      }
      return newSet
    })
  }

  const addSelectedCollectionMods = () => {
    if (selectedCollectionMods.size === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ít nhất một mod để thêm' })
      return
    }

    const modsToAdd = collectionItems.filter(item =>
      selectedCollectionMods.has(item.publishedfileid)
    )

    const newMods: Mod[] = []
    modsToAdd.forEach(mod => {
      const workshopId = mod.publishedfileid
      // Kiểm tra xem mod đã tồn tại chưa
      if (!mods.some(m => m.workshopId === workshopId || m.id === workshopId)) {
        newMods.push({
          id: workshopId,
          name: mod.title || workshopId,
          workshopId: workshopId,
          details: {
            id: workshopId,
            title: mod.title || workshopId,
            description: mod.description || '',
            preview_url: mod.preview_url || '',
            file_size: mod.file_size || 0,
            subscriptions: mod.subscriptions || 0,
          },
        })
      }
    })

    if (newMods.length === 0) {
      setMessage({ type: 'error', text: 'Tất cả mods đã được chọn đều có trong danh sách rồi' })
      return
    }

    setMods(prev => [...prev, ...newMods])
    setMessage({ type: 'success', text: `Đã thêm ${newMods.length} mod từ collection!` })
    setTimeout(() => setMessage(null), 3000)
    setShowAddModDialog(false)
    setAddModInput('')
    setCollectionItems([])
    setSelectedCollectionMods(new Set())

    // Tự động load details cho mods mới
    setTimeout(() => {
      loadModDetails(newMods)
    }, 500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Đang tải mod list...</div>
      </div>
    )
  }

  return (
    <div>
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${message.type === 'success'
            ? 'bg-green-900/50 text-green-300 border border-green-700'
            : 'bg-red-900/50 text-red-300 border border-red-700'
            }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-4 flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Danh sách Mod ({mods.length})
          </h3>
          <div className="flex gap-2 mt-1">
            {mods.length > 0 && (
              <button
                onClick={() => loadModDetails(mods)}
                disabled={loadingDetails}
                className="text-sm text-primary-400 hover:text-primary-300 disabled:text-gray-600 flex items-center gap-1"
              >
                {loadingDetails ? (
                  <><i className="lni lni-spinner lni-is-spinning"></i> Đang tải...</>
                ) : (
                  <><i className="lni lni-reload"></i> Tải lại thông tin mod</>
                )}
              </button>
            )}
            <span className="text-xs text-white/40">
              Workshop mods: {mods.filter(m => m.workshopId || /^\d+$/.test(m.id)).length} / {mods.length}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={saveMods}
            disabled={saving || !serverPath}
            className="px-4 py-2 btn-primary-glass rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <><i className="lni lni-spinner lni-is-spinning"></i> Đang lưu...</>
            ) : (
              <><i className="lni lni-save"></i> Lưu</>
            )}
          </button>
          <button
            onClick={loadMods}
            disabled={loading || !serverPath}
            className="px-4 py-2 btn-glass rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <i className="lni lni-reload"></i> Tải lại
          </button>
          <button
            onClick={() => setShowAddModDialog(true)}
            className="px-4 py-2 btn-glass rounded-xl flex items-center gap-2"
          >
            <i className="lni lni-plus"></i> Thêm Mod
          </button>
        </div>
      </div>

      {/* Debug info - chỉ hiển thị trong development */}
      {process.env.NODE_ENV === 'development' && mods.length > 0 && (
        <details className="mb-4 p-3 glass rounded-xl text-xs text-white/40">
          <summary className="cursor-pointer text-white/50">Debug Info</summary>
          <pre className="mt-2 overflow-auto max-h-40">
            {JSON.stringify(
              mods.map(m => ({
                id: m.id,
                name: m.name,
                workshopId: m.workshopId,
                hasDetails: !!m.details,
                previewUrl: m.details?.preview_url,
              })),
              null,
              2
            )}
          </pre>
        </details>
      )}

      {loadingDetails && (
        <div className="mb-4 text-sm text-gray-400">
          Đang tải thông tin chi tiết mod...
        </div>
      )}

      {mods.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Chưa có mod nào. Nhấn "Thêm Mod" để thêm mod.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mods.map((mod, index) => (
            <div
              key={`${mod.id}-${index}`}
              className="glass-card rounded-xl overflow-hidden transition-all"
            >
              {/* Mod Image */}
              <div className="relative w-full h-48 bg-black/30">
                {(() => {
                  const workshopId = mod.workshopId || (mod.id.match(/^\d+$/) ? mod.id : null)
                  const previewUrl = mod.details?.preview_url || mod.details?.preview_image

                  // Nếu có preview URL và chưa bị lỗi
                  if (previewUrl && !imageErrors.has(mod.id)) {
                    return (
                      <img
                        src={previewUrl}
                        alt={mod.details?.title || mod.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() => {
                          console.log('Image load error for mod:', mod.id, previewUrl)
                          setImageErrors(prev => new Set(prev).add(mod.id))
                        }}
                      />
                    )
                  }

                  // Nếu có workshop ID nhưng chưa có preview URL, thử load từ Steam CDN
                  if (workshopId && !imageErrors.has(mod.id)) {
                    // Thử URL preview image từ Steam CDN (format thường dùng)
                    const steamPreviewUrl = `https://steamuserimages-a.akamaihd.net/ugc/${workshopId}/`
                    return (
                      <img
                        src={steamPreviewUrl}
                        alt={mod.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() => {
                          // Nếu không load được, đánh dấu lỗi
                          setImageErrors(prev => new Set(prev).add(mod.id))
                        }}
                        style={{ display: 'none' }} // Ẩn cho đến khi load thành công
                        onLoad={(e) => {
                          // Hiển thị khi load thành công
                          const target = e.target as HTMLImageElement
                          target.style.display = 'block'
                        }}
                      />
                    )
                  }

                  // Fallback: hiển thị placeholder
                  if (mod.workshopId || /^\d+$/.test(mod.id)) {
                    return (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <svg
                            className="w-16 h-16 mx-auto mb-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <p className="text-xs">
                            {mod.details ? 'Không có hình ảnh' : 'Đang tải...'}
                          </p>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <svg
                          className="w-16 h-16 mx-auto mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          />
                        </svg>
                        <p className="text-xs">Mod thường</p>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Mod Info */}
              <div className="p-4">
                <h4 className="text-white font-semibold mb-2 line-clamp-2 min-h-[3rem]">
                  {mod.details?.title || mod.name}
                </h4>

                <div className="space-y-1 text-sm text-gray-400 mb-3">
                  <div>
                    <span className="font-medium">ID:</span> {mod.id}
                  </div>
                  {mod.workshopId && (
                    <div>
                      <span className="font-medium">Workshop:</span>{' '}
                      <a
                        href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.workshopId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-400 hover:text-primary-300 underline"
                      >
                        {mod.workshopId}
                      </a>
                    </div>
                  )}
                  {!mod.workshopId && !/^\d+$/.test(mod.id) && (
                    <div className="text-xs text-yellow-400">
                      ⚠️ Mod thường (không có Workshop ID)
                    </div>
                  )}
                  {mod.details?.file_size && (
                    <div>
                      <span className="font-medium">Kích thước:</span>{' '}
                      {formatFileSize(mod.details.file_size)}
                    </div>
                  )}
                  {mod.details?.subscriptions && (
                    <div>
                      <span className="font-medium">Subscriptions:</span>{' '}
                      {mod.details.subscriptions.toLocaleString()}
                    </div>
                  )}
                  {mod.details?.result && mod.details.result !== 1 && (
                    <div className="text-xs text-red-400">
                      ⚠️ Steam API result: {mod.details.result}
                    </div>
                  )}
                </div>

                {mod.details?.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                    {mod.details.description.replace(/<[^>]*>/g, '').substring(0, 100)}...
                  </p>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => removeMod(index)}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                  >
                    Xóa
                  </button>
                  {mod.workshopId && (
                    <a
                      href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.workshopId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                    >
                      Steam
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Mod Dialog */}
      {showAddModDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-strong rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Thêm Mod</h3>
              <button
                onClick={() => {
                  setShowAddModDialog(false)
                  setAddModInput('')
                  setSearchResults([])
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Add Mod Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cách thêm mod
              </label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setAddModType('id')
                    setSearchResults([])
                    setCollectionItems([])
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${addModType === 'id'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  Steam ID
                </button>
                <button
                  onClick={() => {
                    setAddModType('name')
                    setSearchResults([])
                    setCollectionItems([])
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${addModType === 'name'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  Tìm theo tên
                </button>
                <button
                  onClick={() => {
                    setAddModType('link')
                    setSearchResults([])
                    setCollectionItems([])
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${addModType === 'link'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  Link Workshop
                </button>
                <button
                  onClick={() => {
                    setAddModType('collection')
                    setSearchResults([])
                    setCollectionItems([])
                    setSelectedCollectionMods(new Set())
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${addModType === 'collection'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  Steam Collection
                </button>
              </div>
            </div>

            {/* Input Field */}
            {addModType !== 'collection' || collectionItems.length === 0 ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {addModType === 'id' && 'Nhập Steam Workshop ID (số)'}
                  {addModType === 'name' && 'Nhập tên mod để tìm kiếm'}
                  {addModType === 'link' && 'Nhập link Steam Workshop'}
                  {addModType === 'collection' && 'Nhập link Steam Collection'}
                </label>
                <input
                  type="text"
                  value={addModInput}
                  onChange={(e) => setAddModInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !searchingMod && !loadingCollection) {
                      if (addModType === 'collection') {
                        loadCollection(addModInput.trim())
                      } else {
                        handleAddMod()
                      }
                    }
                  }}
                  placeholder={
                    addModType === 'id'
                      ? 'Ví dụ: 3022543997'
                      : addModType === 'name'
                        ? 'Ví dụ: True Music'
                        : addModType === 'link'
                          ? 'Ví dụ: https://steamcommunity.com/sharedfiles/filedetails/?id=3022543997'
                          : 'Ví dụ: https://steamcommunity.com/sharedfiles/filedetails/?id=123456789'
                  }
                  className="w-full px-4 py-3 input-glass rounded-xl"
                />
                {(addModType === 'link' || addModType === 'collection') && (
                  <p className="mt-2 text-xs text-gray-400">
                    Hỗ trợ: steamcommunity.com links, steam:// links, hoặc chỉ số ID
                  </p>
                )}
              </div>
            ) : null}

            {/* Search Results */}
            {addModType === 'name' && searchResults.length > 0 && (
              <div className="mb-4 max-h-80 overflow-y-auto">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Kết quả tìm kiếm ({searchResults.length}) - <span className="text-primary-400">Sắp xếp theo độ phổ biến</span>
                </label>
                <div className="space-y-2">
                  {searchResults.map((mod, index) => (
                    <div
                      key={mod.publishedfileid}
                      className="p-3 glass rounded-xl hover:bg-white/10 cursor-pointer transition-all relative"
                      onClick={() => handleSelectSearchResult(mod)}
                    >
                      {/* Badge phổ biến */}
                      {index < 3 && (
                        <div className={`absolute -top-1 -left-1 px-2 py-0.5 rounded text-xs font-bold ${index === 0 ? 'bg-yellow-500 text-black' :
                          index === 1 ? 'bg-gray-300 text-black' :
                            'bg-orange-400 text-black'
                          }`}>
                          #{index + 1}
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        {mod.preview_url && (
                          <img
                            src={mod.preview_url}
                            alt={mod.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{mod.title}</div>
                          <div className="text-xs text-gray-400 space-x-2">
                            <span>ID: {mod.publishedfileid}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1 text-xs">
                            {(mod.subscriptions || mod.lifetime_subscriptions) && (
                              <span className="text-green-400">
                                <i className="lni lni-users mr-1"></i>
                                {(mod.subscriptions || mod.lifetime_subscriptions).toLocaleString()}
                              </span>
                            )}
                            {(mod.favorited || mod.lifetime_favorited) && (
                              <span className="text-yellow-400">
                                <i className="lni lni-star mr-1"></i>
                                {(mod.favorited || mod.lifetime_favorited).toLocaleString()}
                              </span>
                            )}
                            {mod.vote_data && (
                              <span className="text-blue-400">
                                <i className="lni lni-thumbs-up mr-1"></i>
                                {mod.vote_data.votes_up?.toLocaleString() || 0}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectSearchResult(mod)
                          }}
                          className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm flex items-center gap-1"
                        >
                          <i className="lni lni-plus"></i> Thêm
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collection Items */}
            {addModType === 'collection' && (
              <>
                {loadingCollection && (
                  <div className="mb-4 text-center py-8 text-gray-400">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    <p className="mt-2">Đang tải collection...</p>
                  </div>
                )}

                {collectionItems.length > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-medium text-gray-300">
                        Mods trong Collection ({collectionItems.length})
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const allIds = new Set(collectionItems.map(item => item.publishedfileid))
                            setSelectedCollectionMods(allIds)
                          }}
                          className="text-xs text-primary-400 hover:text-primary-300"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          onClick={() => setSelectedCollectionMods(new Set())}
                          className="text-xs text-gray-400 hover:text-gray-300"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-700 rounded-lg p-2">
                      {collectionItems.map((mod) => {
                        const isSelected = selectedCollectionMods.has(mod.publishedfileid)
                        const alreadyExists = mods.some(m => m.workshopId === mod.publishedfileid || m.id === mod.publishedfileid)

                        return (
                          <div
                            key={mod.publishedfileid}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${isSelected
                              ? 'bg-primary-900/50 border-2 border-primary-500'
                              : 'bg-gray-700 hover:bg-gray-650 border-2 border-transparent'
                              } ${alreadyExists ? 'opacity-60' : ''}`}
                            onClick={() => !alreadyExists && toggleCollectionMod(mod.publishedfileid)}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => !alreadyExists && toggleCollectionMod(mod.publishedfileid)}
                                disabled={alreadyExists}
                                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                              />
                              {mod.preview_url && (
                                <img
                                  src={mod.preview_url}
                                  alt={mod.title}
                                  className="w-16 h-16 object-cover rounded"
                                />
                              )}
                              <div className="flex-1">
                                <div className="text-white font-medium flex items-center gap-2">
                                  {mod.title}
                                  {alreadyExists && (
                                    <span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded">
                                      Đã có
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400">
                                  ID: {mod.publishedfileid}
                                  {mod.subscriptions && ` • ${mod.subscriptions.toLocaleString()} subscriptions`}
                                </div>
                              </div>
                              <a
                                href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.publishedfileid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                              >
                                Xem
                              </a>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {selectedCollectionMods.size > 0 && (
                      <div className="mt-3 p-3 bg-primary-900/20 border border-primary-700 rounded-lg">
                        <p className="text-sm text-primary-300">
                          Đã chọn: <strong>{selectedCollectionMods.size}</strong> mod{selectedCollectionMods.size > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAddModDialog(false)
                  setAddModInput('')
                  setSearchResults([])
                  setCollectionItems([])
                  setSelectedCollectionMods(new Set())
                }}
                className="px-4 py-2 btn-glass rounded-xl"
              >
                Hủy
              </button>
              {addModType === 'collection' && collectionItems.length > 0 ? (
                <button
                  onClick={addSelectedCollectionMods}
                  disabled={selectedCollectionMods.size === 0}
                  className="px-4 py-2 btn-primary-glass rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Thêm {selectedCollectionMods.size > 0 ? `${selectedCollectionMods.size} ` : ''}Mod đã chọn
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (addModType === 'collection') {
                      loadCollection(addModInput.trim())
                    } else {
                      handleAddMod()
                    }
                  }}
                  disabled={searchingMod || loadingCollection || !addModInput.trim()}
                  className="px-4 py-2 btn-primary-glass rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {searchingMod || loadingCollection
                    ? 'Đang tải...'
                    : addModType === 'name'
                      ? 'Tìm kiếm'
                      : addModType === 'collection'
                        ? 'Tải Collection'
                        : 'Thêm Mod'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

