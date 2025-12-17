'use client'

import { useState, useRef, useEffect } from 'react'

interface DropdownOption {
    value: string
    label: string
    sublabel?: string
}

interface GlassDropdownProps {
    options: DropdownOption[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    loading?: boolean
    disabled?: boolean
    icon?: React.ReactNode
}

export default function GlassDropdown({
    options,
    value,
    onChange,
    placeholder = 'Chọn...',
    loading = false,
    disabled = false,
    icon,
}: GlassDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find(opt => opt.value === value)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled || loading) return

        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault()
                if (isOpen && highlightedIndex >= 0) {
                    onChange(options[highlightedIndex].value)
                    setIsOpen(false)
                } else {
                    setIsOpen(!isOpen)
                }
                break
            case 'ArrowDown':
                e.preventDefault()
                if (!isOpen) {
                    setIsOpen(true)
                } else {
                    setHighlightedIndex(prev => Math.min(prev + 1, options.length - 1))
                }
                break
            case 'ArrowUp':
                e.preventDefault()
                setHighlightedIndex(prev => Math.max(prev - 1, 0))
                break
            case 'Escape':
                setIsOpen(false)
                break
        }
    }

    return (
        <div ref={dropdownRef} className="relative w-full" onKeyDown={handleKeyDown}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
                disabled={disabled || loading}
                className={`
          w-full px-4 py-3 rounded-xl text-left
          flex items-center gap-3
          transition-all duration-200
          bg-zinc-800 border-2 border-zinc-600 shadow-lg
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-zinc-700 hover:border-zinc-500'}
          ${isOpen ? 'border-white/50 bg-zinc-700' : ''}
        `}
            >
                {/* Icon */}
                {icon && (
                    <span className="text-white/60 flex-shrink-0">
                        {icon}
                    </span>
                )}

                {/* Selected value or placeholder */}
                <div className="flex-1 min-w-0">
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span className="text-white/50">Đang tải...</span>
                        </div>
                    ) : selectedOption ? (
                        <div>
                            <div className="text-white truncate">{selectedOption.label}</div>
                            {selectedOption.sublabel && (
                                <div className="text-xs text-white/40 truncate">{selectedOption.sublabel}</div>
                            )}
                        </div>
                    ) : (
                        <span className="text-white/40">{placeholder}</span>
                    )}
                </div>

                {/* Dropdown Arrow */}
                <svg
                    className={`w-5 h-5 text-white/50 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            <div
                className={`
          absolute z-50 w-full mt-2 rounded-xl overflow-hidden
          bg-zinc-800 border-2 border-zinc-500
          shadow-[0_10px_40px_rgba(0,0,0,0.8)]
          transition-all duration-200 origin-top
          ${isOpen
                        ? 'opacity-100 scale-y-100 translate-y-0'
                        : 'opacity-0 scale-y-95 -translate-y-2 pointer-events-none'
                    }
        `}
            >
                <div className="max-h-64 overflow-y-auto py-1">
                    {options.length === 0 ? (
                        <div className="px-4 py-3 text-white/40 text-center">
                            Không có dữ liệu
                        </div>
                    ) : (
                        options.map((option, index) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value)
                                    setIsOpen(false)
                                }}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                className={`
                  w-full px-4 py-3 text-left
                  transition-all duration-150
                  flex items-center gap-3 relative
                  border-l-4
                  ${option.value === value
                                        ? 'bg-zinc-600 text-white border-l-white'
                                        : 'text-zinc-200 hover:bg-zinc-700 border-l-transparent hover:border-l-zinc-400'
                                    }
                  ${highlightedIndex === index ? 'bg-zinc-700 border-l-zinc-400' : ''}
                `}
                                style={{
                                    animationDelay: `${index * 30}ms`,
                                }}
                            >
                                {/* Check icon for selected */}
                                <div className="w-5 flex-shrink-0">
                                    {option.value === value && (
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>

                                {/* Option content */}
                                <div className="flex-1 min-w-0">
                                    <div className="truncate">{option.label}</div>
                                    {option.sublabel && (
                                        <div className="text-xs text-white/40 truncate">{option.sublabel}</div>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
