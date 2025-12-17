import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const link = searchParams.get('link')

    if (!link) {
      return NextResponse.json(
        { error: 'Link is required' },
        { status: 400 }
      )
    }

    // Parse các format link Steam Workshop:
    // https://steamcommunity.com/sharedfiles/filedetails/?id=123456789
    // https://steamcommunity.com/sharedfiles/filedetails/?id=123456789&searchtext=...
    // steam://url/CommunityFilePage/123456789
    // 123456789 (chỉ số)

    let workshopId: string | null = null

    // Nếu chỉ là số, đó là workshop ID
    if (/^\d+$/.test(link.trim())) {
      workshopId = link.trim()
    } else {
      // Parse từ URL
      try {
        const url = new URL(link)
        
        // Format: https://steamcommunity.com/sharedfiles/filedetails/?id=123456789
        if (url.hostname.includes('steamcommunity.com')) {
          const idParam = url.searchParams.get('id')
          if (idParam && /^\d+$/.test(idParam)) {
            workshopId = idParam
          }
        }
        
        // Format: steam://url/CommunityFilePage/123456789
        if (url.protocol === 'steam:') {
          const pathParts = url.pathname.split('/')
          const idPart = pathParts[pathParts.length - 1]
          if (idPart && /^\d+$/.test(idPart)) {
            workshopId = idPart
          }
        }
      } catch (e) {
        // Nếu không phải URL hợp lệ, thử extract số từ string
        const match = link.match(/\d{8,}/) // Tìm số có ít nhất 8 chữ số (workshop ID thường dài)
        if (match) {
          workshopId = match[0]
        }
      }
    }

    if (!workshopId) {
      return NextResponse.json(
        { error: 'Could not extract Workshop ID from link' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      workshopId: workshopId,
      originalLink: link,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}





