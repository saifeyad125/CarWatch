# DealWatch - Mobile Deal Monitoring App

DealWatch is a mobile-first web application that helps users monitor online listings for cars and other items. Users can create watchlists with custom filters and get notified when new deals match their criteria.

## Features

### 📱 Mobile-First Design
- **Bottom Navigation**: Easy thumb navigation with 4 main tabs
- **Responsive UI**: Optimized for mobile devices with touch-friendly interactions
- **Clean Interface**: Modern design with proper spacing and shadows

### 🏠 Home Dashboard
- **Hero Section**: Personalized welcome with user's name
- **Quick Stats**: Active alerts and new matches display
- **Popular Listings**: Featured car deals with images and details
- **Your Monitors**: Overview of active watchlist items
- **Quick Add**: One-tap button to add new listings to monitor

### 📋 Watchlist Management
- **Active Monitoring**: Track multiple car searches with custom criteria
- **Smart Filters**: Filter by make, model, year range, price, location, and condition
- **Real-time Updates**: See when listings were last checked and how many matches found
- **Search & Filter**: Find specific watchlist items quickly
- **Add New Items**: Comprehensive form to set up new monitoring criteria

### 🤖 AI Chat Assistant
- **Intelligent Help**: AI-powered chatbot to help with car searches
- **Quick Prompts**: Pre-defined questions for common requests
- **Real-time Chat**: Smooth messaging experience with typing indicators
- **Persistent History**: Chat history maintained during session

### 👤 Profile & Settings
- **User Management**: Edit profile information and preferences
- **Statistics**: View your usage stats (watchlists, alerts, deals found)
- **Account Settings**: Manage notifications, privacy, and theme preferences
- **Support**: Help center, feedback, and app information
- **Data Management**: Options to manage or delete account data

## Tech Stack

- **Framework**: Next.js 16 with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Icons**: Lucide React for consistent iconography
- **Components**: Custom UI components built on Radix UI primitives
- **State Management**: React hooks for local state
- **Responsive**: Mobile-first design with desktop support

## Color Scheme

The app uses a modern color palette with support for both light and dark themes:
- **Primary**: Blue (#2563eb) for primary actions and highlights
- **Secondary**: Gray (#f1f5f9) for secondary elements
- **Background**: Dynamic based on system theme preference
- **Custom Shadows**: Soft shadows optimized for mobile viewing

## UI Components

### Core Components
- **Button**: Multiple variants (default, outline, ghost, secondary)
- **Card**: Container component with consistent spacing
- **Input/Textarea**: Form elements with proper mobile optimization
- **Avatar**: User profile images with fallbacks
- **Badge**: Status indicators and labels
- **Bottom Navigation**: Fixed navigation with active state indicators

### Layout Features
- **Sticky Headers**: Important navigation stays accessible
- **Safe Areas**: Proper padding for mobile devices
- **Touch Targets**: All interactive elements sized for finger navigation
- **Loading States**: Smooth transitions and feedback

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open browser**: Navigate to `http://localhost:3000`

## Mobile Optimization

- **Viewport**: Properly configured for mobile devices
- **Touch Interactions**: All buttons and links optimized for touch
- **Performance**: Optimized images and efficient rendering
- **PWA Ready**: Can be installed as a mobile app
- **Responsive Images**: Automatically sized for different screen densities

## Future Enhancements

- **Push Notifications**: Real-time alerts when new deals are found
- **Advanced Filters**: More granular search criteria
- **Deal Comparison**: Side-by-side comparison of similar listings
- **Saved Favorites**: Bookmark specific listings
- **Price History**: Track price changes over time
- **Social Features**: Share deals with friends
- **API Integration**: Connect with real car listing services

## Browser Support

- **Mobile**: iOS Safari 12+, Chrome Mobile 70+
- **Desktop**: Chrome 70+, Firefox 65+, Safari 12+, Edge 79+

## Development Notes

- **Mobile-First**: All components designed for mobile, then enhanced for desktop
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Performance**: Optimized for mobile networks and devices
- **SEO**: Proper meta tags and semantic HTML structure


## Backend Listing sources:

- **Dubicars.com**: 8531 Listings

---

Built with ❤️ for car enthusiasts and deal hunters.
