import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  app.use(express.json());

  // Simple health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // News proxy (Mocked or Gemini-enhanced)
  app.get("/api/news", async (req, res) => {
    // In a real app, this would fetch from HKEX or Finnhub
    // For MVP, we return some high-level news items
    res.json([
      { id: 1, title: "HSI stabilizes above 18,000 as tech stocks rebound.", sentiment: "neutral", date: new Date().toISOString() },
      { id: 2, title: "Tencent earnings report expected next week.", sentiment: "caution", date: new Date().toISOString() },
      { id: 3, title: "China tech policy updates show signs of easing.", sentiment: "positive", date: new Date().toISOString() },
    ]);
  });

  // Simple in-memory caches
const stockCache = new Map<string, { data: any, timestamp: number }>();
const sentimentCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for sentiment/stock info
let geminiCooldownUntil = 0;

async function callWithRetry(fn: () => Promise<any>, retries = 3, delay = 2000) {
  if (Date.now() < geminiCooldownUntil) {
    throw { status: 429, message: "Gemini is in cooldown due to rate limits." };
  }

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error.status === 429 || error.code === 429 || error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED");
      
      if (isRateLimit) {
        geminiCooldownUntil = Date.now() + 120000; // 2 minute cooldown on 429
        console.warn(`Gemini Rate Limit reached. API cooling down until ${new Date(geminiCooldownUntil).toLocaleTimeString()}`);
        if (i < retries - 1) {
          const wait = delay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, wait));
          continue;
        }
      }
      throw error;
    }
  }
}

