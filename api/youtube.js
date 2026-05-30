// Vercel Serverless Function — YouTube Data API v3 proxy
// The API key is read from process.env.YOUTUBE_API_KEY (set in Vercel dashboard)

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const API_KEY = process.env.YOUTUBE_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'YouTube API key not configured' });
    }

    const { action, channelId } = req.query;

    if (!channelId) {
        return res.status(400).json({ error: 'channelId is required' });
    }

    try {
        switch (action) {
            case 'latest-video':
                return await getLatestVideo(res, API_KEY, channelId);
            case 'shorts':
                return await getShorts(res, API_KEY, channelId);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (err) {
        console.error('YouTube API error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch YouTube data' });
    }
};

// Fetch the latest video from the channel (not a Short)
async function getLatestVideo(res, apiKey, channelId) {
    // Search for recent videos from the channel
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&type=video&order=date&maxResults=10`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
        const err = await searchRes.text();
        throw new Error(`YouTube search API error: ${err}`);
    }

    const searchData = await searchRes.json();
    if (!searchData.items || searchData.items.length === 0) {
        return res.status(404).json({ error: 'No videos found' });
    }

    // Get video details to filter out shorts (shorts are typically < 60s)
    const videoIds = searchData.items.map(item => item.id.videoId).join(',');
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${videoIds}&part=contentDetails,snippet,statistics`;

    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    // Filter out shorts (duration <= 60 seconds)
    for (const video of (detailsData.items || [])) {
        const duration = parseDuration(video.contentDetails.duration);
        const title = video.snippet.title.toLowerCase();
        const desc = (video.snippet.description || '').toLowerCase();

        // Skip if it looks like a short
        if (duration <= 60 || title.includes('#shorts') || desc.includes('#shorts')) {
            continue;
        }

        return res.status(200).json({
            videoId: video.id,
            title: video.snippet.title,
            thumbnail: video.snippet.thumbnails?.high?.url,
            views: video.statistics?.viewCount,
        });
    }

    // Fallback: return the first video anyway
    const first = detailsData.items[0];
    return res.status(200).json({
        videoId: first.id,
        title: first.snippet.title,
        thumbnail: first.snippet.thumbnails?.high?.url,
        views: first.statistics?.viewCount,
    });
}

// Fetch shorts: most viewed, most liked, latest
async function getShorts(res, apiKey, channelId) {
    // Get recent videos from channel
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&type=video&order=date&maxResults=50`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
        const err = await searchRes.text();
        throw new Error(`YouTube search API error: ${err}`);
    }

    const searchData = await searchRes.json();
    if (!searchData.items || searchData.items.length === 0) {
        return res.status(200).json({ shorts: [] });
    }

    // Get details for all videos
    const videoIds = searchData.items.map(item => item.id.videoId).join(',');
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${videoIds}&part=contentDetails,snippet,statistics`;

    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    // Filter shorts only
    const shorts = (detailsData.items || []).filter(video => {
        const duration = parseDuration(video.contentDetails.duration);
        const title = video.snippet.title.toLowerCase();
        const desc = (video.snippet.description || '').toLowerCase();
        return duration <= 60 || title.includes('#shorts') || desc.includes('#shorts');
    });

    if (shorts.length === 0) {
        return res.status(200).json({ shorts: [] });
    }

    // Sort by views (descending) for most viewed
    const byViews = [...shorts].sort((a, b) =>
        parseInt(b.statistics?.viewCount || 0) - parseInt(a.statistics?.viewCount || 0)
    );

    // Sort by likes (descending) for most liked
    const byLikes = [...shorts].sort((a, b) =>
        parseInt(b.statistics?.likeCount || 0) - parseInt(a.statistics?.likeCount || 0)
    );

    // Latest is already in date order from the search
    const latest = shorts[0]; // First in the filtered list (most recent)

    // Build result: pick up to 3 unique videos with labels
    const result = [];
    const seen = new Set();

    const addShort = (video, label) => {
        if (!video) return false;
        if (seen.has(video.id)) return false;
        seen.add(video.id);
        result.push({
            videoId: video.id,
            title: video.snippet.title,
            views: video.statistics?.viewCount,
            likes: video.statistics?.likeCount,
            label,
        });
        return true;
    };

    // Try each category; if a video is already used, skip to the next in that sorted list
    const categories = [
        { list: byViews, label: 'Most Viewed' },
        { list: byLikes, label: 'Most Liked' },
        { list: shorts,  label: 'Latest Upload' },
    ];

    for (const { list, label } of categories) {
        if (result.length >= 3) break;
        for (const video of list) {
            if (addShort(video, label)) break;
        }
    }

    // Fill remaining slots if fewer than 3 unique shorts
    for (const video of shorts) {
        if (result.length >= 3) break;
        addShort(video, '');
    }

    return res.status(200).json({ shorts: result });
}

// Parse ISO 8601 duration (PT1M30S) to seconds
function parseDuration(iso) {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    return hours * 3600 + minutes * 60 + seconds;
}
