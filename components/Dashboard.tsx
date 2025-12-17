"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

interface DashboardProps {
  serverPath: string;
  onStatusChange?: (status: "online" | "offline" | "checking") => void;
}

interface RconConfig {
  host: string;
  port: number;
  password: string;
}

interface ServerStats {
  status: "online" | "offline" | "checking";
  players: number;
  maxPlayers: number;
  playerList: string[];
  lastChecked: Date | null;
  responseTime?: number;
  error?: string;
}

interface LogEntry {
  time: Date;
  type: "info" | "success" | "error" | "command";
  message: string;
}

interface SystemStats {
  cpu: {
    cores: number;
    model: string;
    usage: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  uptime: number;
  platform: string;
  hostname: string;
  pzServer?: {
    found: boolean;
    processName: string;
    pid?: number;
    cpuPercent?: number;
    memoryMB?: number;
    memoryPercent?: number;
  };
}

interface ServerConfigInfo {
  maxMemory: string | null;
  maxMemoryMB: number | null;
  minMemory: string | null;
  minMemoryMB: number | null;
  batFilePath: string | null;
  error?: string;
}

export default function Dashboard({
  serverPath,
  onStatusChange,
}: DashboardProps) {
  const [stats, setStats] = useState<ServerStats>({
    status: "checking",
    players: 0,
    maxPlayers: 64,
    playerList: [],
    lastChecked: null,
  });

  // Notify parent of status change (with debounce to avoid rapid updates)
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(stats.status);
    }
  }, [stats.status, onStatusChange]);
  const [rconConfig, setRconConfig] = useState<RconConfig>({
    host: "127.0.0.1",
    port: 27015,
    password: "",
  });
  const [showConfig, setShowConfig] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<
    { command: string; response: string; time: Date }[]
  >([]);
  const [executing, setExecuting] = useState(false);
  const [connectionLogs, setConnectionLogs] = useState<LogEntry[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerConfigInfo | null>(
    null
  );
  const [serverExePath, setServerExePath] = useState("");
  const [serverRunning, setServerRunning] = useState(false);
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Add log entry
  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setConnectionLogs((prev) => [
      ...prev.slice(-100),
      { time: new Date(), type, message },
    ]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [connectionLogs]);

  // Load saved RCON config
  useEffect(() => {
    const savedConfig = localStorage.getItem("rconConfig");
    if (savedConfig) {
      try {
        setRconConfig(JSON.parse(savedConfig));
        addLog("info", "Đã tải cấu hình RCON");
      } catch {}
    }

    // Load server exe path
    const savedExePath = localStorage.getItem("serverExePath");
    if (savedExePath) {
      setServerExePath(savedExePath);
    }
  }, [addLog]);

  // Fetch system stats - TEMPORARILY DISABLED
  const fetchSystemStats = useCallback(async () => {
    // try {
    //   const response = await axios.get("/api/system");
    //   setSystemStats(response.data);
    // } catch (error) {
    //   console.error("Failed to fetch system stats:", error);
    // }
  }, []);

  // Auto-refresh system stats every 5 seconds - TEMPORARILY DISABLED
  // useEffect(() => {
  //   fetchSystemStats();
  //   const interval = setInterval(fetchSystemStats, 5000);
  //   return () => clearInterval(interval);
  // }, [fetchSystemStats]);

  // Fetch server config (RAM allocation from StartServer64.bat) - TEMPORARILY DISABLED
  // useEffect(() => {
  //   if (serverPath) {
  //     axios
  //       .get("/api/server-config", { params: { serverPath } })
  //       .then((response) => setServerConfig(response.data))
  //       .catch((err) => console.error("Failed to fetch server config:", err));
  //   }
  // }, [serverPath]);

  // Poll server logs every 2 seconds - TEMPORARILY DISABLED
  // useEffect(() => {
  //   const fetchServerLogs = async () => {
  //     try {
  //       const response = await axios.get("/api/server-control");
  //       setServerRunning(response.data.running);
  //       setServerLogs(response.data.logs || []);
  //     } catch (error) {
  //       // Ignore errors
  //     }
  //   };
  //
  //   fetchServerLogs();
  //   const interval = setInterval(fetchServerLogs, 2000);
  //   return () => clearInterval(interval);
  // }, []);

  // Save RCON config
  const saveConfig = () => {
    localStorage.setItem("rconConfig", JSON.stringify(rconConfig));
    setShowConfig(false);
    addLog("info", `Đã lưu cấu hình: ${rconConfig.host}:${rconConfig.port}`);
    checkServerStatus();
  };

  // Check server status
  const checkServerStatus = useCallback(async () => {
    if (!rconConfig.password) {
      setStats((prev) => ({
        ...prev,
        status: "offline",
        error: "RCON password not configured",
      }));
      return;
    }

    addLog("info", `Đang kết nối đến ${rconConfig.host}:${rconConfig.port}...`);
    setStats((prev) => ({ ...prev, status: "checking" }));

    try {
      const startTime = Date.now();
      const response = await axios.get("/api/rcon", {
        params: {
          host: rconConfig.host,
          port: rconConfig.port,
          password: rconConfig.password,
        },
      });

      const elapsed = Date.now() - startTime;

      if (response.data.status === "online") {
        addLog(
          "success",
          `Đã kết nối trong ${response.data.responseTime || elapsed}ms`
        );
        addLog("info", `Người chơi online: ${response.data.players}`);
        if (response.data.playerList?.length > 0) {
          addLog(
            "info",
            `Danh sách người chơi: ${response.data.playerList.join(", ")}`
          );
        }
      } else {
        addLog("error", `Kết nối thất bại: ${response.data.error}`);
      }

      setStats({
        status: response.data.status === "online" ? "online" : "offline",
        players: response.data.players || 0,
        maxPlayers: 64,
        playerList: response.data.playerList || [],
        lastChecked: new Date(),
        responseTime: response.data.responseTime || elapsed,
        error: response.data.error,
      });
    } catch (error: any) {
      addLog("error", `Error: ${error.response?.data?.error || error.message}`);
      setStats((prev) => ({
        ...prev,
        status: "offline",
        lastChecked: new Date(),
        error: error.response?.data?.error || "Connection failed",
      }));
    }
  }, [rconConfig, addLog]);

  // Auto-check status only when online (every 60 seconds)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (rconConfig.password && stats.status === "online") {
      interval = setInterval(checkServerStatus, 60000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [stats.status, rconConfig.password, checkServerStatus]);

  // Execute RCON command
  const executeCommand = async (cmd: string) => {
    if (!cmd.trim() || !rconConfig.password) return;

    addLog("command", `$ ${cmd}`);
    setExecuting(true);

    try {
      const response = await axios.post("/api/rcon", {
        host: rconConfig.host,
        port: rconConfig.port,
        password: rconConfig.password,
        command: cmd,
      });

      const responseText = response.data.response || "Command executed";
      addLog("success", responseText);

      setCommandHistory((prev) =>
        [
          {
            command: cmd,
            response: responseText,
            time: new Date(),
          },
          ...prev,
        ].slice(0, 50)
      );

      setCommandInput("");

      // Refresh status after certain commands
      if (["players", "save", "quit"].includes(cmd.toLowerCase())) {
        setTimeout(checkServerStatus, 1000);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Command failed";
      addLog("error", `Error: ${errorMsg}`);

      setCommandHistory((prev) =>
        [
          {
            command: cmd,
            response: `Error: ${errorMsg}`,
            time: new Date(),
          },
          ...prev,
        ].slice(0, 50)
      );
    } finally {
      setExecuting(false);
    }
  };

  // Get server options
  const getServerOptions = async () => {
    addLog("info", "Đang lấy thông tin server...");
    await executeCommand("showoptions");
  };

  // Quick action handlers
  const quickActions = [
    {
      label: "Làm mới",
      icon: "lni-reload",
      color: "bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30",
      action: checkServerStatus,
    },
    {
      label: "Ngắt kết nối",
      icon: "lni-disconnect",
      color: "bg-red-500/20 text-red-400 hover:bg-red-500/30",
      action: () => {
        addLog("info", "Đã ngắt kết nối RCON");
        setStats((prev) => ({
          ...prev,
          status: "offline",
          error: "Đã ngắt kết nối thủ công",
          lastChecked: new Date(),
        }));
      },
    },
    /* Temporarily hidden as requested
        {
            label: 'Khởi động Server',
            icon: 'lni-play',
            color: 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
            action: async () => {
                if (!serverExePath) {
                    addLog('error', 'Chưa cấu hình đường dẫn StartServer64.bat. Vui lòng vào Cấu hình RCON để thiết lập.')
                    setShowConfig(true)
                    return
                }

                addLog('info', 'Đang khởi động server...')
                try {
                    const response = await axios.post('/api/server-control', {
                        action: 'start',
                        serverPath: serverExePath,
                    })
                    if (response.data.success) {
                        addLog('success', response.data.message)
                    } else {
                        addLog('error', response.data.error)
                    }
                } catch (error: any) {
                    addLog('error', `Lỗi: ${error.response?.data?.error || error.message}`)
                }
            },
        },
        */
  ];

  // Format bytes to human readable
  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const statCards = [
    {
      label: "Trạng thái Server",
      value:
        stats.status === "online"
          ? "Đang chạy"
          : stats.status === "checking"
          ? "Đang kiểm tra..."
          : "Tắt",
      icon: "lni-power-switch",
      color:
        stats.status === "online"
          ? "text-green-400"
          : stats.status === "checking"
          ? "text-yellow-400"
          : "text-red-400",
    },
    {
      label: "Người chơi Online",
      value: stats.status === "online" ? `${stats.players}` : "--",
      icon: "lni-users",
      color: "text-blue-400",
    },
    {
      label: "Thời gian phản hồi",
      value: stats.responseTime ? `${stats.responseTime}ms` : "--",
      icon: "lni-timer",
      color: "text-purple-400",
    },
    {
      label: "Kiểm tra lần cuối",
      value: stats.lastChecked ? stats.lastChecked.toLocaleTimeString() : "--",
      icon: "lni-calendar",
      color: "text-orange-400",
    },
    /* Temporarily hidden as requested
        {
            label: 'CPU Hệ thống',
            value: systemStats ? `${systemStats.cpu.usage}%` : '--',
            icon: 'lni-cpu',
            color: systemStats && systemStats.cpu.usage > 80 ? 'text-red-400' : systemStats && systemStats.cpu.usage > 50 ? 'text-yellow-400' : 'text-green-400',
            subtitle: systemStats ? `${systemStats.cpu.cores} cores` : undefined,
        },
        {
            label: 'RAM PZ Server',
            value: systemStats?.pzServer?.found
                ? `${systemStats.pzServer.memoryMB} MB`
                : (systemStats ? `${systemStats.memory.usagePercent}%` : '--'),
            icon: 'lni-harddrive',
            color: systemStats?.pzServer?.found
                ? (systemStats.pzServer.memoryPercent! > 50 ? 'text-yellow-400' : 'text-green-400')
                : (systemStats && systemStats.memory.usagePercent > 80 ? 'text-red-400' : 'text-green-400'),
            subtitle: systemStats?.pzServer?.found
                ? `${systemStats.pzServer.memoryPercent}% RAM | PID: ${systemStats.pzServer.pid}`
                : (systemStats ? `Hệ thống: ${formatBytes(systemStats.memory.used)} / ${formatBytes(systemStats.memory.total)}` : undefined),
        },
        {
            label: 'RAM Cấu hình',
            value: serverConfig?.maxMemory ? serverConfig.maxMemory : '--',
            icon: 'lni-memory',
            color: 'text-cyan-400',
            subtitle: serverConfig?.maxMemoryMB ? `Tối đa: ${serverConfig.maxMemoryMB} MB` : 'Từ StartServer64.bat',
        },
        */
  ];

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "command":
        return "text-yellow-400";
      default:
        return "text-zinc-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Tổng quan</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Giám sát và điều khiển server
          </p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl text-sm flex items-center gap-2"
        >
          <i className="lni lni-cog"></i>
          Cấu hình RCON
        </button>
      </div>

      {/* RCON Configuration Panel */}
      {showConfig && (
        <div className="space-y-4 animate-fade-in">
          {/* RCON Settings */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
            <h3 className="text-white font-medium mb-4">Cấu hình RCON</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-zinc-400 text-sm mb-2">
                  Máy chủ
                </label>
                <input
                  type="text"
                  value={rconConfig.host}
                  onChange={(e) =>
                    setRconConfig((prev) => ({ ...prev, host: e.target.value }))
                  }
                  className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg border border-zinc-600 focus:outline-none focus:border-zinc-500"
                  placeholder="127.0.0.1"
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-sm mb-2">Cổng</label>
                <input
                  type="number"
                  value={rconConfig.port}
                  onChange={(e) =>
                    setRconConfig((prev) => ({
                      ...prev,
                      port: parseInt(e.target.value) || 27015,
                    }))
                  }
                  className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg border border-zinc-600 focus:outline-none focus:border-zinc-500"
                  placeholder="27015"
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-sm mb-2">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  value={rconConfig.password}
                  onChange={(e) =>
                    setRconConfig((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg border border-zinc-600 focus:outline-none focus:border-zinc-500"
                  placeholder="Mật khẩu RCON"
                />
              </div>
            </div>
          </div>

          {/* Server Executable Path - Temporarily Hidden
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
                        <h3 className="text-white font-medium mb-4">Cấu hình Khởi động</h3>
                        <div>
                            <label className="block text-zinc-400 text-sm mb-2">
                                <i className="lni lni-folder mr-1"></i>
                                Đường dẫn StartServer64.bat
                            </label>
                            <input
                                type="text"
                                value={serverExePath}
                                onChange={(e) => setServerExePath(e.target.value)}
                                className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg border border-zinc-600 focus:outline-none focus:border-zinc-500 font-mono text-sm"
                                placeholder="Ví dụ: F:\servers\Project Zomboid Dedicated Server"
                            />
                            <p className="text-zinc-500 text-xs mt-1">Thư mục chứa file StartServer64.bat để khởi động server</p>
                        </div>
                    </div>
                    */}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                saveConfig();
                localStorage.setItem("serverExePath", serverExePath);
                addLog("info", `Đã lưu đường dẫn server: ${serverExePath}`);
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm"
            >
              Lưu & Kết nối
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 hover:border-zinc-600 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">{card.label}</span>
              <i className={`lni ${card.icon} ${card.color}`}></i>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            {/* Subtitle hidden - no current cards use it */}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-white font-medium mb-3">Thao tác nhanh</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className={`
                flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                transition-all duration-200 font-medium text-sm
                ${action.color}
                ${
                  !rconConfig.password && index > 0
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }
              `}
              onClick={action.action}
              disabled={!rconConfig.password && index > 0}
            >
              <i className={`lni ${action.icon}`}></i>
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Connection Logs */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium">
            <i className="lni lni-pulse mr-2"></i>
            Nhật ký kết nối
          </h3>
          <button
            onClick={() => setConnectionLogs([])}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Xóa
          </button>
        </div>
        <div className="bg-black/50 rounded-lg p-3 font-mono text-xs h-40 overflow-y-auto">
          {connectionLogs.length === 0 ? (
            <div className="text-zinc-500 text-center py-4">
              Chưa có nhật ký. Nhấn Làm mới để kiểm tra trạng thái server.
            </div>
          ) : (
            connectionLogs.map((log, idx) => (
              <div
                key={idx}
                className={`${getLogColor(log.type)} leading-relaxed`}
              >
                <span className="text-zinc-600">
                  [{log.time.toLocaleTimeString()}]
                </span>{" "}
                {log.message}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Server Console */}
      {serverLogs.length > 0 && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <i className="lni lni-terminal mr-2"></i>
              Console Server
              {serverRunning && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                  Đang chạy
                </span>
              )}
            </h3>
            <button
              onClick={async () => {
                try {
                  await axios.post("/api/server-control", { action: "stop" });
                  addLog("info", "Đã gửi lệnh dừng server");
                } catch (error: any) {
                  addLog(
                    "error",
                    `Lỗi: ${error.response?.data?.error || error.message}`
                  );
                }
              }}
              className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs"
              disabled={!serverRunning}
            >
              <i className="lni lni-stop mr-1"></i>
              Dừng Server
            </button>
          </div>
          <div className="bg-black rounded-lg p-3 font-mono text-xs h-64 overflow-y-auto">
            {serverLogs.map((log, idx) => (
              <div
                key={idx}
                className={`leading-relaxed ${
                  log.includes("[ERROR]") ? "text-red-400" : "text-green-400"
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player List */}
      {stats.status === "online" && stats.playerList.length > 0 && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">
            <i className="lni lni-users mr-2"></i>
            Người chơi đang online ({stats.players})
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.playerList.map((player, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-zinc-700 text-white text-sm rounded-lg"
              >
                {player}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* RCON Console */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
        <h3 className="text-white font-medium mb-4">
          <i className="lni lni-terminal mr-2"></i>
          Bảng điều khiển RCON
        </h3>

        {/* Command Input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && executeCommand(commandInput)}
            placeholder="Nhập lệnh RCON (ví dụ: players, save, servermsg 'Xin chào')..."
            className="flex-1 px-4 py-2 bg-black/50 text-white rounded-lg border border-zinc-600 focus:outline-none focus:border-zinc-500 font-mono text-sm"
            disabled={!rconConfig.password}
          />
          <button
            onClick={() => executeCommand(commandInput)}
            disabled={executing || !rconConfig.password || !commandInput.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm"
          >
            {executing ? (
              <i className="lni lni-spinner lni-is-spinning"></i>
            ) : (
              "Thực thi"
            )}
          </button>
        </div>

        {/* Command History */}
        <div className="bg-black/50 rounded-lg p-4 font-mono text-sm max-h-64 overflow-y-auto">
          {commandHistory.length === 0 ? (
            <div className="text-zinc-500 text-center py-4">
              {rconConfig.password
                ? "Nhập lệnh ở trên để bắt đầu..."
                : "Cấu hình RCON để sử dụng console"}
            </div>
          ) : (
            commandHistory.map((entry, idx) => (
              <div key={idx} className="mb-3 last:mb-0">
                <div className="text-green-400">
                  <span className="text-zinc-500">
                    [{entry.time.toLocaleTimeString()}]
                  </span>{" "}
                  $ {entry.command}
                </div>
                <div className="text-zinc-300 pl-4 whitespace-pre-wrap">
                  {entry.response}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