// Helper to provide a generic fallback for any ticker
function getGenericFallback(ticker: string) {
  return {
    name: `Stock ${ticker}`,
    summary: "Market analysis temporarily in Safe Mode due to API quota limits. Please check again later.",
    risk: "Medium",
    price: 150.00,
    high52: 200.00,
    low52: 120.00,
    marketCap: "N/A",
    peRatio: "15.0",
    dividendYield: "2.5%",
    isFallback: true
  };
}

  // AI Sentiment analysis for a specific ticker
  app.post("/api/analyze-sentiment", async (req, res) => {
    const { ticker } = req.body;
    
    // Check cache
    const cached = sentimentCache.get(ticker);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return res.json(cached.data);
    }

    // Cooldown check
    if (Date.now() < geminiCooldownUntil) {
      return res.json(getGenericFallback(ticker));
    }

    // Static fallbacks for popular tickers to save quota
    const fallbacks: Record<string, any> = {
      "700": { name: "Tencent", summary: "Bullish sentiment driven by gaming recovery and AI service integration.", risk: "Medium", sentiment: "positive" },
      "9988": { name: "Alibaba", summary: "Cautiously optimistic as cloud division restructuring continues.", risk: "Medium", sentiment: "neutral" },
      "3690": { name: "Meituan", summary: "Aggressive growth in food delivery offset by intense competition in community buying.", risk: "High", sentiment: "negative" },
      "2800": { name: "Tracker Fund", summary: "Neutral broadly-diversified index exposure tracking the Hang Seng Index.", risk: "Low", sentiment: "neutral" },
      "5": { name: "HSBC", summary: "Stable dividends and interest margin expansion providing solid support.", risk: "Low", sentiment: "positive" }
    };

    if (fallbacks[ticker]) {
      sentimentCache.set(ticker, { data: fallbacks[ticker], timestamp: Date.now() });
      return res.json(fallbacks[ticker]);
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }

    try {
      const response = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: "user", parts: [{ text: `Analyze HKEX stock ticker: ${ticker}. Company name, 1-2 sentence market sentiment, and option risk (Low/Medium/High). Also determine overall sentiment (positive/negative/neutral). Return JSON: {"name": "...", "summary": "...", "risk": "...", "sentiment": "positive/negative/neutral"}` }] }]
      }));
      
      let text = response.text || "";
      if (!text && response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
        text = response.candidates[0].content.parts[0].text;
      }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      sentimentCache.set(ticker, { data, timestamp: Date.now() });
      res.json(data);
    } else {
      res.json({ name: `Stock ${ticker}`, summary: text, risk: "Medium", sentiment: "neutral" });
    }
  } catch (error: any) {
    console.error("Sentiment AI Error:", error.message || error);
    if (cached) return res.json(cached.data);
    res.status(error.status === 429 ? 429 : 200).json({ 
      name: ticker,
      summary: "AI analysis currently limited due to high demand. Please try again later.",
      risk: "Medium",
      sentiment: "neutral",
      isFallback: true
    });
  }
});

  // Live options chain (Mocking Futu OpenAPI)
  app.get("/api/options-chain", (req, res) => {
    const { tickers: tickerQuery } = req.query;
    let tickers = ["700", "9988", "3690", "2800", "5", "1299"];
    
    if (tickerQuery && typeof tickerQuery === 'string') {
      tickers = tickerQuery.split(',').filter(t => t.length > 0);
    }

    const expiries = ["2026-06-25", "2026-06-30"];
    
    const data = tickers.flatMap(ticker => {
      const basePrice = ticker === "700" ? 440 : ticker === "9988" ? 85 : ticker === "3690" ? 180 : ticker === "2800" ? 18.5 : 65;
      
      return expiries.flatMap(expiry => {
        // Create 2 calls and 2 puts for each ticker
        return [
          {
            symbol: ticker,
            expiry,
            strike: Math.floor(basePrice * 1.05),
            type: 'Call',
            bid: 2.1,
            ask: 2.3,
            last: 2.2,
            iv: 32.5,
            ivRank: 65,
            delta: 0.25,
            volume: 1200,
            oi: 5000,
            margin: 8000,
            premium: 220,
            underlyingPrice: basePrice,
          },
          {
            symbol: ticker,
            expiry,
            strike: Math.floor(basePrice * 0.95),
            type: 'Put',
            bid: 1.8,
            ask: 1.9,
            last: 1.85,
            iv: 35.2,
            ivRank: 72,
            delta: -0.22,
            volume: 1500,
            oi: 6200,
            margin: 7500,
            premium: 185,
            underlyingPrice: basePrice,
          }
        ];
      });
    });

    res.json(data);
  });

  // Historical data endpoint
  app.get("/api/historical-data/:ticker", (req, res) => {
    const { ticker } = req.params;
    const data = [];
    const basePrice = ticker === "700" ? 440 : ticker === "9988" ? 85 : 100;
    const baseIV = 30 + Math.random() * 10;

    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        price: basePrice + (Math.random() - 0.5) * 20,
        iv: baseIV + (Math.random() - 0.5) * 5,
      });
    }

    res.json(data);
  });

  // Detailed stock info endpoint
  app.get("/api/stock-info/:ticker", async (req, res) => {
    const { ticker } = req.params;
    
    // Check cache first
    const cached = stockCache.get(ticker);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return res.json(cached.data);
    }

    // Cooldown check
    if (Date.now() < geminiCooldownUntil) {
      return res.json(getGenericFallback(ticker));
    }

    // Static fallbacks
    const fallbacks: Record<string, any> = {
      "700": { name: "Tencent", price: 442.20, high52: 450.0, low52: 260.0, marketCap: "4.2T", peRatio: 22.5, dividendYield: "0.8%" },
      "9988": { name: "Alibaba", price: 84.50, high52: 102.5, low52: 65.0, marketCap: "1.8T", peRatio: 12.4, dividendYield: "1.1%" },
      "3690": { name: "Meituan", price: 184.20, high52: 210.0, low52: 120.0, marketCap: "1.1T", peRatio: 35.8, dividendYield: "0%" },
      "2800": { name: "Tracker Fund", price: 18.45, high52: 22.0, low52: 16.5, marketCap: "120B", peRatio: "N/A", dividendYield: "3.5%" }
    };

    if (fallbacks[ticker]) {
      stockCache.set(ticker, { data: fallbacks[ticker], timestamp: Date.now() });
      return res.json(fallbacks[ticker]);
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }

    try {
      const response = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: "user", parts: [{ text: `Provide 2026 key stats for HKEX stock ${ticker}. Return JSON: {"name": "...", "price": 123, "high52": 150, "low52": 100, "marketCap": "1.2T", "peRatio": 15, "dividendYield": "1.2%"}` }] }]
      }));
      
      let text = response.text || "";
      if (!text && response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
        text = response.candidates[0].content.parts[0].text;
      }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        // Update cache
        stockCache.set(ticker, { data, timestamp: Date.now() });
        res.json(data);
      } else {
        throw new Error("Invalid JSON in Gemini response");
      }
    } catch (error: any) {
      console.error("Stock Info Error:", error.message || error);
      
      // Better fallback logic
      const fallbackData = {
        name: `${ticker} (Real-time Unavailable)`,
        price: 0,
        high52: 0,
        low52: 0,
        marketCap: "N/A",
        peRatio: "N/A",
        dividendYield: "N/A",
        isFallback: true
      };

      // If we have a stale cache, use it even if expired
      if (cached) {
        return res.json(cached.data);
      }

      res.status(error.status === 429 ? 429 : 200).json(fallbackData);
    }
  });

  // Ticker search endpoint
  app.get("/api/search-ticker", async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') return res.json([]);

    const commonTickers = [
      { ticker: "6618", name: "JD Health (6618.HK)" },
      { ticker: "9888", name: "Baidu (9888.HK)" },
      { ticker: "9618", name: "JD.com (9618.HK)" },
      { ticker: "1024", name: "Kuaishou (1024.HK)" },
      { ticker: "1810", name: "Xiaomi (1810.HK)" },
      { ticker: "1211", name: "BYD (1211.HK)" },
      { ticker: "388", name: "HKEX (388.HK)" },
      { ticker: "2318", name: "Ping An (2318.HK)" },
      { ticker: "1398", name: "ICBC (1398.HK)" },
      { ticker: "939", name: "CCB (939.HK)" },
      { ticker: "1299", name: "AIA (1299.HK)" },
      { ticker: "5", name: "HSBC (5.HK)" },
      { ticker: "3690", name: "Meituan (3690.HK)" },
      { ticker: "9988", name: "Alibaba (9988.HK)" },
      { ticker: "700", name: "Tencent (700.HK)" },
      { ticker: "2800", name: "Tracker Fund (2800.HK)" },
      { ticker: "1", name: "CKH Holdings (1.HK)" },
      { ticker: "2", name: "CLP Holdings (2.HK)" },
      { ticker: "3", name: "HK & China Gas (3.HK)" },
      { ticker: "4", name: "Wharf Holdings (4.HK)" },
      { ticker: "11", name: "Hang Seng Bank (11.HK)" },
      { ticker: "12", name: "Henderson Land (12.HK)" },
      { ticker: "16", name: "SHK Properties (16.HK)" },
      { ticker: "17", name: "New World Dev (17.HK)" },
      { ticker: "19", name: "Swire Pacific A (19.HK)" },
      { ticker: "27", name: "Galaxy Ent (27.HK)" },
      { ticker: "66", name: "MTR Corporation (66.HK)" },
      { ticker: "175", name: "Geely Auto (175.HK)" },
      { ticker: "267", name: "CITIC (267.HK)" },
      { ticker: "316", name: "Orient Overseas (316.HK)" },
      { ticker: "669", name: "Techtronic Ind (669.HK)" },
      { ticker: "762", name: "China Unicom (762.HK)" },
      { ticker: "823", name: "Link REIT (823.HK)" },
      { ticker: "857", name: "PetroChina (857.HK)" },
      { ticker: "883", name: "CNOOC (883.HK)" },
      { ticker: "941", name: "China Mobile (941.HK)" },
      { ticker: "960", name: "Longfor Group (960.HK)" },
      { ticker: "1038", name: "CKI Holdings (1038.HK)" },
      { ticker: "1088", name: "China Shenhua (1088.HK)" },
      { ticker: "1093", name: "CSPC Pharma (1093.HK)" },
      { ticker: "1109", name: "China Resources Land (1109.HK)" },
      { ticker: "1177", name: "Sino Biopharm (1177.HK)" },
      { ticker: "1209", name: "China Resources Mixc (1209.HK)" },
      { ticker: "1211", name: "BYD Company (1211.HK)" },
      { ticker: "1313", name: "China Resources Cement (1313.HK)" },
      { ticker: "1378", name: "China Hongqiao (1378.HK)" },
      { ticker: "1880", name: "China Tourism Duty Free (1880.HK)" },
      { ticker: "1928", name: "Sands China (1928.HK)" },
      { ticker: "2020", name: "Anta Sports (2020.HK)" },
      { ticker: "2313", name: "Shenzhou Intl (2313.HK)" },
      { ticker: "2319", name: "Mengniu Dairy (2319.HK)" },
      { ticker: "2331", name: "Li Ning (2331.HK)" },
      { ticker: "2382", name: "Sunny Optical (2382.HK)" },
      { ticker: "2388", name: "BOC Hong Kong (2388.HK)" },
      { ticker: "2628", name: "China Life (2628.HK)" },
      { ticker: "3692", name: "Hansoh Pharma (3692.HK)" },
      { ticker: "3968", name: "CM Bank (3968.HK)" },
      { ticker: "3988", name: "Bank of China (3988.HK)" },
      { ticker: "6098", name: "Country Garden Services (6098.HK)" },
      { ticker: "6862", name: "Haidilao (6862.HK)" },
      { ticker: "9626", name: "Bilibili (9626.HK)" },
      { ticker: "9961", name: "Trip.com (9961.HK)" },
      { ticker: "9999", name: "NetEase (9999.HK)" }
    ];

    const filtered = commonTickers.filter(t => 
      t.name.toLowerCase().includes(q.toLowerCase()) || 
      t.ticker.includes(q)
    ).slice(0, 5);

    if (filtered.length > 0) {
      return res.json(filtered);
    }

    // Fallback to searching if no common ones match well
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ 
          role: "user", 
          parts: [{ 
            text: `Find the HKEX numeric stock ticker for company: "${q}". 
            Return a JSON array of top matches in this format: 
            [{"ticker": "1234", "name": "Company Name (1234.HK)"}]` 
          }] 
        }],
      });
      
      const text = response.text || "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return res.json(JSON.parse(jsonMatch[0]));
      }
    } catch (error) {
      console.error("Search Error:", error);
    }

    res.json([]);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  // Broadcast function to all clients
  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Mock real-time data generator
  setInterval(() => {
    const tickers = ["700", "9988", "3690", "2800", "5", "1299"];
    const ticker = tickers[Math.floor(Math.random() * tickers.length)];
    const update = {
      type: 'OPTION_UPDATE',
      symbol: ticker,
      bid: (Math.random() * 5 + 1).toFixed(2),
      ask: (Math.random() * 5 + 2).toFixed(2),
      last: (Math.random() * 5 + 1.5).toFixed(2),
      iv: (25 + Math.random() * 20).toFixed(1),
      ivRank: Math.floor(Math.random() * 100),
      delta: (Math.random() * 0.8 - 0.4).toFixed(2),
      timestamp: new Date().toISOString()
    };
    broadcast(update);
  }, 4000);

  // Periodic Position Updates
  setInterval(() => {
    const positionIds = ["1", "2", "3"];
    const id = positionIds[Math.floor(Math.random() * positionIds.length)];
    const priceChange = (Math.random() - 0.5) * 2;
    
    const update = {
      type: 'POSITION_UPDATE',
      id: id,
      newPrice: (Math.random() * 15 + 5).toFixed(2),
      timestamp: new Date().toISOString()
    };
    broadcast(update);
  }, 5000);

  wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    ws.send(JSON.stringify({ type: 'WELCOME', message: 'Connected to HKEX Real-time Options Stream' }));
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
