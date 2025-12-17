export interface ServerSettings {
  [key: string]: string | number | boolean
}

export interface Mod {
  id: string
  name: string
  workshopId?: string
  details?: ModDetails
}

export interface ModDetails {
  id: string
  title: string
  description: string
  preview_url?: string
  preview_image?: string
  file_size?: number
  time_created?: number
  time_updated?: number
  subscriptions?: number
  favorited?: number
  creator?: string
  tags?: Array<{ tag: string }>
  result?: number
}

export interface SteamWorkshopItem {
  publishedfileid: string
  title: string
  description: string
  preview_url?: string
  file_size?: number
  time_created?: number
  time_updated?: number
  subscriptions?: number
  favorited?: number
}

export interface SteamWorkshopSearchResult {
  total: number
  publishedfileids: string[]
  result: number
  resultcount: number
}

