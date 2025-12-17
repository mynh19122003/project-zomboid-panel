import { NextRequest, NextResponse } from 'next/server'

const STEAM_API_KEY = process.env.STEAM_API_KEY || ''
const STEAM_WORKSHOP_API = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/'
const STEAM_WORKSHOP_SEARCH = 'https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/'

// Tính điểm popularity dựa trên nhiều yếu tố
function calculatePopularityScore(item: any): number {
  const subscriptions = item.subscriptions || item.lifetime_subscriptions || 0
  const favorites = item.favorited || item.lifetime_favorited || 0
  const voteUp = item.vote_data?.votes_up || 0
  const voteDown = item.vote_data?.votes_down || 0

  // Tính tỉ lệ vote positive
  const totalVotes = voteUp + voteDown
  const voteRatio = totalVotes > 0 ? voteUp / totalVotes : 0.5

  // Score = log(subscriptions) * voteRatio * (1 + favorites/1000)
  const score = Math.log10(subscriptions + 1) * voteRatio * (1 + favorites / 1000)

  return Math.round(score * 100) / 100
}

export async function GET(request: NextRequest) {
  try {
    if (!STEAM_API_KEY) {
      return NextResponse.json(
        { error: 'Steam API key is not configured. Please set STEAM_API_KEY in .env.local' },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')
    const query = searchParams.get('query')
    const fileIds = searchParams.get('fileIds')

    if (action === 'search') {
      if (!query) {
        return NextResponse.json(
          { error: 'Query is required for search' },
          { status: 400 }
        )
      }

      // Lấy các tham số sắp xếp và lọc
      const sortBy = searchParams.get('sortBy') || 'subscriptions' // subscriptions, trending, updated
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

      // Tìm kiếm mod trên Steam Workshop
      // Project Zomboid App ID: 108600
      // query_type values:
      // 0 = RankedByVote
      // 1 = RankedByPublicationDate 
      // 2 = AcceptedForGameRankedByAcceptanceDate
      // 3 = RankedByTrend
      // 9 = RankedByTotalVotesAsc
      // 11 = RankedByTotalUniqueSubscriptions
      // 12 = RankedByTextSearch

      let queryType = '12' // Default: text search
      if (sortBy === 'trending') {
        queryType = '3' // RankedByTrend
      } else if (sortBy === 'vote') {
        queryType = '0' // RankedByVote
      }

      const searchUrl = new URL(STEAM_WORKSHOP_SEARCH)
      searchUrl.searchParams.append('key', STEAM_API_KEY)
      searchUrl.searchParams.append('query_type', queryType)
      searchUrl.searchParams.append('page', '1')
      searchUrl.searchParams.append('numperpage', limit.toString())
      searchUrl.searchParams.append('appid', '108600') // Project Zomboid App ID
      searchUrl.searchParams.append('search_text', query)
      searchUrl.searchParams.append('return_details', '1')
      searchUrl.searchParams.append('return_vote_data', '1') // Lấy thông tin vote
      searchUrl.searchParams.append('return_short_description', '1') // Lấy mô tả ngắn

      const response = await fetch(searchUrl.toString())

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Steam API request failed: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      // Parse response từ Steam API và sắp xếp kết quả
      if (data.response?.publishedfiledetails) {
        let results = data.response.publishedfiledetails

        // Lọc bỏ các kết quả không hợp lệ (result !== 1)
        results = results.filter((item: any) => item.result === 1)

        // Sắp xếp theo subscriptions (cao nhất lên đầu)
        if (sortBy === 'subscriptions') {
          results.sort((a: any, b: any) => {
            const subsA = a.subscriptions || a.lifetime_subscriptions || 0
            const subsB = b.subscriptions || b.lifetime_subscriptions || 0
            return subsB - subsA
          })
        }

        // Thêm score tổng hợp cho mỗi mod
        results = results.map((item: any) => ({
          ...item,
          popularity_score: calculatePopularityScore(item),
        }))

        return NextResponse.json({
          success: true,
          response: {
            publishedfiledetails: results,
            total: data.response.total || results.length,
          },
        })
      }

      return NextResponse.json(data)
    }

    if (action === 'details' && fileIds) {
      // Lấy thông tin chi tiết của mod
      const ids = fileIds.split(',').map(id => id.trim())

      const formData = new URLSearchParams()
      formData.append('key', STEAM_API_KEY)
      formData.append('itemcount', ids.length.toString())
      ids.forEach((id, index) => {
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
        throw new Error('Steam API request failed')
      }

      const data = await response.json()
      return NextResponse.json(data)
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
