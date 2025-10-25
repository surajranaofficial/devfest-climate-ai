const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const NodeCache = require('node-cache');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


// Mock climate data (In production, use real APIs like NASA, NOAA)
const getClimateData = () => ({
  globalTemp: 1.2, // °C above pre-industrial
  co2Level: 421, // ppm
  seaLevel: 10.1, // cm rise since 1900
  arcticIce: -13.2, // % decline per decade
  extremeEvents: 432, // this year
  trendingUp: true
});

// AI Climate Assistant with retry logic
app.post('/api/ai-assistant', async (req, res) => {
  try {
    console.log('Request Body:', req.body);
    const { question, location, context } = req.body;
    
    const prompt = `You are a climate scientist and activist assistant. 
    User Location: ${location || 'Global'}
    Context: ${context || 'General climate query'}
    
    User Question: "${question}"
    
    IMPORTANT: Your response language should match the language of the user's question. 
    - If the user asks in English, respond in English.
    - If the user asks in Hinglish or Hindi, respond in Hinglish.
    - Default to English if the language is unclear.
    
    Provide:
    1. Clear, scientific answer (but simple language)
    2. Local relevance if location provided
    3. 3 specific actions they can take TODAY
    4. One inspiring fact or success story
    
    Keep tone: Informative but hopeful. Urgent but not depressing.`;

    console.log('Prompt:', prompt);

    // Retry logic for overloaded models
    let result;
    let lastError;
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-2.5-pro'];
    
    for (const modelName of models) {
      try {
        console.log(`Trying model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(prompt);
        console.log(`Success with model: ${modelName}`);
        break;
      } catch (error) {
        console.log(`Model ${modelName} failed:`, error.message);
        lastError = error;
        continue;
      }
    }
    
    if (!result) {
      throw lastError || new Error('All models failed');
    }
    
    const response = await result.response;
    
    res.json({
      success: true,
      answer: response.text(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in /api/ai-assistant:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI response',
      details: error.message
    });
  }
});

// Generate Personalized Action Plan with retry
app.post('/api/action-plan', async (req, res) => {
  try {
    const { location, lifestyle, concerns } = req.body;
    
    const prompt = `Create a personalized 30-day climate action plan:
    
    Location: ${location}
    Lifestyle: ${lifestyle} (e.g., student, professional, family)
    Main Concerns: ${concerns}
    
    IMPORTANT: Your response language should match the language of the user's "Main Concerns". 
    - If "Main Concerns" is in English, respond in English.
    - If "Main Concerns" is in Hinglish or Hindi, respond in Hinglish.
    - Default to English if the language is unclear.
    
    Generate:
    1. Week 1-4 daily challenges (progressive difficulty)
    2. Expected carbon reduction (kg CO2)
    3. Cost savings estimate
    4. Local resources/organizations
    5. Social sharing messages
    
    Make it:
    - Specific and actionable
    - Realistic for their lifestyle
    - Measurable impact
    - Community-oriented
    
    Format as JSON with: {weeks: [{day: 1, challenge: "", impact: ""}]}`;

    // Retry logic
    let result;
    let lastError;
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-2.5-pro'];
    
    for (const modelName of models) {
      try {
        console.log(`Trying model for action plan: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(prompt);
        console.log(`Success with model: ${modelName}`);
        break;
      } catch (error) {
        console.log(`Model ${modelName} failed for action plan:`, error.message);
        lastError = error;
        continue;
      }
    }
    
    if (!result) {
      throw lastError || new Error('All models failed');
    }
    
    const response = await result.response;
    
    res.json({
      success: true,
      actionPlan: response.text(),
      carbonGoal: Math.floor(Math.random() * 500) + 200, // Mock calculation
      communitySize: 1247 // Mock community count
    });
    
  } catch (error) {
    console.error('Error in action plan:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to generate action plan',
      details: error.message
    });
  }
});

