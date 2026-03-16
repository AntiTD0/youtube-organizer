// This file calls YouTube API with your hidden key
exports.handler = async (event) => {
  // Enable CORS for your extension
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { videoIds } = event.queryStringParameters;
    
    // Your API key from Netlify environment variables
    const API_KEY = process.env.YOUTUBE_API_KEY; // 🔐 Hidden on Netlify!
    
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};