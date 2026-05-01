const express = require("express");
const protect = require("../middleware/authMiddleware");
const Activity = require("../models/Activity");
const DashboardData = require("../models/DashboardData");
const User = require("../models/User");
const { generateChatReply, getChatProviderStatus } = require("../services/chatAssistantService");

const router = express.Router();

function isUserAccount(user) {
  return (user?.role || "user") === "user";
}

function defaultActivity() {
  return [
    { action: "Completed", detail: "12,480 steps today." },
    { action: "Logged", detail: "breakfast with 32g protein." },
    { action: "Improved", detail: "weekly sleep score by 9%." }
  ];
}

async function saveDashboardData(userId, eventType, label, payload = {}) {
  return DashboardData.create({
    user: userId,
    eventType,
    label,
    payload,
    source: "dashboard"
  });
}

function buildAchievements(user, preferences) {
  const badges = [];
  const streak = user.streak || 1;
  const totalLoginDays = user.totalLoginDays || streak;

  if (streak >= 1) {
    badges.push("Starter login");
  }
  if (streak >= 3) {
    badges.push("3 day streak");
  }
  if (streak >= 7) {
    badges.push("7 day streak");
  }
  if (streak >= 15) {
    badges.push("15 day streak");
  }
  if (streak >= 30) {
    badges.push("30 day streak");
  }
  if (totalLoginDays >= 10) {
    badges.push("Regular tracker");
  }
  if ((preferences?.hydrationGoal || 0) >= 4) {
    badges.push("Hydration hero");
  }
  if ((preferences?.workoutDays || 0) >= 5) {
    badges.push("Weekly warrior");
  }

  return badges.slice(0, 6);
}

function toTitleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

function workoutLibrary(type, level, duration) {
  const plans = {
    strength: [
      { title: "Warm-up mobility", meta: "8 min" },
      { title: "Push-ups and rows", meta: level === "Advanced" ? "5 sets" : "4 sets" },
      { title: "Shoulder press", meta: level === "Advanced" ? "4 sets" : "3 sets" },
      { title: "Cool-down stretch", meta: "6 min" }
    ],
    cardio: [
      { title: "Dynamic warm-up", meta: "6 min" },
      { title: "Intervals and brisk walk", meta: `${Math.max(duration - 14, 15)} min` },
      { title: "Core finisher", meta: "8 min" },
      { title: "Breathing recovery", meta: "4 min" }
    ],
    yoga: [
      { title: "Breathing reset", meta: "5 min" },
      { title: "Mobility flow", meta: `${Math.max(duration - 15, 15)} min` },
      { title: "Balance poses", meta: "10 min" },
      { title: "Relaxation stretch", meta: "5 min" }
    ],
    hiit: [
      { title: "Quick warm-up", meta: "5 min" },
      { title: "HIIT rounds", meta: `${Math.max(duration - 15, 16)} min` },
      { title: "Bodyweight finisher", meta: "8 min" },
      { title: "Cool-down stretch", meta: "5 min" }
    ]
  };

  return plans[type.toLowerCase()] || plans.strength;
}

function nutritionPlan(goal, mealPreference, hydrationGoal) {
  const normalizedGoal = String(goal || "").toLowerCase();
  const calories =
    normalizedGoal.includes("lose") ? 1700 :
    normalizedGoal.includes("muscle") ? 2300 :
    normalizedGoal.includes("stamina") ? 2100 :
    1850;

  const protein =
    normalizedGoal.includes("muscle") ? "140g" :
    normalizedGoal.includes("lose") ? "125g" :
    "120g";

  const carbs = mealPreference === "High Protein" ? "180g" : normalizedGoal.includes("stamina") ? "240g" : "210g";
  const fats = mealPreference === "Vegetarian" ? "60g" : "55g";

  return {
    calories,
    note: `Next suggestion: choose a ${mealPreference.toLowerCase()} meal and finish ${hydrationGoal}L water today.`,
    macros: [
      { label: "Protein", value: protein },
      { label: "Carbs", value: carbs },
      { label: "Fats", value: fats }
    ]
  };
}

function buildSchedule(preferences, workoutTitle) {
  return [
    { time: preferences.wakeTime, title: "Wake up and light mobility" },
    { time: "13:30", title: `${preferences.hydrationGoal}L hydration reminder` },
    { time: preferences.workoutTime, title: workoutTitle },
    { time: preferences.sleepTime, title: "Sleep wind-down" }
  ];
}

function progressFromPreferences(preferences) {
  const base = Math.min(95, 55 + preferences.workoutDays * 6);
  return [
    { label: "Steps", value: Math.min(96, base + 3) },
    { label: "Workout", value: Math.min(94, base) },
    { label: "Nutrition", value: Math.min(92, base - 4) },
    { label: "Sleep", value: Math.min(97, base + 7) }
  ];
}

