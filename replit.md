# FitLog - Fitness Tracking App

## Overview
FitLog is a comprehensive fitness tracking mobile app built with React Native (Expo) and Express.js. It allows users to log workouts, track progress with rule-based progression suggestions, monitor nutrition, and track body weight.

## Current State
MVP completed with the following features:
- User onboarding with profile setup and goal selection
- Workout routine builder with exercise library
- **10 pre-built workout routine templates** (Push/Pull/Legs, Upper/Lower, Full Body, Beginner, etc.) with browse and customize functionality
- Workout logging with rest timer and set tracking
- Rule-based progression engine (suggests weight increases/decreases)
- **GPS Run Tracker** - track runs with distance, pace, duration, and route history
- Nutrition tracking with macro targets
- **Food Database** with 85+ common foods and auto-populate search for quick logging
- Body weight logging and history
- Workout history

## Project Architecture

### Frontend (React Native / Expo)
- **Location**: `client/`
- **Navigation**: Tab-based with 5 tabs (Home, Routines, Run, Nutrition, Profile)
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
- `client/lib/routineTemplates.ts` - Pre-built workout routine templates (10 templates)
- `client/lib/foodDatabase.ts` - Food database with 85+ foods and search function
- `client/types/index.ts` - TypeScript type definitions
- `client/constants/theme.ts` - Design system colors, spacing, typography

### Screens
- `DashboardScreen` - Home tab with quick stats, workout start, and run tracker access
- `RoutinesScreen` - List of workout routines with template browsing
- `RoutineTemplatesScreen` - Browse and add pre-built workout templates
- `EditRoutineScreen` - Create/edit routines with exercise selection
- `ActiveWorkoutScreen` - Workout logging with sets, weight, reps
- `WorkoutCompleteScreen` - Post-workout summary with progression suggestions
- `RunTrackerScreen` - GPS run tracking with distance, pace, duration, and history
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
