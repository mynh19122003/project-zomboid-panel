import { NextRequest, NextResponse } from 'next/server'

const STEAM_API_KEY = process.env.STEAM_API_KEY || ''
const STEAM_WORKSHOP_API = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/'

export async function POST(request: NextRequest) {
  try {
    if (!STEAM_API_KEY) {
      return NextResponse.json(
        { error: 'Steam API key is not configured' },
        { status: 500 }
      )
    }

    const { modIds } = await request.json()

    if (!modIds || !Array.isArray(modIds) || modIds.length === 0) {
      return NextResponse.json(
        { error: 'Mod IDs array is required' },
        { status: 400 }
      )
    }

    // Lọc chỉ lấy workshop IDs (chỉ chứa số)
    const workshopIds = modIds.filter(id => /^\d+$/.test(String(id)))

    if (workshopIds.length === 0) {
      return NextResponse.json({ mods: [] })
    }

    // Lấy thông tin chi tiết từ Steam Workshop API
    const formData = new URLSearchParams()
    formData.append('key', STEAM_API_KEY)
    formData.append('itemcount', workshopIds.length.toString())
    workshopIds.forEach((id, index) => {
      formData.append(`publishedfileids[${index}]`, String(id))
    })

    const response = await fetch(STEAM_WORKSHOP_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Steam API request failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // Log để debug
    console.log('Steam API Response:', JSON.stringify(data, null, 2))

    // Parse response từ Steam API
    const modDetails: Record<string, any> = {}
    
    if (data.response?.publishedfiledetails) {
      data.response.publishedfiledetails.forEach((detail: any) => {
        if (detail.publishedfileid) {
          // Steam API trả về preview_url trong preview_url field
          // Nếu không có, thử các cách khác để lấy preview image
          let previewUrl = detail.preview_url || detail.preview || ''
          
          // Nếu không có preview_url từ API, thử tạo URL preview image từ publishedfileid
          // Steam Workshop preview image URL format: https://steamuserimages-a.akamaihd.net/ugc/{hash}/
          // Hoặc có thể dùng: https://steamcommunity.com/sharedfiles/filedetails/?id={id}
          // Nhưng tốt nhất là dùng preview_url từ API
          
          // Nếu vẫn không có, thử tạo URL từ file details page (không phải image trực tiếp)
          // Note: Điều này không hoạt động tốt, nhưng có thể dùng làm fallback
          if (!previewUrl && detail.publishedfileid) {
            // Không tạo URL giả, để component xử lý
            previewUrl = ''
          }

          // Parse Mod ID từ description
          // Format thường gặp trong Steam Workshop:
          // "-- \BB_CommonSense;\CSB42MP" (Mod IDs)
          // "-- 2875848298;3623609320" (Workshop IDs)
          // Hoặc: "Mod ID: ModName"
          let modId = ''
          const description = detail.description || ''
          
          // Pattern 1: Tìm format "-- \ModName" hoặc "-- ModName" (dòng ngay trước workshop IDs)
          // Thường xuất hiện như: "-- \BB_CommonSense;\CSB42MP\n-- 2875848298;3623609320"
          const dedicatedServerPattern = /--\s*\\?([A-Za-z_][A-Za-z0-9_;\\]*?)(?:\s*\n\s*--\s*\d)/
          const dedicatedMatch = description.match(dedicatedServerPattern)
          if (dedicatedMatch && dedicatedMatch[1]) {
            // Lấy mod ID đầu tiên (có thể có nhiều mod, cách nhau bằng ;)
            const modIds = dedicatedMatch[1].replace(/\\/g, '').split(';').filter(Boolean)
            if (modIds.length > 0) {
              modId = modIds[0].trim()
              console.log(`Found Mod ID "${modId}" from dedicated server format for workshop item ${detail.publishedfileid}`)
            }
          }
          
          // Pattern 2: Nếu không tìm thấy, thử các pattern khác
          if (!modId) {
            const modIdPatterns = [
              /Mod\s*ID[:\s]+([A-Za-z_][A-Za-z0-9_]*)/i,
              /ModID[:\s]+([A-Za-z_][A-Za-z0-9_]*)/i,
              /Mod_ID[:\s]+([A-Za-z_][A-Za-z0-9_]*)/i,
            ]
            
            for (const pattern of modIdPatterns) {
              const match = description.match(pattern)
              if (match && match[1]) {
                modId = match[1].trim()
                console.log(`Found Mod ID "${modId}" for workshop item ${detail.publishedfileid}`)
                break
              }
            }
          }

          modDetails[detail.publishedfileid] = {
            id: detail.publishedfileid,
            modId: modId, // Mod ID được parse từ description
            title: detail.title || detail.publishedfileid,
            description: detail.description || '',
            preview_url: previewUrl,
            // Thử các field khác nhau cho preview image
            preview_image: detail.preview_url || detail.preview || '',
            file_size: detail.file_size || 0,
            time_created: detail.time_created || 0,
            time_updated: detail.time_updated || 0,
            subscriptions: detail.subscriptions || 0,
            favorited: detail.favorited || 0,
            creator: detail.creator || '',
            tags: detail.tags || [],
            result: detail.result, // Steam API result code
          }
        }
      })
    }

    // Log kết quả
    console.log('Parsed mod details:', Object.keys(modDetails).length, 'mods')

    return NextResponse.json({ 
      mods: modDetails,
      rawResponse: data.response // Thêm raw response để debug
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

