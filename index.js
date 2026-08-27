require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const MY_CHAT_ID = process.env.MY_CHAT_ID;

// Simple in-memory cache to prevent duplicate signals
// Note: On Vercel (Serverless), memory is ephemeral and resets on cold starts.
const signalCache = new Map();

// GET Route
app.get('/', (req, res) => {
    res.send('ApexSignal Pro is running');
});

// POST Webhook Route
app.post('/webhook', async (req, res) => {
    const { symbol, action, price, time } = req.body;

    // 1. Basic Validation
    if (!symbol || !action || !price) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // 2. Prevent Duplicate Signals (60-second window)
    const cacheKey = `${symbol}_${action.toLowerCase()}`;
    const now = Date.now();
    
    if (signalCache.has(cacheKey)) {
        const lastSignalTime = signalCache.get(cacheKey);
        if (now - lastSignalTime < 60000) {
            console.log(`Duplicate signal ignored for ${cacheKey}`);
            return res.status(200).json({ status: "ignored", reason: "duplicate" });
        }
    }
    
    // Update cache with current timestamp
    signalCache.set(cacheKey, now);

    // 3. Construct Telegram Message
    const message = `🚨 APEX SIGNAL 🚨\nAction: ${action.toUpperCase()}\nSymbol: ${symbol}\nPrice: ${price}\nTime: ${time || new Date().toISOString()}`;

    // 4. Send to Telegram
    try {
        const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        await axios.post(telegramUrl, {
            chat_id: MY_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        
        console.log(`Signal sent: ${symbol} ${action}`);
        res.status(200).json({ status: "success" });
    } catch (error) {
        console.error("Telegram API Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to send Telegram message" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Export for Vercel
module.exports = app;