async function buildDashboard(req) {
  const userId = req.user._id;
  const firstName = req.user.fullName.split(" ")[0] || "Athlete";
  const userActivities = await Activity.findRecentByUser(userId, 6);
  const dashboardEvents = await DashboardData.findRecentByUser(userId, 10);
  const preferences = {
    wakeTime: req.user.preferences?.wakeTime || "07:00",
    workoutTime: req.user.preferences?.workoutTime || "18:00",
    sleepTime: req.user.preferences?.sleepTime || "22:30",
    preferredWorkout: req.user.preferences?.preferredWorkout || "Strength",
    experienceLevel: req.user.preferences?.experienceLevel || "Beginner",
    availableMinutes: req.user.preferences?.availableMinutes || 38,
    workoutDays: req.user.preferences?.workoutDays || 4,
    mealPreference: req.user.preferences?.mealPreference || "Balanced",
    hydrationGoal: req.user.preferences?.hydrationGoal || 3
  };
  const workoutTitle = `${toTitleCase(preferences.preferredWorkout)} ${req.user.goal.toLowerCase().includes("muscle") ? "power" : req.user.goal.toLowerCase().includes("lose") ? "fat-burn" : "smart"} session`;
  const nutrition = nutritionPlan(req.user.goal, preferences.mealPreference, preferences.hydrationGoal);
  const schedule = buildSchedule(preferences, workoutTitle);
  const progress = progressFromPreferences(preferences);
  const workout = workoutLibrary(
    preferences.preferredWorkout,
    preferences.experienceLevel,
    preferences.availableMinutes
  );
  const score = Math.round((progress.reduce((sum, item) => sum + item.value, 0) / progress.length));
  const achievements = buildAchievements(req.user, preferences);

  return {
    user: {
      id: String(req.user._id),
      name: firstName,
      fullName: req.user.fullName,
      role: req.user.role || "user",
      goal: req.user.goal,
      plan: req.user.plan,
      streak: req.user.streak,
      totalLoginDays: req.user.totalLoginDays,
      preferences
    },
    summary: {
      goalCompleted: score,
      boosterScore: score,
      boosterTrend: `Built from ${preferences.workoutDays} workout days/week`,
      streak: req.user.streak,
      steps: 9000 + preferences.workoutDays * 820,
      stepsNote: `${Math.max(1000, 16000 - (9000 + preferences.workoutDays * 820)).toLocaleString()} left for target`,
      calories: 420 + preferences.availableMinutes * 6,
      caloriesNote: `${preferences.availableMinutes} min active plan today`
    },
    progress,
    workoutTitle,
    workoutDuration: `${preferences.availableMinutes} min`,
    workout,
    nutrition,
    schedule,
    achievements,
    activity: userActivities.length
      ? userActivities.map((item) => ({ action: item.action, detail: item.detail }))
      : defaultActivity(),
    dashboardEvents: dashboardEvents.map((item) => ({
      eventType: item.eventType,
      label: item.label,
      payload: item.payload,
      createdAt: item.createdAt
    })),
    aiChat: getChatProviderStatus(),
    needsPreferences: !req.user.preferences?.workoutTime
  };
}

router.get("/", protect, async (req, res) => {
  res.json(await buildDashboard(req));
});

router.post("/workout/start", protect, async (req, res) => {
  const dashboard = await buildDashboard(req);
  await saveDashboardData(req.user._id, "workout_start", "Started workout", {
    workoutTitle: dashboard.workoutTitle,
    workoutDuration: dashboard.workoutDuration,
    clickedAt: new Date()
  });
  await Activity.create({
    user: req.user._id,
    action: "Started",
    detail: `${dashboard.workoutTitle}.`,
    category: "workout"
  });

  res.json({
    message: "Workout started. Timer and checklist are active.",
    dashboard: await buildDashboard(req)
  });
});

router.post("/meal", protect, async (req, res) => {
  const { mealName, calories, protein } = req.body;

  if (!mealName || !calories) {
    return res.status(400).json({ message: "Meal name and calories are required" });
  }

  await saveDashboardData(req.user._id, "meal_log", "Logged meal", {
    mealName,
    calories: Number(calories),
    protein: Number(protein || 0),
    clickedAt: new Date()
  });
  await Activity.create({
    user: req.user._id,
    action: "Logged",
    detail: `${mealName} with ${calories} kcal${protein ? ` and ${protein}g protein` : ""}.`,
    category: "nutrition"
  });

  res.json({
    message: "Meal logged successfully.",
    dashboard: await buildDashboard(req)
  });
});

