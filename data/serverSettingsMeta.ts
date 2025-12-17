export type SettingType = 'string' | 'integer' | 'boolean' | 'port' | 'list'

export type SettingMeta = {
  key: string
  label: string
  description?: string
  type: SettingType
  defaultValue?: string | number | boolean
}

// Danh sách các key phổ biến từ tài liệu Project Zomboid
// Tham khảo: https://pzwiki.net/wiki/Server_settings#servertest.ini
export const COMMON_SETTINGS: SettingMeta[] = [
  // ===== Server Info =====
  {
    key: 'ServerName',
    label: 'Server Name',
    description: 'Tên nội bộ của server (không hiển thị public).',
    type: 'string',
    defaultValue: 'servertest',
  },
  {
    key: 'PublicName',
    label: 'Public Name',
    description: 'Tên hiển thị trên danh sách server public.',
    type: 'string',
    defaultValue: 'My PZ Server',
  },
  {
    key: 'PublicDescription',
    label: 'Public Description',
    description: 'Mô tả ngắn hiển thị trên danh sách server.',
    type: 'string',
    defaultValue: '',
  },
  {
    key: 'Password',
    label: 'Password',
    description: 'Mật khẩu để join server (để trống nếu không cần).',
    type: 'string',
    defaultValue: '',
  },
  {
    key: 'MaxPlayers',
    label: 'Max Players',
    description: 'Số người chơi tối đa có thể join server.',
    type: 'integer',
    defaultValue: 32,
  },
  {
    key: 'Public',
    label: 'Public',
    description: 'Hiển thị server trên danh sách public.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'Open',
    label: 'Open',
    description: 'Cho phép người chơi mới tạo account.',
    type: 'boolean',
    defaultValue: true,
  },

  // ===== Network Ports =====
  {
    key: 'DefaultPort',
    label: 'Default Port',
    description: 'Port UDP chính của server.',
    type: 'port',
    defaultValue: 16261,
  },
  {
    key: 'UDPPort',
    label: 'UDP Port',
    description: 'Port UDP cho game traffic.',
    type: 'port',
    defaultValue: 16262,
  },
  {
    key: 'SteamPort1',
    label: 'Steam Port 1',
    description: 'Port UDP Steam (Steam query).',
    type: 'port',
    defaultValue: 8766,
  },
  {
    key: 'SteamPort2',
    label: 'Steam Port 2',
    description: 'Port UDP thứ 2 cho Steam.',
    type: 'port',
    defaultValue: 8767,
  },
  {
    key: 'RCONPort',
    label: 'RCON Port',
    description: 'Port RCON cho remote console.',
    type: 'port',
    defaultValue: 27015,
  },
  {
    key: 'RCONPassword',
    label: 'RCON Password',
    description: 'Mật khẩu RCON (để trống = RCON tắt).',
    type: 'string',
    defaultValue: '',
  },

  // ===== World Settings =====
  {
    key: 'Map',
    label: 'Map',
    description: 'Tên map để load (ví dụ: Muldraugh, KY).',
    type: 'string',
    defaultValue: 'Muldraugh, KY',
  },
  {
    key: 'Mods',
    label: 'Mods',
    description: 'Danh sách mod IDs (phân tách bằng ;).',
    type: 'list',
    defaultValue: '',
  },
  {
    key: 'WorkshopItems',
    label: 'Workshop Items',
    description: 'Danh sách Steam Workshop IDs (phân tách bằng ;).',
    type: 'list',
    defaultValue: '',
  },
  {
    key: 'SaveWorldEveryMinutes',
    label: 'Save World Every Minutes',
    description: 'Khoảng thời gian (phút) auto-save server.',
    type: 'integer',
    defaultValue: 0,
  },
  {
    key: 'SpawnPoint',
    label: 'Spawn Point',
    description: 'Tọa độ spawn mặc định (x,y,z).',
    type: 'string',
    defaultValue: '0,0,0',
  },
  {
    key: 'PauseEmpty',
    label: 'Pause Empty',
    description: 'Tạm dừng khi không có người chơi.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'ResetID',
    label: 'Reset ID',
    description: 'ID để force client re-download world.',
    type: 'integer',
    defaultValue: 0,
  },

  // ===== PVP & Safety =====
  {
    key: 'PVP',
    label: 'PVP',
    description: 'Bật/tắt PVP (Player vs Player).',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'SafetySystem',
    label: 'Safety System',
    description: 'Bật hệ thống an toàn (PVP toggle cho từng người).',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'ShowSafety',
    label: 'Show Safety',
    description: 'Hiển thị trạng thái an toàn trên HUD.',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'SafetyToggleTimer',
    label: 'Safety Toggle Timer',
    description: 'Thời gian (giây) chờ để bật/tắt safety.',
    type: 'integer',
    defaultValue: 2,
  },
  {
    key: 'SafetyCooldownTimer',
    label: 'Safety Cooldown Timer',
    description: 'Thời gian cooldown (giờ) giữa các lần toggle safety.',
    type: 'integer',
    defaultValue: 3,
  },

  // ===== Safehouse Settings =====
  {
    key: 'PlayerSafehouse',
    label: 'Player Safehouse',
    description: 'Cho phép người chơi claim safehouse.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'AdminSafehouse',
    label: 'Admin Safehouse',
    description: 'Chỉ admin được claim safehouse.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'SafehouseAllowTrepass',
    label: 'Safehouse Allow Trespass',
    description: 'Cho phép xâm nhập safehouse của người khác.',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'SafehouseAllowFire',
    label: 'Safehouse Allow Fire',
    description: 'Cho phép đốt/châm lửa trong safehouse.',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'SafehouseAllowLoot',
    label: 'Safehouse Allow Loot',
    description: 'Cho phép loot trong safehouse của người khác.',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'SafehouseAllowRespawn',
    label: 'Safehouse Allow Respawn',
    description: 'Cho phép respawn trong safehouse.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'SafehouseDaySurvivedToClaim',
    label: 'Days Survived To Claim',
    description: 'Số ngày phải sống sót để claim safehouse.',
    type: 'integer',
    defaultValue: 0,
  },
  {
    key: 'SafeHouseRemovalTime',
    label: 'Safe House Removal Time',
    description: 'Số ngày không hoạt động trước khi xóa safehouse.',
    type: 'integer',
    defaultValue: 144,
  },

  // ===== Loot Settings =====
  {
    key: 'HoursForLootRespawn',
    label: 'Hours For Loot Respawn',
    description: 'Số giờ trong game để loot respawn (0 = tắt).',
    type: 'integer',
    defaultValue: 0,
  },
  {
    key: 'MaxItemsForLootRespawn',
    label: 'Max Items For Loot Respawn',
    description: 'Số item tối đa trong container trước khi ngừng respawn.',
    type: 'integer',
    defaultValue: 4,
  },
  {
    key: 'ConstructionPreventsLootRespawn',
    label: 'Construction Prevents Loot Respawn',
    description: 'Công trình của người chơi ngăn loot respawn gần đó.',
    type: 'boolean',
    defaultValue: true,
  },

  // ===== Fire Settings =====
  {
    key: 'NoFire',
    label: 'No Fire',
    description: 'Vô hiệu hóa lửa hoàn toàn.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'NoFireSpread',
    label: 'No Fire Spread',
    description: 'Tắt lây lan lửa.',
    type: 'boolean',
    defaultValue: false,
  },

  // ===== Voice Chat =====
  {
    key: 'VoiceEnable',
    label: 'Voice Enable',
    description: 'Bật voice chat.',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'VoiceMinDistance',
    label: 'Voice Min Distance',
    description: 'Khoảng cách tối thiểu nghe voice (tiles).',
    type: 'integer',
    defaultValue: 10,
  },
  {
    key: 'VoiceMaxDistance',
    label: 'Voice Max Distance',
    description: 'Khoảng cách tối đa nghe voice (tiles).',
    type: 'integer',
    defaultValue: 100,
  },
  {
    key: 'Voice3D',
    label: 'Voice 3D',
    description: 'Bật âm thanh 3D cho voice chat.',
    type: 'boolean',
    defaultValue: true,
  },

  // ===== Sleep Settings =====
  {
    key: 'SleepAllowed',
    label: 'Sleep Allowed',
    description: 'Cho phép ngủ trên server.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'SleepNeeded',
    label: 'Sleep Needed',
    description: 'Bắt buộc phải ngủ (cần SleepAllowed=true).',
    type: 'boolean',
    defaultValue: false,
  },

  // ===== Misc Settings =====
  {
    key: 'DisplayUserName',
    label: 'Display User Name',
    description: 'Hiển thị tên người chơi trên đầu.',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'ShowFirstAndLastName',
    label: 'Show First And Last Name',
    description: 'Hiển thị tên nhân vật thay vì username.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'SpawnItems',
    label: 'Spawn Items',
    description: 'Items spawn theo người chơi mới (phân tách bằng ,).',
    type: 'list',
    defaultValue: '',
  },
  {
    key: 'AnnounceDeath',
    label: 'Announce Death',
    description: 'Thông báo khi người chơi chết.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'GlobalChat',
    label: 'Global Chat',
    description: 'Bật global chat.',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'ChatStreams',
    label: 'Chat Streams',
    description: 'Các kênh chat được bật (s=local, r=radio, a=admin, w=whisper, f=faction, g=global).',
    type: 'string',
    defaultValue: 's,r,a,w,y,sh,f,all',
  },
  {
    key: 'ServerWelcomeMessage',
    label: 'Server Welcome Message',
    description: 'Tin nhắn chào mừng khi join server (hỗ trợ HTML).',
    type: 'string',
    defaultValue: 'Welcome to Project Zomboid Multiplayer!',
  },
  {
    key: 'AllowDestructionBySledgehammer',
    label: 'Allow Destruction By Sledgehammer',
    description: 'Cho phép phá hủy bằng búa tạ.',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'AllowNonAsciiUsername',
    label: 'Allow Non-ASCII Username',
    description: 'Cho phép username có ký tự đặc biệt.',
    type: 'boolean',
    defaultValue: false,
  },
]
