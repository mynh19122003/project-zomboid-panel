'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { COMMON_SETTINGS } from '@/data/serverSettingsMeta'
import { SANDBOX_VARS } from '@/data/sandboxVarsMeta'
import { storeToastForReload } from './Toast'
import GlassDropdown from './GlassDropdown'

interface ServerSettingsProps {
  serverPath: string
}

interface FileInfo {
  name: string
  path: string
  extension: string
  size: number
}

export default function ServerSettings({ serverPath }: ServerSettingsProps) {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [availableFiles, setAvailableFiles] = useState<FileInfo[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [fileContent, setFileContent] = useState<string>('')

  useEffect(() => {
    if (serverPath) {
      loadAvailableFiles()
    }
  }, [serverPath])

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile)
    }
  }, [selectedFile])

  const loadAvailableFiles = async () => {
    if (!serverPath) return

    setLoadingFiles(true)
    try {
      const response = await axios.get('/api/files/list', {
        params: {
          directoryPath: serverPath,
          extensions: '.ini,.lua'
        },
      })
      // Chỉ lấy 2 file chính: servertest.ini và servertest_SandBoxVars.lua
      const allFiles = response.data.files || []
      const mainFiles = allFiles.filter((f: FileInfo) =>
        f.extension === '.ini' || f.name.toLowerCase().includes('sandboxvars')
      )
      setAvailableFiles(mainFiles)

      // Tự động chọn file đầu tiên nếu chưa có file nào được chọn
      if (mainFiles.length > 0 && !selectedFile) {
        // Ưu tiên file .ini
        const iniFile = mainFiles.find((f: FileInfo) => f.extension === '.ini')
        if (iniFile) {
          setSelectedFile(iniFile.path)
        } else {
          setSelectedFile(mainFiles[0].path)
        }
      }
    } catch (error: any) {
      console.error('Load files error:', error)
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Không thể tải danh sách files'
      })
    } finally {
      setLoadingFiles(false)
    }
  }

  const loadFileContent = async (filePath: string) => {
    if (!filePath) return

    setLoading(true)
    try {
      const response = await axios.get('/api/files/read', {
        params: { filePath },
      })

      setSettings(response.data.content || {})
      setFileContent(response.data.rawContent || '')
      setMessage({ type: 'success', text: `Đã tải file: ${response.data.fileName}` })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      const errorData = error.response?.data || {}
      let errorMessage = errorData.error || 'Không thể tải file'

      if (errorData.path) {
        errorMessage += `\nĐường dẫn: ${errorData.path}`
      }

      console.error('Load file error:', errorData)
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }


  const saveSettings = async () => {
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Vui lòng chọn file để lưu' })
      return
    }

    setSaving(true)
    try {
      // Tạo nội dung file từ settings
      let newContent = ''
      if (selectedFile.endsWith('.ini')) {
        // Tạo lại nội dung INI từ settings
        const lines = fileContent.split('\n')
        const settingsMap = new Map(Object.entries(settings))
        const newLines: string[] = []

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
            newLines.push(line)
            continue
          }

          const match = trimmed.match(/^([^=]+)=(.*)$/)
          if (match) {
            const key = match[1].trim()
            if (settingsMap.has(key)) {
              newLines.push(`${key}=${settingsMap.get(key)}`)
              settingsMap.delete(key)
            } else {
              newLines.push(line)
            }
          } else {
            newLines.push(line)
          }
        }

        settingsMap.forEach((value, key) => {
          newLines.push(`${key}=${value}`)
        })

        newContent = newLines.join('\n')
      } else if (selectedFile.endsWith('.lua')) {
        // Xử lý file .lua (SandBoxVars)
        const lines = fileContent.split('\n')
        const settingsMap = new Map(Object.entries(settings))
        const newLines: string[] = []

        for (const line of lines) {
          const trimmed = line.trim()

          // Giữ nguyên comments và empty lines
          if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('--[[')) {
            newLines.push(line)
            continue
          }

          // Match: variable = value, (với dấu phẩy cuối tùy chọn) và có thể có comment
          // Ví dụ: DayLength = 3, hoặc StartYear = 1, -- comment
          const match = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+?)(,?)(\s*--.*)?\s*$/)
          if (match) {
            const indent = match[1] || ''           // Giữ nguyên indentation
            const key = match[2]                     // Tên biến
            const originalValue = match[3].trim()    // Giá trị gốc
            const comma = match[4] || ''             // Dấu phẩy cuối (nếu có)
            const comment = match[5] || ''           // Comment cuối dòng (nếu có)

            if (settingsMap.has(key)) {
              const newValue = settingsMap.get(key)

              // So sánh giá trị để xem có thay đổi không
              const cleanOriginal = originalValue.replace(/^["']|["']$/g, '')
              const cleanNew = String(newValue).replace(/^["']|["']$/g, '').replace(/,\s*$/, '')

              if (cleanOriginal === cleanNew) {
                // Không thay đổi, giữ nguyên dòng gốc
                newLines.push(line)
              } else {
                // Xác định kiểu dữ liệu gốc
                const originalIsString = /^["']/.test(originalValue)
                const originalIsInteger = /^-?\d+$/.test(originalValue)
                const originalIsFloat = /^-?\d+\.\d+$/.test(originalValue)
                const originalIsBoolean = originalValue === 'true' || originalValue === 'false'
                const originalIsTable = /^[{\[]/.test(originalValue)

                let formattedValue = cleanNew

                if (originalIsTable) {
                  // Table/array, giữ nguyên dòng gốc
                  newLines.push(line)
                  settingsMap.delete(key)
                  continue
                } else if (originalIsString) {
                  formattedValue = `"${formattedValue}"`
                } else if (originalIsBoolean) {
                  formattedValue = formattedValue === 'true' || formattedValue === '1' ? 'true' : 'false'
                } else if (originalIsInteger) {
                  formattedValue = String(Math.round(Number(formattedValue) || 0))
                } else if (originalIsFloat) {
                  formattedValue = String(Number(formattedValue) || 0)
                }

                newLines.push(`${indent}${key} = ${formattedValue}${comma}${comment}`)
              }
              settingsMap.delete(key)
            } else {
              newLines.push(line)
            }
          } else {
            newLines.push(line)
          }
        }

        // Thêm các settings mới chưa có trong file (ở cuối)
        settingsMap.forEach((value, key) => {
          let formattedValue = String(value).replace(/,\s*$/, '')
          // Mặc định không thêm quotes cho số và boolean
          if (!/^[\d.]+$/.test(formattedValue) && formattedValue !== 'true' && formattedValue !== 'false' && !/^["'\[{]/.test(formattedValue)) {
            formattedValue = `"${formattedValue}"`
          }
          newLines.push(`    ${key} = ${formattedValue},`)
        })

        newContent = newLines.join('\n')
      } else {
        // Với file khác, giữ nguyên raw content
        newContent = fileContent
      }

      await axios.post('/api/files/read', {
        filePath: selectedFile,
        content: newContent,
      })

      // Lưu toast vào localStorage và reload trang
      storeToastForReload({
        message: `Đã lưu file ${selectedFile.split(/[/\\]/).pop()} thành công!`,
        type: 'success'
      })
      window.location.reload()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Không thể lưu file' })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const isSandboxFile = selectedFile?.toLowerCase().includes('sandboxvars')
  const commonSettings = isSandboxFile ? SANDBOX_VARS : COMMON_SETTINGS

  return (
    <div>
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg whitespace-pre-line ${message.type === 'success'
            ? 'bg-green-900/50 text-green-300 border border-green-700'
            : 'bg-red-900/50 text-red-300 border border-red-700'
            }`}
        >
          {message.text}
        </div>
      )}

      {/* File Selector */}
      {serverPath && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-white/70 mb-2">
            <i className="lni lni-files mr-2"></i>
            Chọn file để chỉnh sửa
          </label>
          {loadingFiles ? (
            <div className="flex items-center gap-3 text-white/50">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Đang tải danh sách files...</span>
            </div>
          ) : (
            <div className="flex gap-3 items-center">
              {availableFiles.length === 0 ? (
                <div className="text-white/50">Không tìm thấy file .ini hoặc .lua</div>
              ) : (
                <>
                  <div className="flex-1 min-w-[300px]">
                    <GlassDropdown
                      options={availableFiles.map((file) => ({
                        value: file.path,
                        label: file.name,
                        sublabel: `${file.extension.toUpperCase()} • ${Math.round(file.size / 1024)}KB`,
                      }))}
                      value={selectedFile}
                      onChange={(value) => setSelectedFile(value)}
                      placeholder="Chọn file..."
                      loading={loading}
                      icon={<i className="lni lni-files"></i>}
                    />
                  </div>
                  <button
                    onClick={loadAvailableFiles}
                    className="px-4 py-3 btn-glass rounded-xl flex items-center gap-2 flex-shrink-0"
                  >
                    <i className="lni lni-reload"></i>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-white/50">Đang tải file...</div>
        </div>
      )}

      {!selectedFile && !loading && (
        <div className="text-center py-12 text-white/50">
          Vui lòng chọn file để chỉnh sửa
        </div>
      )}

      {selectedFile && !loading && (
        <>
          {/* Action buttons - moved to top */}
          <div className="mb-6 flex gap-4 items-center flex-wrap">
            <button
              onClick={saveSettings}
              disabled={saving || !selectedFile}
              className="px-6 py-3 btn-primary-glass rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center gap-2"
            >
              {saving ? (
                <>
                  <i className="lni lni-spinner lni-is-spinning"></i>
                  Đang lưu...
                </>
              ) : (
                <>
                  <i className="lni lni-save"></i>
                  Lưu File
                </>
              )}
            </button>
            <button
              onClick={() => selectedFile && loadFileContent(selectedFile)}
              disabled={loading || !selectedFile}
              className="px-6 py-3 btn-glass rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <i className="lni lni-reload"></i>
              Tải lại
            </button>
            <div className="flex-1"></div>
            <div className="text-sm text-white/50">
              Đang chỉnh sửa: <span className="text-white font-medium">{selectedFile.split(/[/\\]/).pop()}</span>
              {Object.keys(settings).length > 0 && (
                <span className="ml-2">({Object.keys(settings).length} settings)</span>
              )}
            </div>
          </div>

          {isSandboxFile && (
            <div className="mb-4 text-xs text-white/60 glass rounded-lg p-3">
              <i className="lni lni-information mr-2"></i>
              Đang chỉnh sửa SandBoxVars (theo tài liệu Project Zomboid). Các mô tả lấy từ wiki.
            </div>
          )}

          <div className="space-y-4">
            {commonSettings.map((setting) => (
              <div key={setting.key} className="flex items-start gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    {setting.label}
                    <span className="ml-2 text-xs text-white/40">({setting.type})</span>
                  </label>
                  {setting.description && (
                    <p className="text-xs text-white/50 mb-2">{setting.description}</p>
                  )}
                </div>
                <div className="w-48 flex-shrink-0">
                  {setting.type === 'boolean' ? (
                    <button
                      onClick={() => {
                        const currentValue = settings[setting.key]
                        const newValue = currentValue === 'true' ? 'false' : 'true'
                        handleChange(setting.key, newValue)
                      }}
                      className={`w-full px-4 py-2 rounded-xl font-medium transition-all ${settings[setting.key] === 'true'
                        ? 'bg-white/20 border border-white/30 text-white'
                        : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10'
                        }`}
                    >
                      {settings[setting.key] === 'true' ? 'TRUE' : 'FALSE'}
                    </button>
                  ) : setting.type === 'integer' || setting.type === 'port' ? (
                    <input
                      type="number"
                      value={String(settings[setting.key] ?? setting.defaultValue ?? '')}
                      onChange={(e) => handleChange(setting.key, e.target.value)}
                      className="w-full px-4 py-2 input-glass rounded-xl"
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(settings[setting.key] ?? '')}
                      onChange={(e) => handleChange(setting.key, e.target.value)}
                      className="w-full px-4 py-2 input-glass rounded-xl"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

