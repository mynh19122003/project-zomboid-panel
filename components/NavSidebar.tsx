"use client";

import { useState } from "react";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

interface NavSidebarProps {
  activeItem: string;
  onItemClick: (id: string) => void;
  serverStatus?: "online" | "offline" | "unknown";
}

export default function NavSidebar({
  activeItem,
  onItemClick,
  serverStatus = "unknown",
}: NavSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Tổng quan", icon: "lni-dashboard" },
    { id: "settings", label: "Cài đặt Server", icon: "lni-cog" },
    { id: "mods", label: "Quản lý Mod", icon: "lni-package" },
    // { id: 'database', label: 'Database', icon: 'lni-database' },
  ];

  const statusColors = {
    online: "bg-green-500",
    offline: "bg-red-500",
    unknown: "bg-yellow-500",
  };

  const statusLabels = {
    online: "Đang chạy",
    offline: "Tắt",
    unknown: "Không rõ",
  };

  return (
    <aside
      className={`
        h-screen fixed left-0 top-0 z-40
        bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700
        flex flex-col
        transition-all duration-300 ease-in-out
        ${isCollapsed ? "w-16" : "w-64"}
      `}
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
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
                    e.currentTarget.style.display = "none";
                    e.currentTarget.parentElement!.innerHTML =
                      '<i class="lni lni-skull text-xl text-white"></i>';
                  }}
                />
              </div>
              <div>
                <h1 className="text-zinc-900 dark:text-white font-semibold text-sm">
                  PZ Manager
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                  Quản lý Server
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          >
            <i
              className={`lni ${
                isCollapsed ? "lni-chevron-right" : "lni-chevron-left"
              }`}
            ></i>
          </button>
        </div>
      </div>

      {/* Server Status */}
      <div
        className={`p-4 border-b border-zinc-200 dark:border-zinc-700 ${
          isCollapsed ? "px-2" : ""
        }`}
      >
        <div
          className={`flex items-center gap-3 ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          <div
            className={`w-3 h-3 rounded-full ${statusColors[serverStatus]} animate-pulse`}
          ></div>
          {!isCollapsed && (
            <div>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                Trạng thái Server
              </p>
              <p className="text-zinc-900 dark:text-white text-sm font-medium">
                {statusLabels[serverStatus]}
              </p>
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
              ${isCollapsed ? "justify-center" : ""}
              ${
                activeItem === item.id
                  ? "bg-blue-500/10 dark:bg-white/10 text-blue-600 dark:text-white border-l-4 border-blue-500 dark:border-white"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white border-l-4 border-transparent"
              }
            `}
            title={isCollapsed ? item.label : undefined}
          >
            <i className={`lni ${item.icon} text-lg`}></i>
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left text-sm">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="bg-blue-500/20 dark:bg-white/20 text-blue-600 dark:text-white text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div
        className={`p-4 border-t border-zinc-700 dark:border-zinc-700 ${
          isCollapsed ? "px-2" : ""
        }`}
      >
        {/* Theme Toggle - Simple Icon */}
        <div
          className={`flex items-center ${
            isCollapsed ? "justify-center" : "justify-between"
          } mb-3`}
        >
          {!isCollapsed && (
            <span className="text-zinc-500 dark:text-zinc-500 text-xs">
              Giao diện
            </span>
          )}
          <button
            onClick={(e) => {
              const btn = e.currentTarget;
              const icon = btn.querySelector("svg");

              // Add spin animation
              if (icon) {
                icon.style.transform = "rotate(360deg) scale(1.2)";
                icon.style.transition = "transform 0.5s ease-in-out";
              }

              // Toggle theme after a small delay for animation
              setTimeout(() => {
                const html = document.documentElement;
                const isDark = html.classList.contains("dark");
                if (isDark) {
                  html.classList.remove("dark");
                  localStorage.setItem("theme", "light");
                } else {
                  html.classList.add("dark");
                  localStorage.setItem("theme", "dark");
                }
                // Reset animation
                if (icon) {
                  icon.style.transform = "";
                }
                window.dispatchEvent(new Event("themechange"));
              }, 250);
            }}
            className="p-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all duration-300 hover:scale-110 active:scale-95"
            title="Chuyển đổi sáng/tối"
          >
            {/* Sun icon - shown in dark mode */}
            <svg
              className="w-5 h-5 text-yellow-400 hidden dark:block"
              fill="currentColor"
              viewBox="0 0 20 20"
              style={{ transition: "transform 0.5s ease-in-out" }}
            >
              <path
                fillRule="evenodd"
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                clipRule="evenodd"
              />
            </svg>
            {/* Moon icon - shown in light mode */}
            <svg
              className="w-5 h-5 text-indigo-600 block dark:hidden"
              fill="currentColor"
              viewBox="0 0 20 20"
              style={{ transition: "transform 0.5s ease-in-out" }}
            >
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          </button>
        </div>

        {!isCollapsed ? (
          <div className="text-zinc-500 dark:text-zinc-500 text-xs text-center space-y-1">
            <p>PZ Mod Manager v1.0</p>
            <p className="text-zinc-600 dark:text-zinc-600">
              @2025 <span className="text-zinc-400 dark:text-zinc-400">bủ</span>
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <i className="lni lni-information text-zinc-500 dark:text-zinc-500"></i>
          </div>
        )}
      </div>
    </aside>
  );
}
