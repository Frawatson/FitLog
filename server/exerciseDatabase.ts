export interface LocalExercise {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  difficulty: "beginner" | "intermediate" | "expert";
  instructions: string;
  type: string;
}

export const exerciseDatabase: LocalExercise[] = [
  // CHEST EXERCISES
  { id: "chest-1", name: "Push-ups", muscle: "chest", equipment: "body only", difficulty: "beginner", instructions: "Start in plank position, lower chest to ground, push back up.", type: "strength" },
  { id: "chest-2", name: "Incline Push-ups", muscle: "chest", equipment: "body only", difficulty: "beginner", instructions: "Place hands on elevated surface, perform push-up motion.", type: "strength" },
  { id: "chest-3", name: "Knee Push-ups", muscle: "chest", equipment: "body only", difficulty: "beginner", instructions: "Push-ups with knees on ground for reduced resistance.", type: "strength" },
  { id: "chest-4", name: "Wide Push-ups", muscle: "chest", equipment: "body only", difficulty: "beginner", instructions: "Push-ups with hands placed wider than shoulder width.", type: "strength" },
  { id: "chest-5", name: "Dumbbell Bench Press", muscle: "chest", equipment: "dumbbell", difficulty: "beginner", instructions: "Lie on bench, press dumbbells up from chest level.", type: "strength" },
  { id: "chest-6", name: "Dumbbell Flyes", muscle: "chest", equipment: "dumbbell", difficulty: "intermediate", instructions: "Lie on bench, lower dumbbells in arc motion to sides.", type: "strength" },
  { id: "chest-7", name: "Incline Dumbbell Press", muscle: "chest", equipment: "dumbbell", difficulty: "intermediate", instructions: "Press dumbbells on incline bench targeting upper chest.", type: "strength" },
  { id: "chest-8", name: "Decline Push-ups", muscle: "chest", equipment: "body only", difficulty: "intermediate", instructions: "Feet elevated, hands on floor, perform push-up.", type: "strength" },
  { id: "chest-9", name: "Diamond Push-ups", muscle: "chest", equipment: "body only", difficulty: "intermediate", instructions: "Hands together forming diamond shape, perform push-up.", type: "strength" },
  { id: "chest-10", name: "Barbell Bench Press", muscle: "chest", equipment: "barbell", difficulty: "intermediate", instructions: "Lie on bench, lower bar to chest, press up.", type: "strength" },
  { id: "chest-11", name: "Cable Crossover", muscle: "chest", equipment: "cable", difficulty: "intermediate", instructions: "Pull cables from high position across body.", type: "strength" },
  { id: "chest-12", name: "Archer Push-ups", muscle: "chest", equipment: "body only", difficulty: "expert", instructions: "Wide push-up shifting weight to one arm.", type: "strength" },
  { id: "chest-13", name: "One-Arm Push-ups", muscle: "chest", equipment: "body only", difficulty: "expert", instructions: "Push-up using single arm for support.", type: "strength" },
  { id: "chest-14", name: "Weighted Dips", muscle: "chest", equipment: "other", difficulty: "expert", instructions: "Dips with added weight, lean forward for chest emphasis.", type: "strength" },
  { id: "chest-15", name: "Plyometric Push-ups", muscle: "chest", equipment: "body only", difficulty: "expert", instructions: "Explosive push-up with hands leaving ground.", type: "plyometrics" },

  // BACK EXERCISES
  { id: "back-1", name: "Bent Over Dumbbell Rows", muscle: "middle_back", equipment: "dumbbell", difficulty: "beginner", instructions: "Bend at hips, pull dumbbells to sides.", type: "strength" },
  { id: "back-2", name: "Seated Cable Row", muscle: "middle_back", equipment: "cable", difficulty: "beginner", instructions: "Sit at cable machine, pull handle to torso.", type: "strength" },
  { id: "back-3", name: "Lat Pulldown", muscle: "lats", equipment: "cable", difficulty: "beginner", instructions: "Pull bar down to chest, squeeze shoulder blades.", type: "strength" },
  { id: "back-4", name: "Assisted Pull-ups", muscle: "lats", equipment: "machine", difficulty: "beginner", instructions: "Use assistance to perform pull-up motion.", type: "strength" },
  { id: "back-5", name: "Superman Hold", muscle: "lower_back", equipment: "body only", difficulty: "beginner", instructions: "Lie face down, lift arms and legs off ground.", type: "strength" },
  { id: "back-6", name: "Reverse Snow Angels", muscle: "middle_back", equipment: "body only", difficulty: "beginner", instructions: "Lie face down, move arms in arc motion.", type: "strength" },
  { id: "back-7", name: "Pull-ups", muscle: "lats", equipment: "body only", difficulty: "intermediate", instructions: "Hang from bar, pull body up until chin over bar.", type: "strength" },
  { id: "back-8", name: "Barbell Bent Over Row", muscle: "middle_back", equipment: "barbell", difficulty: "intermediate", instructions: "Bend over, pull barbell to lower chest.", type: "strength" },
  { id: "back-9", name: "T-Bar Row", muscle: "middle_back", equipment: "barbell", difficulty: "intermediate", instructions: "Straddle bar, pull to chest with V-grip handle.", type: "strength" },
  { id: "back-10", name: "Single Arm Dumbbell Row", muscle: "middle_back", equipment: "dumbbell", difficulty: "intermediate", instructions: "One knee on bench, row dumbbell to hip.", type: "strength" },
  { id: "back-11", name: "Face Pulls", muscle: "middle_back", equipment: "cable", difficulty: "intermediate", instructions: "Pull rope to face, external rotate shoulders.", type: "strength" },
  { id: "back-12", name: "Chin-ups", muscle: "lats", equipment: "body only", difficulty: "intermediate", instructions: "Underhand grip pull-up, emphasizing biceps.", type: "strength" },
  { id: "back-13", name: "Deadlift", muscle: "lower_back", equipment: "barbell", difficulty: "intermediate", instructions: "Lift barbell from floor to standing position.", type: "strength" },
  { id: "back-14", name: "Weighted Pull-ups", muscle: "lats", equipment: "other", difficulty: "expert", instructions: "Pull-ups with added weight via belt or vest.", type: "strength" },
  { id: "back-15", name: "Muscle-ups", muscle: "lats", equipment: "body only", difficulty: "expert", instructions: "Pull-up transitioning to dip above bar.", type: "strength" },
  { id: "back-16", name: "Pendlay Row", muscle: "middle_back", equipment: "barbell", difficulty: "expert", instructions: "Explosive row from floor to chest each rep.", type: "strength" },
  { id: "back-17", name: "One-Arm Pull-up", muscle: "lats", equipment: "body only", difficulty: "expert", instructions: "Pull-up using single arm.", type: "strength" },

  // SHOULDER EXERCISES
  { id: "shoulders-1", name: "Dumbbell Shoulder Press", muscle: "shoulders", equipment: "dumbbell", difficulty: "beginner", instructions: "Press dumbbells overhead from shoulder height.", type: "strength" },
  { id: "shoulders-2", name: "Lateral Raises", muscle: "shoulders", equipment: "dumbbell", difficulty: "beginner", instructions: "Raise dumbbells to sides until arm parallel to floor.", type: "strength" },
  { id: "shoulders-3", name: "Front Raises", muscle: "shoulders", equipment: "dumbbell", difficulty: "beginner", instructions: "Raise dumbbells in front to shoulder height.", type: "strength" },
  { id: "shoulders-4", name: "Reverse Flyes", muscle: "shoulders", equipment: "dumbbell", difficulty: "beginner", instructions: "Bent over, raise dumbbells to sides for rear delts.", type: "strength" },
  { id: "shoulders-5", name: "Pike Push-ups", muscle: "shoulders", equipment: "body only", difficulty: "beginner", instructions: "Push-up in pike position targeting shoulders.", type: "strength" },
  { id: "shoulders-6", name: "Military Press", muscle: "shoulders", equipment: "barbell", difficulty: "intermediate", instructions: "Press barbell overhead from front of shoulders.", type: "strength" },
  { id: "shoulders-7", name: "Arnold Press", muscle: "shoulders", equipment: "dumbbell", difficulty: "intermediate", instructions: "Rotating dumbbell press hitting all delt heads.", type: "strength" },
  { id: "shoulders-8", name: "Upright Rows", muscle: "shoulders", equipment: "barbell", difficulty: "intermediate", instructions: "Pull barbell up along body to chin height.", type: "strength" },
  { id: "shoulders-9", name: "Cable Lateral Raises", muscle: "shoulders", equipment: "cable", difficulty: "intermediate", instructions: "Single arm lateral raise using cable.", type: "strength" },
  { id: "shoulders-10", name: "Face Pulls", muscle: "shoulders", equipment: "cable", difficulty: "intermediate", instructions: "Pull rope to face for rear delt and rotator cuff.", type: "strength" },
  { id: "shoulders-11", name: "Handstand Push-ups", muscle: "shoulders", equipment: "body only", difficulty: "expert", instructions: "Push-up in handstand against wall.", type: "strength" },
  { id: "shoulders-12", name: "Behind Neck Press", muscle: "shoulders", equipment: "barbell", difficulty: "expert", instructions: "Press barbell overhead from behind neck.", type: "strength" },
  { id: "shoulders-13", name: "Cuban Press", muscle: "shoulders", equipment: "dumbbell", difficulty: "expert", instructions: "Upright row to external rotation to press.", type: "strength" },

  // BICEPS EXERCISES
  { id: "biceps-1", name: "Dumbbell Bicep Curls", muscle: "biceps", equipment: "dumbbell", difficulty: "beginner", instructions: "Curl dumbbells from sides to shoulders.", type: "strength" },
  { id: "biceps-2", name: "Hammer Curls", muscle: "biceps", equipment: "dumbbell", difficulty: "beginner", instructions: "Neutral grip curls targeting brachialis.", type: "strength" },
  { id: "biceps-3", name: "Resistance Band Curls", muscle: "biceps", equipment: "bands", difficulty: "beginner", instructions: "Curl using resistance band under feet.", type: "strength" },
  { id: "biceps-4", name: "Concentration Curls", muscle: "biceps", equipment: "dumbbell", difficulty: "beginner", instructions: "Seated, elbow on inner thigh, curl dumbbell.", type: "strength" },
  { id: "biceps-5", name: "Barbell Curls", muscle: "biceps", equipment: "barbell", difficulty: "intermediate", instructions: "Curl barbell with underhand grip.", type: "strength" },
  { id: "biceps-6", name: "Preacher Curls", muscle: "biceps", equipment: "dumbbell", difficulty: "intermediate", instructions: "Curl on preacher bench for isolation.", type: "strength" },
  { id: "biceps-7", name: "Incline Dumbbell Curls", muscle: "biceps", equipment: "dumbbell", difficulty: "intermediate", instructions: "Curls on incline bench for stretch.", type: "strength" },
  { id: "biceps-8", name: "Cable Curls", muscle: "biceps", equipment: "cable", difficulty: "intermediate", instructions: "Curl using low cable attachment.", type: "strength" },
  { id: "biceps-9", name: "Spider Curls", muscle: "biceps", equipment: "dumbbell", difficulty: "intermediate", instructions: "Curl on incline bench facing down.", type: "strength" },
  { id: "biceps-10", name: "Zottman Curls", muscle: "biceps", equipment: "dumbbell", difficulty: "expert", instructions: "Curl up supinated, lower pronated.", type: "strength" },
  { id: "biceps-11", name: "21s", muscle: "biceps", equipment: "barbell", difficulty: "expert", instructions: "7 lower half, 7 upper half, 7 full curls.", type: "strength" },
  { id: "biceps-12", name: "Drag Curls", muscle: "biceps", equipment: "barbell", difficulty: "expert", instructions: "Curl while dragging bar up torso.", type: "strength" },

  // TRICEPS EXERCISES
  { id: "triceps-1", name: "Tricep Dips (Bench)", muscle: "triceps", equipment: "body only", difficulty: "beginner", instructions: "Dips using bench with feet on floor.", type: "strength" },
  { id: "triceps-2", name: "Overhead Tricep Extension", muscle: "triceps", equipment: "dumbbell", difficulty: "beginner", instructions: "Extend dumbbell overhead, lower behind head.", type: "strength" },
  { id: "triceps-3", name: "Tricep Kickbacks", muscle: "triceps", equipment: "dumbbell", difficulty: "beginner", instructions: "Bent over, extend arm back squeezing tricep.", type: "strength" },
  { id: "triceps-4", name: "Diamond Push-ups", muscle: "triceps", equipment: "body only", difficulty: "beginner", instructions: "Push-up with hands together for tricep focus.", type: "strength" },
  { id: "triceps-5", name: "Rope Pushdowns", muscle: "triceps", equipment: "cable", difficulty: "intermediate", instructions: "Push rope down, spread at bottom.", type: "strength" },
  { id: "triceps-6", name: "Skull Crushers", muscle: "triceps", equipment: "barbell", difficulty: "intermediate", instructions: "Lower bar to forehead, extend back up.", type: "strength" },
  { id: "triceps-7", name: "Close Grip Bench Press", muscle: "triceps", equipment: "barbell", difficulty: "intermediate", instructions: "Bench press with narrow grip.", type: "strength" },
  { id: "triceps-8", name: "Parallel Bar Dips", muscle: "triceps", equipment: "body only", difficulty: "intermediate", instructions: "Dips on parallel bars, body upright.", type: "strength" },
  { id: "triceps-9", name: "Cable Overhead Extension", muscle: "triceps", equipment: "cable", difficulty: "intermediate", instructions: "Face away from cable, extend overhead.", type: "strength" },
  { id: "triceps-10", name: "Weighted Dips", muscle: "triceps", equipment: "other", difficulty: "expert", instructions: "Parallel bar dips with added weight.", type: "strength" },
  { id: "triceps-11", name: "JM Press", muscle: "triceps", equipment: "barbell", difficulty: "expert", instructions: "Hybrid between close grip and skull crusher.", type: "strength" },
  { id: "triceps-12", name: "Tate Press", muscle: "triceps", equipment: "dumbbell", difficulty: "expert", instructions: "Lower dumbbells to chest with elbows out.", type: "strength" },

  // QUADRICEPS EXERCISES
  { id: "quads-1", name: "Bodyweight Squats", muscle: "quadriceps", equipment: "body only", difficulty: "beginner", instructions: "Stand, lower hips back and down, stand up.", type: "strength" },
  { id: "quads-2", name: "Wall Sit", muscle: "quadriceps", equipment: "body only", difficulty: "beginner", instructions: "Back against wall, thighs parallel to floor.", type: "strength" },
  { id: "quads-3", name: "Step-ups", muscle: "quadriceps", equipment: "body only", difficulty: "beginner", instructions: "Step onto platform, drive through heel.", type: "strength" },
  { id: "quads-4", name: "Lunges", muscle: "quadriceps", equipment: "body only", difficulty: "beginner", instructions: "Step forward, lower back knee toward ground.", type: "strength" },
  { id: "quads-5", name: "Leg Press", muscle: "quadriceps", equipment: "machine", difficulty: "beginner", instructions: "Press platform away using legs.", type: "strength" },
  { id: "quads-6", name: "Goblet Squats", muscle: "quadriceps", equipment: "dumbbell", difficulty: "intermediate", instructions: "Hold dumbbell at chest, squat deep.", type: "strength" },
  { id: "quads-7", name: "Barbell Back Squat", muscle: "quadriceps", equipment: "barbell", difficulty: "intermediate", instructions: "Bar on back, squat to parallel or below.", type: "strength" },
  { id: "quads-8", name: "Front Squats", muscle: "quadriceps", equipment: "barbell", difficulty: "intermediate", instructions: "Bar on front shoulders, squat upright.", type: "strength" },
  { id: "quads-9", name: "Bulgarian Split Squats", muscle: "quadriceps", equipment: "dumbbell", difficulty: "intermediate", instructions: "Rear foot elevated, single leg squat.", type: "strength" },
  { id: "quads-10", name: "Leg Extensions", muscle: "quadriceps", equipment: "machine", difficulty: "intermediate", instructions: "Extend legs against pad for isolation.", type: "strength" },
  { id: "quads-11", name: "Hack Squats", muscle: "quadriceps", equipment: "machine", difficulty: "intermediate", instructions: "Squat on hack squat machine.", type: "strength" },
  { id: "quads-12", name: "Pistol Squats", muscle: "quadriceps", equipment: "body only", difficulty: "expert", instructions: "Single leg squat with other leg extended.", type: "strength" },
  { id: "quads-13", name: "Sissy Squats", muscle: "quadriceps", equipment: "body only", difficulty: "expert", instructions: "Lean back, lower knees forward, rise up.", type: "strength" },
  { id: "quads-14", name: "Pause Squats", muscle: "quadriceps", equipment: "barbell", difficulty: "expert", instructions: "Squat with 3 second pause at bottom.", type: "strength" },

  // HAMSTRINGS EXERCISES
  { id: "hams-1", name: "Lying Leg Curls", muscle: "hamstrings", equipment: "machine", difficulty: "beginner", instructions: "Lie face down, curl weight toward glutes.", type: "strength" },
  { id: "hams-2", name: "Good Mornings", muscle: "hamstrings", equipment: "body only", difficulty: "beginner", instructions: "Hands behind head, hinge at hips forward.", type: "strength" },
  { id: "hams-3", name: "Glute Bridge", muscle: "hamstrings", equipment: "body only", difficulty: "beginner", instructions: "Lie on back, drive hips up squeezing glutes.", type: "strength" },
  { id: "hams-4", name: "Seated Leg Curls", muscle: "hamstrings", equipment: "machine", difficulty: "beginner", instructions: "Seated curl targeting hamstrings.", type: "strength" },
  { id: "hams-5", name: "Romanian Deadlift", muscle: "hamstrings", equipment: "barbell", difficulty: "intermediate", instructions: "Hinge at hips, lower bar along legs.", type: "strength" },
  { id: "hams-6", name: "Stiff Leg Deadlift", muscle: "hamstrings", equipment: "barbell", difficulty: "intermediate", instructions: "Deadlift with minimal knee bend.", type: "strength" },
  { id: "hams-7", name: "Single Leg Romanian Deadlift", muscle: "hamstrings", equipment: "dumbbell", difficulty: "intermediate", instructions: "Hinge on one leg, other leg extends back.", type: "strength" },
  { id: "hams-8", name: "Swiss Ball Leg Curls", muscle: "hamstrings", equipment: "exercise ball", difficulty: "intermediate", instructions: "Feet on ball, curl ball toward glutes.", type: "strength" },
  { id: "hams-9", name: "Nordic Curls", muscle: "hamstrings", equipment: "body only", difficulty: "expert", instructions: "Kneel, lower body forward with control.", type: "strength" },
  { id: "hams-10", name: "Glute Ham Raise", muscle: "hamstrings", equipment: "machine", difficulty: "expert", instructions: "Full hip and knee extension on GHD.", type: "strength" },
  { id: "hams-11", name: "Deficit Romanian Deadlift", muscle: "hamstrings", equipment: "barbell", difficulty: "expert", instructions: "RDL standing on platform for extra ROM.", type: "strength" },

  // GLUTES EXERCISES
  { id: "glutes-1", name: "Glute Bridge", muscle: "glutes", equipment: "body only", difficulty: "beginner", instructions: "Lie on back, drive hips up.", type: "strength" },
  { id: "glutes-2", name: "Clamshells", muscle: "glutes", equipment: "body only", difficulty: "beginner", instructions: "Side lying, open and close knees.", type: "strength" },
  { id: "glutes-3", name: "Donkey Kicks", muscle: "glutes", equipment: "body only", difficulty: "beginner", instructions: "On all fours, kick one leg back.", type: "strength" },
  { id: "glutes-4", name: "Fire Hydrants", muscle: "glutes", equipment: "body only", difficulty: "beginner", instructions: "On all fours, lift leg to side.", type: "strength" },
  { id: "glutes-5", name: "Hip Thrusts", muscle: "glutes", equipment: "barbell", difficulty: "intermediate", instructions: "Back on bench, thrust hips up with bar.", type: "strength" },
  { id: "glutes-6", name: "Cable Pull Through", muscle: "glutes", equipment: "cable", difficulty: "intermediate", instructions: "Face away from cable, hinge and thrust.", type: "strength" },
  { id: "glutes-7", name: "Sumo Squats", muscle: "glutes", equipment: "dumbbell", difficulty: "intermediate", instructions: "Wide stance squat with glute emphasis.", type: "strength" },
  { id: "glutes-8", name: "Kettlebell Swings", muscle: "glutes", equipment: "kettlebell", difficulty: "intermediate", instructions: "Swing kettlebell using hip drive.", type: "strength" },
  { id: "glutes-9", name: "Barbell Hip Thrusts", muscle: "glutes", equipment: "barbell", difficulty: "intermediate", instructions: "Heavy hip thrusts with barbell.", type: "strength" },
  { id: "glutes-10", name: "Single Leg Hip Thrust", muscle: "glutes", equipment: "body only", difficulty: "expert", instructions: "Hip thrust on one leg.", type: "strength" },
  { id: "glutes-11", name: "Frog Pumps", muscle: "glutes", equipment: "body only", difficulty: "expert", instructions: "Feet together, knees out, thrust hips.", type: "strength" },

  // CALVES EXERCISES
  { id: "calves-1", name: "Standing Calf Raises", muscle: "calves", equipment: "body only", difficulty: "beginner", instructions: "Rise up on toes, lower with control.", type: "strength" },
  { id: "calves-2", name: "Seated Calf Raises", muscle: "calves", equipment: "machine", difficulty: "beginner", instructions: "Seated, raise heels against resistance.", type: "strength" },
  { id: "calves-3", name: "Calf Raises on Step", muscle: "calves", equipment: "body only", difficulty: "beginner", instructions: "Heels off step, raise and lower.", type: "strength" },
  { id: "calves-4", name: "Machine Standing Calf Raises", muscle: "calves", equipment: "machine", difficulty: "intermediate", instructions: "Weighted standing calf raise.", type: "strength" },
  { id: "calves-5", name: "Donkey Calf Raises", muscle: "calves", equipment: "machine", difficulty: "intermediate", instructions: "Bent over calf raise with weight on hips.", type: "strength" },
  { id: "calves-6", name: "Single Leg Calf Raises", muscle: "calves", equipment: "body only", difficulty: "intermediate", instructions: "Calf raise on one leg.", type: "strength" },
  { id: "calves-7", name: "Smith Machine Calf Raises", muscle: "calves", equipment: "machine", difficulty: "expert", instructions: "Heavy calf raises on smith machine.", type: "strength" },
  { id: "calves-8", name: "Explosive Calf Raises", muscle: "calves", equipment: "body only", difficulty: "expert", instructions: "Jump off ground from calf raise.", type: "plyometrics" },

  // CORE/ABS EXERCISES
  { id: "abs-1", name: "Crunches", muscle: "abdominals", equipment: "body only", difficulty: "beginner", instructions: "Lie on back, curl shoulders toward knees.", type: "strength" },
  { id: "abs-2", name: "Plank", muscle: "abdominals", equipment: "body only", difficulty: "beginner", instructions: "Hold push-up position on forearms.", type: "strength" },
  { id: "abs-3", name: "Dead Bug", muscle: "abdominals", equipment: "body only", difficulty: "beginner", instructions: "Lie on back, extend opposite arm and leg.", type: "strength" },
  { id: "abs-4", name: "Bird Dog", muscle: "abdominals", equipment: "body only", difficulty: "beginner", instructions: "On all fours, extend opposite arm and leg.", type: "strength" },
  { id: "abs-5", name: "Mountain Climbers", muscle: "abdominals", equipment: "body only", difficulty: "beginner", instructions: "Plank position, drive knees to chest.", type: "cardio" },
  { id: "abs-6", name: "Bicycle Crunches", muscle: "abdominals", equipment: "body only", difficulty: "intermediate", instructions: "Elbow to opposite knee in cycling motion.", type: "strength" },
  { id: "abs-7", name: "Hanging Knee Raises", muscle: "abdominals", equipment: "body only", difficulty: "intermediate", instructions: "Hang from bar, raise knees to chest.", type: "strength" },
  { id: "abs-8", name: "Russian Twists", muscle: "abdominals", equipment: "body only", difficulty: "intermediate", instructions: "Seated, rotate torso side to side.", type: "strength" },
  { id: "abs-9", name: "Ab Wheel Rollouts", muscle: "abdominals", equipment: "other", difficulty: "intermediate", instructions: "Roll wheel forward, return to start.", type: "strength" },
  { id: "abs-10", name: "Cable Woodchops", muscle: "abdominals", equipment: "cable", difficulty: "intermediate", instructions: "Rotate torso pulling cable diagonally.", type: "strength" },
  { id: "abs-11", name: "Hanging Leg Raises", muscle: "abdominals", equipment: "body only", difficulty: "expert", instructions: "Hang, raise straight legs to parallel.", type: "strength" },
  { id: "abs-12", name: "Dragon Flags", muscle: "abdominals", equipment: "body only", difficulty: "expert", instructions: "Lie on bench, raise body as one unit.", type: "strength" },
  { id: "abs-13", name: "L-Sit", muscle: "abdominals", equipment: "body only", difficulty: "expert", instructions: "Support body with legs extended parallel.", type: "strength" },
  { id: "abs-14", name: "Toes to Bar", muscle: "abdominals", equipment: "body only", difficulty: "expert", instructions: "Hang, swing legs up to touch bar.", type: "strength" },

  // FOREARMS EXERCISES
  { id: "forearms-1", name: "Wrist Curls", muscle: "forearms", equipment: "dumbbell", difficulty: "beginner", instructions: "Rest forearm, curl wrist up.", type: "strength" },
  { id: "forearms-2", name: "Reverse Wrist Curls", muscle: "forearms", equipment: "dumbbell", difficulty: "beginner", instructions: "Rest forearm, extend wrist up.", type: "strength" },
  { id: "forearms-3", name: "Farmer's Walk", muscle: "forearms", equipment: "dumbbell", difficulty: "beginner", instructions: "Walk while holding heavy weights.", type: "strength" },
  { id: "forearms-4", name: "Dead Hang", muscle: "forearms", equipment: "body only", difficulty: "beginner", instructions: "Hang from bar with straight arms.", type: "strength" },
  { id: "forearms-5", name: "Plate Pinch", muscle: "forearms", equipment: "other", difficulty: "intermediate", instructions: "Pinch weight plates together.", type: "strength" },
  { id: "forearms-6", name: "Behind Back Wrist Curls", muscle: "forearms", equipment: "barbell", difficulty: "intermediate", instructions: "Curl barbell behind back.", type: "strength" },
  { id: "forearms-7", name: "Towel Pull-ups", muscle: "forearms", equipment: "other", difficulty: "expert", instructions: "Pull-ups gripping towels.", type: "strength" },
  { id: "forearms-8", name: "One Arm Dead Hang", muscle: "forearms", equipment: "body only", difficulty: "expert", instructions: "Hang from bar with single arm.", type: "strength" },

  // TRAPS EXERCISES
  { id: "traps-1", name: "Dumbbell Shrugs", muscle: "traps", equipment: "dumbbell", difficulty: "beginner", instructions: "Hold dumbbells, shrug shoulders up.", type: "strength" },
  { id: "traps-2", name: "Face Pulls", muscle: "traps", equipment: "cable", difficulty: "beginner", instructions: "Pull rope to face, squeeze rear delts.", type: "strength" },
  { id: "traps-3", name: "Barbell Shrugs", muscle: "traps", equipment: "barbell", difficulty: "intermediate", instructions: "Heavy shrugs with barbell.", type: "strength" },
  { id: "traps-4", name: "Upright Rows", muscle: "traps", equipment: "barbell", difficulty: "intermediate", instructions: "Pull bar up along body to chin.", type: "strength" },
  { id: "traps-5", name: "Rack Pulls", muscle: "traps", equipment: "barbell", difficulty: "intermediate", instructions: "Deadlift from elevated pins.", type: "strength" },
  { id: "traps-6", name: "Farmer's Walk", muscle: "traps", equipment: "dumbbell", difficulty: "intermediate", instructions: "Walk with heavy weights, traps engaged.", type: "strength" },
  { id: "traps-7", name: "Power Shrugs", muscle: "traps", equipment: "barbell", difficulty: "expert", instructions: "Explosive shrug with heavy weight.", type: "strength" },
  { id: "traps-8", name: "Snatch Grip Shrugs", muscle: "traps", equipment: "barbell", difficulty: "expert", instructions: "Wide grip heavy shrugs.", type: "strength" },

  // FULL BODY / COMPOUND
  { id: "full-1", name: "Burpees", muscle: "quadriceps", equipment: "body only", difficulty: "intermediate", instructions: "Squat, jump back, push-up, jump up.", type: "cardio" },
  { id: "full-2", name: "Thrusters", muscle: "quadriceps", equipment: "dumbbell", difficulty: "intermediate", instructions: "Squat to overhead press in one motion.", type: "strength" },
  { id: "full-3", name: "Clean and Press", muscle: "shoulders", equipment: "barbell", difficulty: "expert", instructions: "Clean bar to shoulders, press overhead.", type: "olympic weightlifting" },
  { id: "full-4", name: "Snatch", muscle: "shoulders", equipment: "barbell", difficulty: "expert", instructions: "Lift bar from floor to overhead in one motion.", type: "olympic weightlifting" },
  { id: "full-5", name: "Turkish Get-up", muscle: "abdominals", equipment: "kettlebell", difficulty: "expert", instructions: "Rise from floor to standing with weight overhead.", type: "strength" },
];

export function getExercisesByMuscle(muscle: string): LocalExercise[] {
  const muscleMap: Record<string, string[]> = {
    chest: ["chest"],
    back: ["middle_back", "lats", "lower_back"],
    lats: ["lats"],
    middle_back: ["middle_back"],
    lower_back: ["lower_back"],
    shoulders: ["shoulders"],
    biceps: ["biceps"],
    triceps: ["triceps"],
    quadriceps: ["quadriceps"],
    hamstrings: ["hamstrings"],
    glutes: ["glutes"],
    calves: ["calves"],
    abdominals: ["abdominals"],
    forearms: ["forearms"],
    traps: ["traps"],
  };

  const targetMuscles = muscleMap[muscle.toLowerCase()] || [muscle.toLowerCase()];
  return exerciseDatabase.filter((ex) => targetMuscles.includes(ex.muscle));
}

export function getExercisesByDifficulty(
  exercises: LocalExercise[],
  difficulty: "beginner" | "intermediate" | "expert"
): LocalExercise[] {
  const difficultyOrder = { beginner: 0, intermediate: 1, expert: 2 };
  const maxDifficulty = difficultyOrder[difficulty];
  
  return exercises.filter((ex) => difficultyOrder[ex.difficulty] <= maxDifficulty);
}
