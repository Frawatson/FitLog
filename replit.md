# Merge - Fitness Tracking App

## Overview
Merge is a comprehensive fitness tracking mobile app built with React Native (Expo) and Express.js. It allows users to log workouts, track progress with rule-based progression suggestions, monitor nutrition, and track body weight.

## Current State
MVP completed with the following features:
- **User Authentication** - Full login/register system with PostgreSQL database
  - **Enhanced Security**: Rate limiting (5 attempts/15 min), account lockout after 5 failures, strong password validation (8+ chars, uppercase, lowercase, number, special char), helmet security headers
- User onboarding with profile setup and goal selection
- Workout routine builder with exercise library
- **10 pre-built workout routine templates** (Push/Pull/Legs, Upper/Lower, Full Body, Beginner, etc.) with browse and customize functionality
- **Generate Custom Routine** - Routine generator using WorkoutAPI + comprehensive local database (165+ exercises) with muscle group and difficulty selection
- Workout logging with rest timer and set tracking
- Rule-based progression engine (suggests weight increases/decreases)
- **Streak Tracking** - Current and longest workout streak displayed on Dashboard with celebration badges
- **GPS Run Tracker** - track runs with distance, pace, duration, route history, and **heart rate zones**
- **Heart Rate Zones** - 5 zones (Warm Up, Fat Burn, Cardio, Threshold, Max Effort) based on age, with post-run HR entry and zone history
- Nutrition tracking with macro targets
- **Food Database** with 85+ common foods and auto-populate search for quick logging
- Body weight logging and history
- Workout history
- **Push Notifications** - Daily workout reminders, streak alerts (mobile only via Expo Go)
- **Dark/Light Mode** - Theme toggle in Profile with system/light/dark options

## Project Architecture

