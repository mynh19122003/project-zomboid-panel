'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
  onClose: () => void
}

export default function Toast({ message, type, duration = 4000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 10)

    // Auto close
    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(() => {
      onClose()
    }, 300)
  }

  const bgColor = {
    success: 'glass-strong',
    error: 'glass-strong',
    info: 'glass-strong',
  }[type]

  const icon = {
    success: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }[type]

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] transform transition-all duration-300 ease-out ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}
    >
      <div
        className={`${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 min-w-[300px] max-w-[500px]`}
        style={{
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="flex-shrink-0 bg-white/20 rounded-full p-2">
          {icon}
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm sm:text-base">{message}</p>
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// Helper để hiển thị toast sau khi reload trang
export const TOAST_STORAGE_KEY = 'zomboidToastMessage'

export interface StoredToast {
  message: string
  type: 'success' | 'error' | 'info'
}

export function storeToastForReload(toast: StoredToast) {
  localStorage.setItem(TOAST_STORAGE_KEY, JSON.stringify(toast))
}

export function getStoredToast(): StoredToast | null {
  const stored = localStorage.getItem(TOAST_STORAGE_KEY)
  if (stored) {
    localStorage.removeItem(TOAST_STORAGE_KEY)
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }
  return null
}
