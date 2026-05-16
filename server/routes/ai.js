const cfg = require('../config')
const jf = require('../jellyfin')
const https = require('https')

// ── Tool definitions ──
const TOOLS = [
  {
    name: 'search_library',
    description: 'Search the Jellyfin library for movies, TV shows, or music',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, type: { type: 'string', enum: ['Movie','Series','Audio','all'], description: 'Media type to search' } }, required: ['query'] }
  },
  {
    name: 'get_recently_added',
    description: 'Get recently added media items',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_continue_watching',
    description: 'Get items the user is currently watching / in progress',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_movies',
    description: 'Get movies from the library with optional filters',
    input_schema: { type: 'object', properties: { genre: { type: 'string' }, sort: { type: 'string', enum: ['SortName','CommunityRating','PremiereDate','DateCreated'] }, limit: { type: 'number' } } }
  },
  {
    name: 'get_random',
    description: 'Get a random movie recommendation',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'play_item',
    description: 'Play a specific media item — use this when user wants to watch something',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' } }, required: ['id'] }
  },
  {
    name: 'show_detail',
    description: 'Show the detail page for a specific item',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' } }, required: ['id'] }
  },
  {
    name: 'navigate',
    description: 'Navigate to a page in the app',
    input_schema: { type: 'object', properties: { page: { type: 'string', enum: ['home','movies','shows','music','library','stats','health'] } }, required: ['page'] }
  },
]

// ── Execute tool ──
async function executeTool(name, input, token, userId) {
  const jellyfinUrl = cfg.get('JELLYFIN_URL')
  switch(name) {
    case 'search_library': {
      const type = input.type && input.type !== 'all' ? `&IncludeItemTypes=${input.type}` : ''
      const data = await jf.get(`/Users/${userId}/Items?SearchTerm=${encodeURIComponent(input.query)}&Recursive=true&Limit=8&fields=Overview,ImageTags,MediaSources${type}`, token)
      return mapItems(data.Items || [], token, jellyfinUrl)
    }
    case 'get_recently_added': {
      const data = await jf.get(`/Users/${userId}/Items/Latest?Limit=8&fields=Overview,ImageTags`, token)
      return mapItems(Array.isArray(data) ? data : [], token, jellyfinUrl)
    }
    case 'get_continue_watching': {
      const data = await jf.get(`/Users/${userId}/Items/Resume?Limit=8&fields=Overview,ImageTags&MediaTypes=Video`, token)
      return mapItems(data.Items || [], token, jellyfinUrl)
    }
    case 'get_movies': {
      const sort = input.sort || 'SortName'
      const genre = input.genre ? `&Genres=${encodeURIComponent(input.genre)}` : ''
      const limit = input.limit || 8
      const data = await jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&SortBy=${sort}&SortOrder=Descending&Limit=${limit}&fields=Overview,ImageTags${genre}`, token)
      return mapItems(data.Items || [], token, jellyfinUrl)
    }
    case 'get_random': {
      const count = await jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=0&EnableTotalRecordCount=true`, token)
      const total = count.TotalRecordCount || 100
      const startIndex = Math.floor(Math.random() * Math.max(0, total - 1))
      const data = await jf.get(`/Users/${userId}/Items?IncludeItemTypes=Movie&Recursive=true&StartIndex=${startIndex}&Limit=1&fields=Overview,ImageTags`, token)
      return mapItems(data.Items || [], token, jellyfinUrl)
    }
    case 'play_item': return { action: 'play', id: input.id, title: input.title }
    case 'show_detail': return { action: 'detail', id: input.id, title: input.title }
    case 'navigate': return { action: 'navigate', page: input.page }
    default: return { error: 'Unknown tool' }
  }
}

function mapItems(items, token, jellyfinUrl) {
  return items.map(i => ({
    id: i.Id, title: i.Name, year: i.ProductionYear, type: i.Type,
    overview: i.Overview ? i.Overview.slice(0, 150) : '',
    genre: i.Genres && i.Genres[0],
    score: i.CommunityRating,
    posterUrl: i.ImageTags && i.ImageTags.Primary
      ? `${jellyfinUrl}/Items/${i.Id}/Images/Primary?maxWidth=300&api_key=${token}` : null,
  }))
}

// ── Call Claude ──
async function callClaude(messages, tools) {
  const apiKey = cfg.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `You are an AI navigator for CyanFin, a personal Jellyfin media server frontend. 
Help users find and play movies, TV shows, and music from their personal library.
Be concise and friendly. When users want to watch something specific, search for it and use play_item.
When they want to browse, show results and let them choose. Never make up media that isn't in the search results.`,
    messages,
    tools,
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
    req.write(body); req.end()
  })
}

