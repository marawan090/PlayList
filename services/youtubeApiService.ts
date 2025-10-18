// IMPORTANT: While hardcoding keys is not a best practice in production,
// this key was explicitly provided by the user to make the tool functional in this context.
const API_KEY = 'AIzaSyAYKYx__SzwA_i6DxoT43mvtU1sP4WaYLA'; 
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// --- TYPE DEFINITIONS ---
export type ApiFeature =
  | 'playlistItems'
  | 'playlistDetails'
  | 'playlistDuration';

export type ApiResult = {
    type: 'list';
    data: string[];
} | {
    type: 'details';
    data: Record<string, string | number>;
};


// --- UTILITY FUNCTIONS ---

const extractId = (url: string, paramName: string, regex: RegExp): string | null => {
    try {
        const urlObj = new URL(url);
        const id = urlObj.searchParams.get(paramName);
        if (id) return id;
    } catch (e) { /* Fallback to regex */ }
    const match = url.match(regex);
    return match ? match[1] : url; // Assume raw ID if no match
};

const extractPlaylistId = (url: string) => extractId(url, 'list', /[?&]list=([^&]+)/);

const handleApiError = async (response: Response): Promise<never> => {
    if (response.ok) {
        // This should not be called on a successful response
        throw new Error('handleApiError called with an OK response.');
    }
    try {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || `An unknown API error occurred (Status: ${response.status}).`;
        throw new Error(`YouTube API Error: ${errorMessage}`);
    } catch (jsonError) {
        throw new Error(`Failed to parse API error response (Status: ${response.status}).`);
    }
};

const parseISO8601Duration = (iso: string): number => {
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = iso.match(regex);
    if (!matches) return 0;

    const hours = matches[1] ? parseInt(matches[1], 10) : 0;
    const minutes = matches[2] ? parseInt(matches[2], 10) : 0;
    const seconds = matches[3] ? parseInt(matches[3], 10) : 0;

    return (hours * 3600) + (minutes * 60) + seconds;
};

const formatDuration = (totalSeconds: number): string => {
    if (totalSeconds === 0) return '0 seconds';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    if (seconds > 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);

    return parts.join(', ');
};

// --- API FETCH FUNCTIONS ---

export const fetchPlaylistItems = async (playlistUrl: string): Promise<ApiResult> => {
  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) throw new Error('Invalid YouTube playlist URL.');

  const allTitles: string[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    const params = new URLSearchParams({
      part: 'snippet',
      playlistId,
      key: API_KEY,
      maxResults: '50',
    });
    if (nextPageToken) params.append('pageToken', nextPageToken);

    const response = await fetch(`${YOUTUBE_API_BASE_URL}/playlistItems?${params.toString()}`);
    if (!response.ok) await handleApiError(response);

    const data = await response.json();
    const titles = data.items?.map((item: any) => item.snippet.title) || [];
    allTitles.push(...titles);
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return { type: 'list', data: allTitles };
};

export const fetchPlaylistDetails = async (playlistUrl: string): Promise<ApiResult> => {
    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) throw new Error('Invalid YouTube playlist URL.');

    const params = new URLSearchParams({
        part: 'snippet,status,contentDetails',
        id: playlistId,
        key: API_KEY,
    });
    const response = await fetch(`${YOUTUBE_API_BASE_URL}/playlists?${params.toString()}`);
    if (!response.ok) await handleApiError(response);

    const data = await response.json();
    const details = data.items?.[0];
    if (!details) throw new Error('Playlist not found.');

    return { type: 'details', data: {
        title: details.snippet.title,
        description: details.snippet.description,
        channel: details.snippet.channelTitle,
        publishedAt: new Date(details.snippet.publishedAt).toLocaleString(),
        videoCount: details.contentDetails.itemCount,
        status: details.status.privacyStatus,
    }};
}

export const fetchPlaylistDuration = async (playlistUrl: string): Promise<ApiResult> => {
    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) throw new Error('Invalid YouTube playlist URL.');

    const videoIds: string[] = [];
    let nextPageToken: string | undefined = undefined;

    // 1. Get all video IDs from the playlist
    do {
        const params = new URLSearchParams({
            part: 'snippet',
            playlistId,
            key: API_KEY,
            maxResults: '50',
        });
        if (nextPageToken) params.append('pageToken', nextPageToken);

        const response = await fetch(`${YOUTUBE_API_BASE_URL}/playlistItems?${params.toString()}`);
        if (!response.ok) await handleApiError(response);

        const data = await response.json();
        const ids = data.items?.map((item: any) => item.snippet.resourceId.videoId).filter(Boolean) || [];
        videoIds.push(...ids);
        nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    if (videoIds.length === 0) {
        return { type: 'details', data: {
            playlistVideoCount: 0,
            totalDuration: '0 seconds',
            averageDuration: '0 seconds',
        }};
    }

    // 2. Fetch video details in batches of 50 to get durations
    let totalSeconds = 0;
    for (let i = 0; i < videoIds.length; i += 50) {
        const videoIdBatch = videoIds.slice(i, i + 50);
        const params = new URLSearchParams({
            part: 'contentDetails',
            id: videoIdBatch.join(','),
            key: API_KEY,
        });

        const response = await fetch(`${YOUTUBE_API_BASE_URL}/videos?${params.toString()}`);
        if (!response.ok) await handleApiError(response);

        const data = await response.json();
        data.items?.forEach((item: any) => {
            totalSeconds += parseISO8601Duration(item.contentDetails.duration);
        });
    }

    const averageSeconds = videoIds.length > 0 ? totalSeconds / videoIds.length : 0;

    return { type: 'details', data: {
        playlistVideoCount: videoIds.length,
        totalDuration: formatDuration(totalSeconds),
        averageDuration: formatDuration(averageSeconds),
    }};
};