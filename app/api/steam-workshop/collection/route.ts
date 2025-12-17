import { NextRequest, NextResponse } from 'next/server'

const STEAM_API_KEY = process.env.STEAM_API_KEY || ''
const STEAM_WORKSHOP_API = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/'
const STEAM_COLLECTION_API = 'https://api.steampowered.com/ISteamRemoteStorage/GetCollectionDetails/v1/'

// Parse collection ID từ link
function parseCollectionId(link: string): string | null {
  try {
    // Format: https://steamcommunity.com/sharedfiles/filedetails/?id=COLLECTION_ID
    if (/^\d+$/.test(link.trim())) {
      return link.trim()
    }

    const url = new URL(link)
    if (url.hostname.includes('steamcommunity.com')) {
      const idParam = url.searchParams.get('id')
      if (idParam && /^\d+$/.test(idParam)) {
        return idParam
      }
    }

    // Thử extract số từ string
    const match = link.match(/\d{8,}/)
    if (match) {
      return match[0]
    }

    return null
  } catch (e) {
    return null
  }
}

// Lấy collection details từ Steam (scrape hoặc API)
async function getCollectionItems(collectionId: string): Promise<string[]> {
  try {
    // Steam Collection page URL
    const collectionUrl = `https://steamcommunity.com/sharedfiles/filedetails/?id=${collectionId}`
    
    console.log('Fetching collection from:', collectionUrl)
    
    // Fetch HTML page
    const response = await fetch(collectionUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch collection: ${response.status}`)
    }

    const html = await response.text()
    console.log('HTML length:', html.length)
    
    const itemIdsSet = new Set<string>()
    
    // Pattern 1: Tìm trong JavaScript data - "publishedfileid":"123456789"
    const pattern1 = /"publishedfileid"\s*:\s*"(\d+)"/g
    let match
    let count1 = 0
    while ((match = pattern1.exec(html)) !== null) {
      const itemId = match[1]
      if (itemId !== collectionId && itemId.length >= 8) {
        itemIdsSet.add(itemId)
        count1++
      }
    }
    console.log('Pattern 1 found:', count1, 'unique items')

    // Pattern 2: Tìm trong rgPublishedFileIds array hoặc các biến JavaScript tương tự
    const pattern2Variants = [
      /rgPublishedFileIds\s*=\s*\[([\s\S]*?)\]/,
      /g_rgPublishedFileIds\s*=\s*\[([\s\S]*?)\]/,
      /publishedFileIds\s*:\s*\[([\s\S]*?)\]/,
      /"publishedfileids"\s*:\s*\[([\s\S]*?)\]/,
    ]
    
    for (const pattern2 of pattern2Variants) {
      const match2 = html.match(pattern2)
      if (match2) {
        const idsString = match2[1]
        const ids = idsString.match(/\d{8,}/g) || []
        let count2 = 0
        ids.forEach(id => {
          if (id !== collectionId && !itemIdsSet.has(id)) {
            itemIdsSet.add(id)
            count2++
          }
        })
        if (count2 > 0) {
          console.log('Pattern 2 variant found:', count2, 'additional items')
        }
      }
    }

    // Pattern 3: Tìm trong data attributes - data-publishedfileid="123456789"
    const pattern3 = /data-publishedfileid\s*=\s*"(\d+)"/g
    let count3 = 0
    while ((match = pattern3.exec(html)) !== null) {
      const itemId = match[1]
      if (itemId !== collectionId && itemId.length >= 8 && !itemIdsSet.has(itemId)) {
        itemIdsSet.add(itemId)
        count3++
      }
    }
    if (count3 > 0) {
      console.log('Pattern 3 found:', count3, 'additional items')
    }

    // Pattern 4: Tìm trong href links - /sharedfiles/filedetails/?id=123456789
    // Nhưng chỉ lấy những links trong phần collection items, không phải tất cả links
    const pattern4 = /\/sharedfiles\/filedetails\/\?id=(\d{8,})/g
    let count4 = 0
    while ((match = pattern4.exec(html)) !== null) {
      const itemId = match[1]
      if (itemId !== collectionId && !itemIdsSet.has(itemId)) {
        itemIdsSet.add(itemId)
        count4++
      }
    }
    if (count4 > 0) {
      console.log('Pattern 4 found:', count4, 'additional items')
    }

    // Pattern 5: Tìm trong JSON data embedded trong HTML - tìm tất cả objects
    const jsonPattern = /\{[^}]{0,500}"publishedfileid"\s*:\s*"(\d{8,})"[^}]{0,500}\}/g
    let count5 = 0
    while ((match = jsonPattern.exec(html)) !== null) {
      const jsonMatch = match[0].match(/"publishedfileid"\s*:\s*"(\d{8,})"/)
      if (jsonMatch) {
        const itemId = jsonMatch[1]
        if (itemId !== collectionId && !itemIdsSet.has(itemId)) {
          itemIdsSet.add(itemId)
          count5++
        }
      }
    }
    if (count5 > 0) {
      console.log('Pattern 5 found:', count5, 'additional items')
    }

    // Pattern 6: Tìm trong JavaScript arrays - [123456789, 987654321]
    // Tìm arrays chứa nhiều số dài (workshop IDs)
    const arrayPattern = /\[\s*(\d{8,}(?:\s*,\s*\d{8,}){5,})\s*\]/g  // Ít nhất 6 số
    let count6 = 0
    while ((match = arrayPattern.exec(html)) !== null) {
      const idsString = match[1]
      const ids = idsString.split(',').map(id => id.trim()).filter(id => /^\d{8,}$/.test(id))
      ids.forEach(id => {
        if (id !== collectionId && !itemIdsSet.has(id)) {
          itemIdsSet.add(id)
          count6++
        }
      })
    }
    if (count6 > 0) {
      console.log('Pattern 6 found:', count6, 'additional items')
    }

    // Pattern 7: Tìm trong HTML comments hoặc script tags với format đặc biệt
    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi
    let count7 = 0
    let scriptMatch
    while ((scriptMatch = scriptPattern.exec(html)) !== null) {
      const scriptContent = scriptMatch[1]
      // Tìm các số dài trong script (có thể là workshop IDs)
      const idInScript = scriptContent.match(/\b(\d{9,10})\b/g)
      if (idInScript) {
        idInScript.forEach(id => {
          if (id !== collectionId && !itemIdsSet.has(id)) {
            itemIdsSet.add(id)
            count7++
          }
        })
      }
    }
    if (count7 > 0) {
      console.log('Pattern 7 found:', count7, 'additional items')
    }

    // Convert Set to Array và loại bỏ collection ID
    const itemIds = Array.from(itemIdsSet).filter(id => id !== collectionId)
    
    console.log('Final item IDs:', itemIds.length)
    console.log('First 10 IDs:', itemIds.slice(0, 10))
    console.log('Last 10 IDs:', itemIds.slice(-10))

    return itemIds
  } catch (error: any) {
    console.error('Error fetching collection:', error)
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!STEAM_API_KEY) {
      return NextResponse.json(
        { error: 'Steam API key is not configured' },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const collectionLink = searchParams.get('link')

    if (!collectionLink) {
      return NextResponse.json(
        { error: 'Collection link is required' },
        { status: 400 }
      )
    }

    // Parse collection ID
    const collectionId = parseCollectionId(collectionLink)
    if (!collectionId) {
      return NextResponse.json(
        { error: 'Could not extract collection ID from link' },
        { status: 400 }
      )
    }

    // Thử lấy collection items từ Steam API trước
    let itemIds: string[] = []
    
    // Cách 1: Thử dùng Steam Web API (nếu hỗ trợ)
    try {
      const formData = new URLSearchParams()
      formData.append('key', STEAM_API_KEY)
      formData.append('collectioncount', '1')
      formData.append('publishedfileids[0]', collectionId)

      const apiResponse = await fetch(STEAM_COLLECTION_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      })

      if (apiResponse.ok) {
        const apiData = await apiResponse.json()
        console.log('Steam API response:', JSON.stringify(apiData, null, 2))
        
        // Parse response từ Steam Collection API
        if (apiData.response?.collectiondetails) {
          const collection = apiData.response.collectiondetails[0]
          if (collection?.children) {
            collection.children.forEach((child: any) => {
              if (child.publishedfileid && !itemIds.includes(child.publishedfileid)) {
                itemIds.push(child.publishedfileid)
              }
            })
          }
        }
      }
    } catch (apiError) {
      console.log('Steam Collection API not available, trying HTML parsing...')
    }

    // Cách 2: Nếu API không có, parse từ HTML
    if (itemIds.length === 0) {
      try {
        itemIds = await getCollectionItems(collectionId)
        console.log('HTML parsing found:', itemIds.length, 'items')
      } catch (error: any) {
        console.error('Error getting collection items from HTML:', error)
        return NextResponse.json(
          { 
            error: `Không thể lấy danh sách mod từ collection: ${error.message}`,
            collectionId: collectionId,
            hint: 'Collection có thể là private, cần đăng nhập, hoặc Steam đã thay đổi cấu trúc HTML. Hãy thử collection public khác.'
          },
          { status: 500 }
        )
      }
    }

    if (itemIds.length === 0) {
      return NextResponse.json(
        { 
          error: 'Collection trống hoặc không thể parse được.',
          collectionId: collectionId,
          hint: 'Collection có thể là private, cần đăng nhập, hoặc không có mods. Hãy đảm bảo collection là public và có mods bên trong.'
        },
        { status: 404 }
      )
    }

    // Lấy thông tin chi tiết của các items
    // Steam API có giới hạn số items mỗi request (thường là 100), cần chia nhỏ
    const MAX_ITEMS_PER_REQUEST = 100
    const items: any[] = []
    
    // Chia itemIds thành các batch
    for (let i = 0; i < itemIds.length; i += MAX_ITEMS_PER_REQUEST) {
      const batch = itemIds.slice(i, i + MAX_ITEMS_PER_REQUEST)
      console.log(`Fetching batch ${Math.floor(i / MAX_ITEMS_PER_REQUEST) + 1}: ${batch.length} items`)
      
      const formData = new URLSearchParams()
      formData.append('key', STEAM_API_KEY)
      formData.append('itemcount', batch.length.toString())
      batch.forEach((id, index) => {
        formData.append(`publishedfileids[${index}]`, id)
      })

      const response = await fetch(STEAM_WORKSHOP_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      })

      if (!response.ok) {
        console.error(`Steam API request failed for batch: ${response.status}`)
        continue // Bỏ qua batch này, tiếp tục với batch khác
      }

      const data = await response.json()

      // Parse response
      if (data.response?.publishedfiledetails) {
        data.response.publishedfiledetails.forEach((detail: any) => {
          if (detail.publishedfileid) {
            items.push({
              publishedfileid: detail.publishedfileid,
              title: detail.title || detail.publishedfileid,
              description: detail.description || '',
              preview_url: detail.preview_url || '',
              file_size: detail.file_size || 0,
              subscriptions: detail.subscriptions || 0,
              favorited: detail.favorited || 0,
              time_created: detail.time_created || 0,
              time_updated: detail.time_updated || 0,
            })
          }
        })
      }
    }
    
    console.log(`Successfully fetched details for ${items.length} out of ${itemIds.length} items`)

    return NextResponse.json({
      success: true,
      collectionId: collectionId,
      items: items,
      total: items.length,
    })
  } catch (error: any) {
    console.error('Collection API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch collection' },
      { status: 500 }
    )
  }
}