// ── Call Gemini ──
async function callGemini(messages, toolResults) {
  const apiKey = cfg.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))

  const body = JSON.stringify({
    contents,
    generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
    systemInstruction: { parts: [{ text: 'You are an AI navigator for CyanFin, a Jellyfin media frontend. Help users find movies and TV shows. Be concise.' }] }
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 20000,
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
    req.write(body); req.end()
  })
}


// ── Call Ollama (local AI) ──
async function callOllama(messages, toolSummary) {
  const ollamaUrl = cfg.get('OLLAMA_URL') || 'http://localhost:11434';
  const model = cfg.get('OLLAMA_MODEL') || 'llama3';
  
  const systemPrompt = `You are an AI navigator for CyanFin, a Jellyfin media frontend. Help users find movies and TV shows from their personal library. Be concise and friendly.`;
  
  // Build a simple prompt since Ollama doesn't support tool calling natively
  const userMsg = messages[messages.length - 1]?.content || '';
  const historyText = messages.slice(-4, -1).map(m => `${m.role}: ${m.content}`).join('\n');
  
  const prompt = [
    systemPrompt,
    historyText && '\nConversation so far:\n' + historyText,
    toolSummary && '\nLibrary results:\n' + JSON.stringify(toolSummary).slice(0, 1000),
    '\nUser: ' + userMsg,
    'Assistant:'
  ].filter(Boolean).join('\n');

  const body = JSON.stringify({
    model,
    prompt,
    stream: false,
    options: { temperature: 0.7, num_predict: 256 },
  });

  return new Promise((resolve, reject) => {
    const parsed = new URL(ollamaUrl.replace(/\/$/, '') + '/api/generate');
    const lib = parsed.protocol === 'https:' ? require('https') : require('http');
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 30000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama timeout - is it running?')); });
    req.write(body); req.end();
  });
}

// ── Main handler ──
async function handleAI(pathname, body, session) {
  if (pathname !== '/api/ai/navigate') return null

  const { message, history = [], provider = 'claude' } = body
  const token = session.token
  const userId = session.userId

  // Build message history
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message }
  ]

  if (provider === 'ollama') {
    try {
      // For Ollama: do a library search first, then pass results to model
      const searchResults = await executeTool('search_library', { query: message, type: 'all' }, token, userId).catch(() => []);
      const ollamaRes = await callOllama(messages, Array.isArray(searchResults) ? searchResults.slice(0, 5) : null);
      return {
        reply: ollamaRes.response || 'I found some results for you.',
        items: Array.isArray(searchResults) ? searchResults : [],
      };
    } catch(e) {
      return { reply: `Ollama error: ${e.message}. Make sure Ollama is running at ${cfg.get('OLLAMA_URL') || 'http://localhost:11434'}`, items: [] };
    }
  }

  if (provider === 'gemini') {
    // Simple Gemini path — no tool calling, just do a library search and return
    try {
      const searchResults = await executeTool('search_library', { query: message, type: 'all' }, token, userId)
      const geminiRes = await callGemini(messages, searchResults)
      const text = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text || 'I found some results for you.'
      return { reply: text, items: Array.isArray(searchResults) ? searchResults : [] }
    } catch(e) {
      return { reply: `Gemini error: ${e.message}`, items: [] }
    }
  }

  // Claude path — agentic tool calling loop
  try {
    let claudeMessages = [...messages]
    let finalReply = ''
    let finalItems = []
    let finalAction = null
    let iterations = 0

    while (iterations < 4) {
      iterations++
      const response = await callClaude(claudeMessages, TOOLS)

      if (response.error) throw new Error(response.error.message || 'Claude API error')

      const textBlock = response.content.find(b => b.type === 'text')
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')

      if (textBlock) finalReply = textBlock.text

      if (!toolUseBlocks.length || response.stop_reason === 'end_turn') break

      // Execute all tool calls
      claudeMessages.push({ role: 'assistant', content: response.content })
      const toolResults = []

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input, token, userId).catch(e => ({ error: e.message }))

        // Extract action if returned
        if (result && result.action === 'play') finalAction = { type: 'play', item: { id: result.id, title: result.title } }
        else if (result && result.action === 'detail') finalAction = { type: 'detail', item: { id: result.id, title: result.title } }
        else if (result && result.action === 'navigate') finalAction = { type: 'navigate', path: '/' + result.page }
        else if (Array.isArray(result)) finalItems = result

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(Array.isArray(result) ? result.slice(0, 6) : result),
        })
      }

      claudeMessages.push({ role: 'user', content: toolResults })
    }

    return {
      reply: finalReply || 'Here\'s what I found.',
      items: finalItems,
      action: finalAction,
    }
  } catch(e) {
    return { reply: `Error: ${e.message}`, items: [] }
  }
}

module.exports = { handleAI }
