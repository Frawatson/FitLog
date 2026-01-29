# FitLog - Fitness Tracking App

## Overview
FitLog is a comprehensive fitness tracking mobile app built with React Native (Expo) and Express.js. It allows users to log workouts, track progress with rule-based progression suggestions, monitor nutrition, and track body weight.

## Current State
MVP completed with the following features:
- User onboarding with profile setup and goal selection
- Workout routine builder with exercise library
- Workout logging with rest timer and set tracking
- Rule-based progression engine (suggests weight increases/decreases)
- Nutrition tracking with macro targets
- Body weight logging and history
- Workout history

## Project Architecture

### Frontend (React Native / Expo)
- **Location**: `client/`
- **Navigation**: Tab-based with 4 tabs (Home, Routines, Nutrition, Profile)
- **State**: Local storage with AsyncStorage (no backend database in MVP)
- **Design**: Bold athletic theme with orange (#FF4500) primary color

### Backend (Express.js)
- **Location**: `server/`
- **Port**: 5000
- **Purpose**: Currently serves landing page and static Expo builds

### Shared
- **Location**: `shared/`
- **Contains**: Type definitions and schemas

## Key Files

### Frontend
- `client/App.tsx` - Main app entry with navigation and providers
- `client/navigation/RootStackNavigator.tsx` - Root navigation with all screens
- `client/navigation/MainTabNavigator.tsx` - Bottom tab navigation
- `client/lib/storage.ts` - AsyncStorage utilities for data persistence
- `client/types/index.ts` - TypeScript type definitions
- `client/constants/theme.ts` - Design system colors, spacing, typography

### Screens
- `DashboardScreen` - Home tab with quick stats and workout start
- `RoutinesScreen` - List of workout routines
- `EditRoutineScreen` - Create/edit routines with exercise selection
- `ActiveWorkoutScreen` - Workout logging with sets, weight, reps
- `WorkoutCompleteScreen` - Post-workout summary with progression suggestions
- `NutritionScreen` - Daily macro tracking with progress rings
- `AddFoodScreen` - Log food entries
- `ProfileScreen` - User settings, body weight, history

### Components
- `Button`, `Card`, `Input` - Core UI components
- `ProgressRing` - Animated circular progress indicator
- `EmptyState` - Illustrated empty state component
- `ErrorBoundary` - App crash recovery

## Data Storage
All data is stored locally using AsyncStorage:
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

## Recent Changes
- January 2026: Initial MVP release
  - Complete onboarding flow
  - Workout routine builder
  - Workout logging with rest timer
  - Progression engine
  - Nutrition tracking
  - Body weight logging
