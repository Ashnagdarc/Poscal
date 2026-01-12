# 📊 Poscal - Trading Journal & Signals Platform

<div align="center">

![Poscal Logo](public/pwa-192x192.png)

**A comprehensive trading journal and signals platform for forex traders**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

---

## 🚀 Features

### 📈 Trading Journal

- **Track Your Trades**: Record entry/exit prices, position sizes, and P&L
- **Performance Analytics**: Visualize your trading performance with charts
- **CSV Import**: Bulk import trades from CSV files
- **Trade Screenshots**: Attach chart images to your trades
- **Detailed Statistics**: Win rate, average P&L, risk-reward ratios

### 📡 Trading Signals

- **Real-Time Signals**: Receive forex trading signals with entry, SL, and multiple TP levels
- **Live Price Tracking**: Monitor signals against live market prices (Twelve Data API)
- **Signal Monitoring**: Automated monitoring with push notifications when targets are hit
- **Signal History**: View past signals with performance results
- **Chart Analysis**: View signal charts with technical analysis

### 🔔 Push Notifications

- **PWA Support**: Install as a native app on mobile/desktop
- **Real-Time Alerts**: Get notified when signals hit TP/SL levels
- **Customizable**: Enable/disable notifications per preference
- **Background Monitoring**: Automated signal monitoring via Edge Functions

### 👨‍💼 Admin Features

- **Signal Management**: Create and update trading signals
- **User Management**: View and manage all registered users
- **App Updates**: Push update notifications to all users
- **Analytics Dashboard**: Monitor platform usage and performance

### 🎨 User Experience

- **Responsive Design**: Optimized for mobile and desktop
- **Dark Mode**: Modern, eye-friendly interface
- **Bottom Navigation**: Mobile-first navigation pattern
- **Haptic Feedback**: Enhanced mobile interaction
- **Offline Support**: Service worker for offline functionality

---

## 🛠️ Tech Stack

### Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Routing**: React Router v6
- **UI Library**: Radix UI (shadcn/ui components)
- **Styling**: Tailwind CSS with custom animations
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts for data visualization
- **Date Handling**: date-fns
- **State Management**: React Context API

### Backend

- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with JWT
- **Storage**: Supabase Storage (avatars, screenshots)
- **Edge Functions**: Deno runtime
  - `get-live-prices`: Fetch forex prices from Twelve Data API
  - `monitor-signals`: Automated signal monitoring
  - `send-push-notification`: Web Push API implementation
  - `subscribe-push`: Manage push subscriptions

### APIs & Services

- **Twelve Data API**: Real-time forex price data
- **Web Push API**: Browser push notifications
- **VAPID Protocol**: Secure push notification authentication

---

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm/bun
- Supabase account
- Twelve Data API key (optional for live prices)

### 1. Clone the Repository

```bash
git clone https://github.com/Ashnagdarc/Poscal.git
cd Poscal
```

### 2. Install Dependencies

```bash
npm install
# or
bun install
```

### 3. Environment Setup

Create a `.env.local` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Supabase Setup

#### Database Setup

Run the migrations in your Supabase project to create the required tables:

- `profiles`
- `trading_journal`
- `trading_signals`
- `push_subscriptions`
- `app_updates`

#### Edge Functions Setup

Deploy the edge functions:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
npx supabase link --project-ref your_project_ref

# Set secrets
npx supabase secrets set TWELVE_DATA_API_KEY=your_api_key
npx supabase secrets set VAPID_PUBLIC_KEY=your_vapid_public_key
npx supabase secrets set VAPID_PRIVATE_KEY=your_vapid_private_key

# Deploy functions
npx supabase functions deploy get-live-prices
npx supabase functions deploy monitor-signals
npx supabase functions deploy send-push-notification
npx supabase functions deploy subscribe-push
```

#### Generate VAPID Keys (for Push Notifications)

```bash
npx web-push generate-vapid-keys
```

### 5. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` to see the app.

---

## 🚢 Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Vercel/Netlify

The app is a static SPA and can be deployed to any static hosting service:

1. Connect your GitHub repository
2. Set environment variables
3. Build command: `npm run build`
4. Output directory: `dist`

### PWA Configuration

The app includes PWA support with:

- Service worker for offline functionality
- Web manifest for installability
- Push notification support
- Automatic updates

---

## 📱 Features Guide

### For Traders

1. **Sign Up**: Create an account with email
2. **Journal**: Track all your trades with detailed analytics
3. **Signals**: View trading signals with live price updates
4. **Notifications**: Enable push notifications for signal alerts
5. **Profile**: Manage your profile and settings

### For Admins

1. **Create Signals**: Post new trading signals with chart images
2. **Monitor Performance**: Track signal performance automatically
3. **User Management**: View and manage platform users
4. **Updates**: Push app updates and announcements

---

## 🗂️ Project Structure

```
Poscal/
├── public/              # Static assets (PWA icons, service worker)
├── src/
│   ├── components/      # React components
│   │   ├── ui/         # Reusable UI components (shadcn)
│   │   └── ...         # Feature components
│   ├── contexts/       # React Context providers
│   ├── hooks/          # Custom React hooks
│   ├── integrations/   # Supabase client setup
│   ├── lib/            # Utility functions
│   ├── pages/          # Route pages
│   └── types/          # TypeScript type definitions
├── supabase/
│   ├── functions/      # Edge Functions (Deno)
│   └── config.toml     # Supabase configuration
└── ...
```

---

## 🔧 Configuration

### Database Tables

#### `profiles`

User profile information

#### `trading_journal`

Individual user trades with P&L tracking

#### `trading_signals`

Admin-created trading signals with TP/SL levels

#### `push_subscriptions`

Web push subscription endpoints

#### `app_updates`

Platform update announcements

### Security

- **Row Level Security (RLS)**: Enabled on all tables
- **Authentication**: JWT-based with Supabase Auth
- **API Security**: Service role keys for Edge Functions
- **VAPID**: Secure push notification authentication

---

## 📊 Capacity & Performance

### Current Setup (Supabase Free Tier)

- **Max Concurrent Users**: ~500-1,000 daily active users
- **Total Registered Users**: ~5,000-10,000 users
- **Database Size**: 500 MB
- **Edge Function Calls**: 500,000/month
- **Bandwidth**: 5 GB/month

### Optimization Tips

- Price data is cached to reduce API calls
- Connection pooling for database efficiency
- Service worker for offline functionality
- Image compression for trade screenshots

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is private and proprietary.

---

## 📞 Support

For issues or questions:

- GitHub Issues: [Create an issue](https://github.com/Ashnagdarc/Poscal/issues)
- Email: admin@poscal.app

---

## 🙏 Acknowledgments

- [Supabase](https://supabase.com/) - Backend infrastructure
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Twelve Data](https://twelvedata.com/) - Forex price data
- [Lovable](https://lovable.dev/) - Initial project scaffolding

---

<div align="center">

**Built with ❤️ by Daniel Samuel**

**Official Sponsor: [MandeFX](https://mandfx.com)**

</div>
