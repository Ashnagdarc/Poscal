# Realtime Proxy Server

This is a simple Node.js WebSocket proxy server that subscribes to Supabase Realtime for price_cache updates and broadcasts them to all connected clients. This reduces Supabase egress and allows you to scale to thousands of users cost-effectively.

## Usage

1. Install dependencies:
   ```sh
   npm install
   ```
2. Set your Supabase project URL and anon/public key as environment variables:
   ```sh
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_KEY="your-anon-key"
   ```
   Or create a `.env` file with:
   ```
   SUPABASE_URL=your-url
   SUPABASE_KEY=your-key
   ```
3. Start the server:
   ```sh
   npm start
   ```
4. Clients connect to `ws://your-server:8080` to receive real-time price updates.

## How it works
- Only one connection to Supabase Realtime is used, regardless of user count.
- All connected clients receive the latest prices and real-time updates.
- You can deploy this server on any VPS, Docker, or serverless platform.

## Security
- Add authentication or rate limiting as needed for production use.

---

**Contact your developer for integration help or custom features.**