// Analyze Climate News
app.post('/api/analyze-news', async (req, res) => {
  try {
    const prompt = `Analyze this climate news article for the general public:
    
    Headline: "${headline}"
    Article: ${article.substring(0, 500)}...
    
    Provide:
    1. 🎯 Key Takeaway (1 sentence)
    2. 🔬 What This Means (simplified science)
    3. 😟 Impact Level (Low/Medium/High/Critical)
    4. ✅ What You Can Do (3 actions)
    5. 💡 Silver Lining (any positive aspect)
    
    Be accurate but accessible. Avoid jargon.`;

    // Retry logic
    let result;
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-2.5-pro'];
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(prompt);
        break;
      } catch (error) {
        console.log(`Model ${modelName} failed for news analysis`);
        continue;
      }
    }
    if (!result) throw new Error('All models failed');

    const response = await result.response;
    
    res.json({
      success: true,
      analysis: response.text()
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze news'
    });
  }
});

// Calculate Carbon Footprint
app.post('/api/carbon-footprint', async (req, res) => {
  try {
    const { transport, energy, diet, shopping, location } = req.body;
    
    const prompt = `Calculate carbon footprint and provide reduction strategies:
    
    Transportation: ${transport}
    Energy Use: ${energy}
    Diet Type: ${diet}
    Shopping Habits: ${shopping}
    Location: ${location}
    
    Provide:
    1. Estimated annual CO2 (tons)
    2. Comparison to country/global average
    3. Breakdown by category (%)
    4. Top 5 reduction strategies (specific to their data)
    5. Potential savings (CO2 and money)
    
    Be honest but motivating.`;

    // Retry logic
    let result;
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-2.5-pro'];
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(prompt);
        break;
      } catch (error) {
        console.log(`Model ${modelName} failed for carbon footprint`);
        continue;
      }
    }
    if (!result) throw new Error('All models failed');

    const response = await result.response;
    
    // Mock calculation
    const baseFootprint = 8.5; // tons CO2/year
    const calculated = Math.random() * 5 + 6;
    
    res.json({
      success: true,
      footprint: calculated.toFixed(1),
      analysis: response.text(),
      globalAverage: 4.8,
      countryAverage: baseFootprint
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate footprint'
    });
  }
});

// Get Local Climate Data
app.get('/api/local-climate/:city', async (req, res) => {
  try {
    const { city } = req.params;
    
    // Check cache first
    const cacheKey = `climate_${city}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);
    
    // In production, use OpenWeather API
    // For demo, return mock data
    const data = {
      success: true,
      city: city,
      currentTemp: 28.5,
      tempAnomaly: +1.8, // Above historical average
      aqi: 156, // Air Quality Index
      aqiStatus: 'Unhealthy',
      tempTrend: [
        { year: 2000, temp: 25.2 },
        { year: 2005, temp: 25.8 },
        { year: 2010, temp: 26.3 },
        { year: 2015, temp: 27.1 },
        { year: 2020, temp: 27.8 },
        { year: 2025, temp: 28.5 }
      ],
      extremeEvents: {
        heatwaves: 12,
        floods: 3,
        droughts: 2
      },
      forecast: 'Temperature expected to rise 2-4°C by 2050 without action'
    };
    
    cache.set(cacheKey, data);
    res.json(data);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch climate data'
    });
  }
});

// Get Global Climate Stats
app.get('/api/global-stats', (req, res) => {
  const stats = getClimateData();
  
  res.json({
    success: true,
    stats: stats,
    lastUpdated: new Date().toISOString(),
    sources: ['NASA', 'NOAA', 'IPCC'],
    urgency: 'critical'
  });
});

// Submit Climate Action (for gamification)
app.post('/api/submit-action', async (req, res) => {
  try {
    const { action, impact } = req.body;
    
    // In production, save to Firebase
    const points = Math.floor(Math.random() * 50) + 10;
    const co2Saved = (Math.random() * 5).toFixed(2);
    
    res.json({
      success: true,
      message: 'Great job! Every action counts! 🌱',
      pointsEarned: points,
      co2Saved: `${co2Saved} kg`,
      badge: points > 40 ? 'Climate Champion 🏆' : null,
      communityTotal: '24,567 kg CO2 saved today'
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to submit action' });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'running',
    message: 'Climate Action AI is live! 🌍',
    endpoints: [
      'POST /api/ai-assistant',
      'POST /api/action-plan',
      'POST /api/analyze-news',
      'POST /api/carbon-footprint',
      'GET /api/local-climate/:city',
      'GET /api/global-stats',
      'POST /api/submit-action'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🌍 Climate Action AI running on http://localhost:${PORT}`);
  console.log(`🤖 AI-powered climate solutions ready!`);
});
