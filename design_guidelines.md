# FitLog - Design Guidelines

## Brand Identity

**Purpose**: A no-nonsense fitness tracking app for disciplined gym-goers who want progressive overload without complexity.

**Aesthetic Direction**: **Bold/Athletic** - High contrast, strong hierarchy, results-focused. Think stopwatch precision meets gym chalk. Avoid softness or playfulness - this is for serious lifters.

**Memorable Element**: Every workout completion triggers a satisfying weight progression card that slides up, showing exactly what to lift next session. This immediate feedback loop is THE defining moment.

---

## Navigation Architecture

**Root Navigation**: Tab Bar (4 tabs + floating action button)

**Tabs**:
1. **Home** - Dashboard with today's stats
2. **Routines** - Workout templates
3. **Nutrition** - Macro tracking
4. **Profile** - Settings, body weight, history

**Floating Action Button**: "Start Workout" (centered over tab bar, always visible)

**Modal Screens**: Login, Signup, Onboarding flow, Exercise selector, Food entry

---

## Screen-by-Screen Specifications

### Auth Flow
**Login/Signup Screens** (Stack-only)
- Transparent header, logo at top
- SSO buttons: Apple Sign-In (primary), Google Sign-In (secondary)
- Email/password fields below (collapsible "or use email" link)
- Links: Terms, Privacy Policy (footer)
- Safe area: top = insets.top + Spacing.xl, bottom = insets.bottom + Spacing.xl

### Onboarding (Stack-only, 4 steps)
**Step 1: Basic Profile**
- Scrollable form with inputs: Age, Sex, Height, Weight, Experience level
- Progress indicator (dots) at top
- CTA: "Next" button in header (right)

**Step 2: Goal Selection**
- Grid of 4 cards: Lose Fat, Gain Muscle, Recomposition, Maintain
- Single-select, cards highlight when selected
- CTA: "Next" in header

**Step 3: Activity Level**
- 2 radio options: 3-4 days/week, 5-6 days/week
- CTA: "Finish Setup" in header

**Step 4: Macro Results**
- Auto-calculated targets displayed prominently
- Editable fields (calories, protein, carbs, fat)
- CTA: "Start Training" button at bottom

### Home Tab (Dashboard)
- Custom transparent header with greeting: "Welcome back, [Name]"
- Scrollable content:
  - Today's workout card (if scheduled) OR "Rest Day" message
  - Quick stats: Last workout, current weight, calories today
  - Weekly progress summary (sets completed, weight trend)
- Safe area: top = headerHeight + Spacing.xl, bottom = tabBarHeight + Spacing.xl

### Routines Tab
**Routines List Screen**
- Default header with "Routines" title, "+" button (right)
- List of user routines (cards showing: name, # exercises, last completed)
- Empty state: "No routines yet" with CTA
- Safe area: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl

**Routine Editor Screen** (Modal or Stack)
- Header: "New Routine" or "[Name]", Cancel (left), Save (right)
- Scrollable form:
  - Routine Name input
  - Training Days (multi-select chips)
  - Exercise list (draggable, with delete swipe)
  - "Add Exercise" button (opens exercise library modal)
- Safe area: top = Spacing.xl, bottom = Spacing.xl

### Start Workout Flow (Modal from FAB)
**Workout Screen**
- Transparent header: Routine name (title), "X" close (left), Timer icon (right)
- Scrollable list of exercises with expandable sets
- Each set row: Set #, Weight input, Reps input, Checkmark
- "Add Set" button per exercise
- "Use Last Workout" chip at top (one-tap autofill)
- Floating "Finish Workout" button at bottom
- Safe area: top = headerHeight + Spacing.xl, bottom = Spacing.xl + 60 (floating button height)

**Rest Timer Modal** (bottom sheet)
- Large countdown timer
- Start/Pause, Reset buttons
- Auto-dismisses or swipe down to close

### Nutrition Tab
- Default header with "Nutrition" title
- Scrollable content:
  - Today's date picker (horizontal scroll)
  - Macro progress rings (Calories, Protein, Carbs, Fat)
  - Logged foods list (swipe to delete)
  - "Add Food" button
- Safe area: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl

**Food Entry Modal**
- Header: "Add Food", Cancel (left), Save (right)
- Form: Food name, Calories, Protein, Carbs, Fat
- "Save as favorite" toggle
- Submit button in header (right)

### Profile Tab
**Profile Screen**
- Default header with "Profile" title
- Scrollable sections:
  - User avatar (tap to change), Name, Email
  - Bodyweight chart (simple line)
  - "Log Weight" button
  - Settings list: Account, Reminders, Macros, Log Out
- Safe area: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl

**History Screen** (nested in Profile)
- Default header with "History" title
- List of past workouts (date, routine, duration)
- Tap to view exercise details

**Exercise History Screen**
- Header: Exercise name (title), Back (left)
- Table showing: Date, Weight, Reps per set
- No charts yet

---

## Color Palette

**Primary**: #FF4500 (Flame Orange) - aggressive, energizing
**Secondary**: #1A1A1A (Near Black) - strength, seriousness
**Accent**: #00D084 (Success Green) - progression, achievement
**Background**: #FFFFFF (White)
**Surface**: #F5F5F5 (Light Gray)
**Text Primary**: #1A1A1A
**Text Secondary**: #666666
**Border**: #E0E0E0
**Error**: #D32F2F

**Usage**:
- Primary: FAB, primary CTAs, active states
- Accent: Progression cards, completed checkmarks, macro progress
- Secondary: Headers, icons, bold text

---

## Typography

**Font**: **Montserrat** (Google Font) - bold, athletic, geometric
**Type Scale**:
- Display: 32pt Bold (onboarding titles)
- H1: 24pt Bold (screen titles)
- H2: 20pt SemiBold (section headers)
- H3: 16pt SemiBold (card titles)
- Body: 16pt Regular (inputs, lists)
- Caption: 14pt Regular (labels, timestamps)
- Button: 16pt Bold (CTAs)

---

## Visual Design

- **Icons**: Feather icons from @expo/vector-icons (dumbbell, trending-up, calendar, user)
- **Touchable Feedback**: 0.85 opacity on press
- **Cards**: 12px border radius, subtle border (not shadow)
- **FAB Shadow**: shadowOffset {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2
- **Forms**: Underlined inputs (no boxes), red border on error
- **Progress Rings**: Thick stroke (8px), animated fill

---

## Assets to Generate

1. **icon.png** - App icon with dumbbell/weight plate motif in orange/black, WHERE USED: Device home screen
2. **splash-icon.png** - Simplified icon for launch, WHERE USED: App launch screen
3. **empty-routines.png** - Minimalist dumbbell illustration, WHERE USED: Routines tab empty state
4. **empty-history.png** - Calendar with checkmark, WHERE USED: History screen empty state
5. **empty-foods.png** - Plate icon, WHERE USED: Nutrition tab empty state (no foods logged)
6. **progression-trophy.png** - Small trophy icon, WHERE USED: Progression card (weight increase celebration)
7. **avatar-default.png** - Generic user silhouette, WHERE USED: Profile avatar placeholder

All assets: Flat, 2-color (orange + black), athletic/geometric style.