### Frontend (React Native / Expo)
- **Location**: `client/`
- **Navigation**: Tab-based with 5 tabs (Home, Routines, Run, Nutrition, Profile)
- **State**: Local storage with AsyncStorage (no backend database in MVP)
- **Design**: Bold athletic theme with orange (#FF4500) primary color

### Backend (Express.js)
- **Location**: `server/`
- **Port**: 5000
- **Purpose**: Serves landing page, static Expo builds, and API endpoints
- **Database**: PostgreSQL with express-session for session management
- **API Endpoints**:
  - `POST /api/auth/register` - User registration with bcrypt password hashing
  - `POST /api/auth/login` - User authentication with session creation
  - `POST /api/auth/logout` - Session destruction
  - `GET /api/auth/me` - Get current user info
  - `PUT /api/auth/profile` - Update user profile
  - `GET /api/exercises` - Fetches exercises from WorkoutAPI by muscle group
  - `POST /api/generate-routine` - Generates a complete workout routine from selected muscle groups
  - `GET /api/foods/search` - Searches FatSecret food database (falls back to local DB if API unavailable)

### Shared
- **Location**: `shared/`
- **Contains**: Type definitions and schemas

## Key Files

### Frontend
- `client/App.tsx` - Main app entry with navigation and providers
- `client/contexts/AuthContext.tsx` - Authentication state management
- `client/contexts/ThemeContext.tsx` - Dark/light mode theme management
- `client/navigation/RootStackNavigator.tsx` - Root navigation with auth flow
- `client/navigation/MainTabNavigator.tsx` - Bottom tab navigation
- `client/lib/storage.ts` - AsyncStorage utilities for data persistence
- `client/lib/routineTemplates.ts` - Pre-built workout routine templates (10 templates)
- `client/lib/foodDatabase.ts` - Food database with 85+ foods and search function
- `client/lib/notifications.ts` - Push notification scheduling and management
- `client/lib/heartRateZones.ts` - Heart rate zone calculations based on age
- `client/types/index.ts` - TypeScript type definitions
- `client/constants/theme.ts` - Design system colors, spacing, typography

### Backend Files
- `server/db.ts` - PostgreSQL database connection and user queries
- `server/auth.ts` - Authentication routes (register, login, logout, profile)
- `server/index.ts` - Express app setup with session middleware
- `server/exerciseDatabase.ts` - Comprehensive local exercise database (165+ exercises across all muscle groups and difficulty levels)

### Screens
- `LoginScreen` - User login with email/password
- `RegisterScreen` - User registration with name/email/password
- `EditProfileScreen` - Edit user profile details
- `DashboardScreen` - Home tab with quick stats, workout start, and run tracker access
- `RoutinesScreen` - List of workout routines with template browsing
- `RoutineTemplatesScreen` - Browse and add pre-built workout templates
- `EditRoutineScreen` - Create/edit routines with exercise selection
- `ActiveWorkoutScreen` - Workout logging with sets, weight, reps
- `WorkoutCompleteScreen` - Post-workout summary with progression suggestions
- `RunTrackerScreen` - GPS run tracking with distance, pace, duration, and history
- `GenerateRoutineScreen` - AI-powered routine generator with muscle group and difficulty selection
- `NutritionScreen` - Daily macro tracking with progress rings
- `AddFoodScreen` - Log food entries with food database search and auto-populate
- `ProfileScreen` - User settings, body weight, history

### Components
- `Button`, `Card`, `Input` - Core UI components
- `ProgressRing` - Animated circular progress indicator
- `EmptyState` - Illustrated empty state component
- `ErrorBoundary` - App crash recovery
- `MapDisplay` - Platform-specific map component (native: react-native-maps, web: placeholder)

## Data Storage

### PostgreSQL Database (User Authentication)
- **users** table: id, email, password_hash, name, age, sex, height_cm, weight_kg, experience, goal, activity_level
- **session** table: Session storage for express-session (connect-pg-simple)

### Local Storage (AsyncStorage)
App data stored locally on device:
- User profile and onboarding status
- Macro targets (calculated or custom)
- Exercise library (defaults + custom)
- Workout routines
- Workout history
- Body weight entries
- Food log and saved foods

## Design Guidelines
- **Primary Color**: #FF4500 (Flame Orange)
- **Font**: Montserrat (Google Font)
- **Style**: Bold, athletic, high contrast
- **Theme**: Light/Dark mode support

## Running the App
1. Start Backend: `npm run server:dev` (port 5000)
2. Start Frontend: `npm run expo:dev` (port 8081)
3. Scan QR code in Expo Go app to test on device

## API Integrations
- **WorkoutAPI** (exercises): Uses WORKOUT_API_KEY secret, 30-min cache
- **CalorieNinjas** (nutrition): Uses CALORIENINJA_API_KEY secret for food nutrition data
  - Simple API key authentication, no IP restrictions
  - Falls back to local food database (85+ foods) when API is unavailable
- **OpenAI Vision** (photo food recognition): Uses Replit AI Integrations (AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL)
  - gpt-5-mini model for identifying foods from photos
  - Returns food name, estimated serving size, and confidence level
  - Automatically fetches nutrition data from CalorieNinjas after identification

## Recent Changes
- February 2026: Security, Notifications, Theme, and Heart Rate Features
  - **Enhanced Security**: Added rate limiting (5 attempts/15 min), account lockout after 5 failures, strong password validation, helmet security headers
  - **Streak Tracking**: Dashboard now displays current streak and longest streak with celebration badges
  - **Push Notifications**: Added expo-notifications with permission handling, daily workout reminders (6 PM), streak alerts, settings UI in Profile
  - **Dark/Light Mode**: Created ThemeContext with system/light/dark options, persistent storage, toggle in Profile
  - **Heart Rate Zones**: 5-zone system based on age (220-age formula), post-run HR input modal, zone display in run history with color coding
  - Added new files: ThemeContext.tsx, notifications.ts, heartRateZones.ts
- February 2026: Run Goals and Photo Food Logging
  - Added RunGoalScreen for setting distance (1-10 mi) or time (15-60 min) goals before starting runs
  - RunTrackerScreen now tracks progress toward goals with visual progress bar
  - Added RunCompleteAnimation component with confetti effects for goal completion
  - Created WorkoutCalendar component for Dashboard showing monthly activity with color-coded indicators
  - Added camera/photo integration to AddFoodScreen for taking food photos
  - Photo analysis endpoint for food recognition (requires AI vision API for full functionality)
- January 2026: User Authentication System
  - Added PostgreSQL database with users and session tables
  - Implemented register/login/logout with bcrypt password hashing
  - Session-based auth with express-session and connect-pg-simple
  - AuthContext for global auth state management
  - **Integrated account creation into onboarding flow** - new users create their account (email/password) as the first step of onboarding, then continue with profile setup
  - Login screen for existing users, "Sign Up" directs to onboarding
  - EditProfile screen for updating user details
  - Profile screen shows user info with edit and logout options
  - Navigation guards for authenticated routes
  - Profile data saved to both PostgreSQL (auth) and AsyncStorage (local)
- January 2026: CalorieNinjas Food API Integration
  - Integrated CalorieNinjas API for food nutrition data
  - Simple API key authentication
  - Automatic fallback to local food database when API unavailable
- January 2026: Workout API Integration
  - Integrated API Ninjas Exercises API (3,000+ exercises database)
  - Added Generate Custom Routine feature with muscle group and difficulty selection
  - Backend endpoints for fetching exercises and generating routines
  - Updated Run Tracker theme to match app's flame orange color scheme
- January 2026: UI/UX Improvements
  - Fixed routine cards to start workouts directly with play button
  - Added Run tab to main navigation (between Routines and Nutrition)
  - Redesigned Run Tracker with dark theme, map display, and stats (distance, time, speed, calories, splits)
  - Platform-specific map component (react-native-maps on native, placeholder on web)
- January 2026: Feature Update
  - Added 10 pre-built workout routine templates with browse/customize functionality
  - Added GPS Run Tracker with distance, pace, duration, and run history
  - Added Food Database with 85+ foods and auto-populate search
  - Updated Dashboard with Run Tracker quick access
  - Updated Routines screen with template browsing button
  - Updated Add Food screen with search and category filters
- January 2026: Initial MVP release
  - Complete onboarding flow
  - Workout routine builder
  - Workout logging with rest timer
  - Progression engine
  - Nutrition tracking
  - Body weight logging
