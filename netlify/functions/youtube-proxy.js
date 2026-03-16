// Netlify serverless function for YouTube API proxy
exports.handler = async (event) => {
  // Enable CORS for your extension
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get video IDs from query parameter
    const { videoIds } = event.queryStringParameters;
    
    if (!videoIds) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'videoIds parameter required' })
      };
    }

    // Your API key from environment variables
    const API_KEY = process.env.YOUTUBE_API_KEY;
    
    if (!API_KEY) {
      console.error('YouTube API key not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Call YouTube API
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Check for API errors
    if (data.error) {
      console.error('YouTube API error:', data.error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: data.error.message })
      };
    }

    // Return successful response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch from YouTube API' })
    };
  }
};