router.post("/progress/check", protect, async (req, res) => {
  if (!isUserAccount(req.user)) {
    return res.status(403).json({ message: "Only user accounts can track progress." });
  }

  await saveDashboardData(req.user._id, "progress_check", "Checked weekly progress", {
    clickedAt: new Date()
  });
  await Activity.create({
    user: req.user._id,
    action: "Checked",
    detail: "weekly progress report.",
    category: "progress"
  });

  res.json({
    message: "Progress refreshed from your latest dashboard data.",
    dashboard: await buildDashboard(req)
  });
});

router.post("/schedule/view", protect, async (req, res) => {
  await saveDashboardData(req.user._id, "schedule_view", "Viewed schedule", {
    clickedAt: new Date()
  });
  await Activity.create({
    user: req.user._id,
    action: "Viewed",
    detail: "today's smart schedule.",
    category: "schedule"
  });

  res.json({
    message: "Schedule opened.",
    dashboard: await buildDashboard(req)
  });
});

router.post("/interaction", protect, async (req, res) => {
  const { eventType, label, payload } = req.body;

  if (!eventType || !label) {
    return res.status(400).json({ message: "Event type and label are required" });
  }

  if (eventType === "coach_feedback" && !isUserAccount(req.user)) {
    return res.status(403).json({ message: "Only user accounts can send coach feedback." });
  }

  const savedData = await saveDashboardData(req.user._id, eventType, label, payload || {});

  res.json({
    message: "Dashboard data saved to Neon Postgres.",
    saved: true,
    savedData: {
      eventType: savedData.eventType,
      label: savedData.label,
      payload: savedData.payload,
      createdAt: savedData.createdAt
    }
  });
});

router.post("/chat", protect, async (req, res) => {
  const message = String(req.body.message || "").trim();
  const history = req.body.history || [];

  console.log("Chat request received:", { message, hasMessage: !!message, messageLength: message.length });

  if (!isUserAccount(req.user)) {
    return res.status(403).json({ message: "Only user accounts can use the AI chatbot." });
  }

  if (!message) {
    console.log("Message validation failed - message is empty");
    return res.status(400).json({ message: "Message is required" });
  }

  try {
    const dashboard = await buildDashboard(req);
    if (!dashboard.aiChat?.enabled) {
      return res.status(503).json({ message: dashboard.aiChat?.message || "AI chatbot is not configured." });
    }

    const chatResult = await generateChatReply({
      user: dashboard.user,
      dashboard,
      history,
      message
    });

    await saveDashboardData(req.user._id, "chatbot_message", "Sent chatbot message", {
      question: message,
      reply: chatResult.reply,
      provider: chatResult.provider,
      model: chatResult.model,
      createdAt: new Date().toISOString()
    });

    res.json({
      reply: chatResult.reply,
      provider: chatResult.provider,
      model: chatResult.model
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "AI chatbot request failed" });
  }
});

router.put("/preferences", protect, async (req, res) => {
  const {
    goal,
    wakeTime,
    workoutTime,
    sleepTime,
    preferredWorkout,
    experienceLevel,
    availableMinutes,
    workoutDays,
    mealPreference,
    hydrationGoal
  } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const preferences = {
    wakeTime: wakeTime || user.preferences?.wakeTime || "07:00",
    workoutTime: workoutTime || user.preferences?.workoutTime || "18:00",
    sleepTime: sleepTime || user.preferences?.sleepTime || "22:30",
    preferredWorkout: preferredWorkout || user.preferences?.preferredWorkout || "Strength",
    experienceLevel: experienceLevel || user.preferences?.experienceLevel || "Beginner",
    availableMinutes: Number(availableMinutes) || user.preferences?.availableMinutes || 38,
    workoutDays: Number(workoutDays) || user.preferences?.workoutDays || 4,
    mealPreference: mealPreference || user.preferences?.mealPreference || "Balanced",
    hydrationGoal: Number(hydrationGoal) || user.preferences?.hydrationGoal || 3
  };

  const updatedUser = await User.updateById(user._id, {
    goal: goal || user.goal,
    preferences
  });

  await saveDashboardData(updatedUser._id, "preferences_update", "Updated dashboard preferences", {
    goal: updatedUser.goal,
    preferences: updatedUser.preferences,
    clickedAt: new Date()
  });
  await Activity.create({
    user: updatedUser._id,
    action: "Updated",
    detail: "personal fitness preferences and schedule.",
    category: "preferences"
  });

  req.user = updatedUser;
  res.json({
    message: "Your personalized dashboard has been updated.",
    dashboard: await buildDashboard(req)
  });
});

module.exports = router;
