const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function hasRealSecret(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }

  const placeholders = [
    "your_real_groq_api_key",
    "your_real_gemini_api_key",
    "your_real_openai_api_key",
    "your_api_key",
    "your_key_here",
    "replace_me",
    "your_openai_api_key_here",
    "your_gemini_api_key_here",
    "your_groq_api_key_here"
  ];

  return !placeholders.includes(normalized.toLowerCase());
}

function pickProvider() {
  const configured = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  const hasGemini = hasRealSecret(process.env.GEMINI_API_KEY);
  const hasGroq = hasRealSecret(process.env.GROQ_API_KEY);
  const hasOpenAI = hasRealSecret(process.env.OPENAI_API_KEY);

  if (configured === "gemini" && hasGemini) {
    return configured;
  }

  if (configured === "groq" && hasGroq) {
    return configured;
  }

  if (configured === "openai" && hasOpenAI) {
    return configured;
  }

  if (hasGemini) {
    return "gemini";
  }

  if (hasGroq) {
    return "groq";
  }

  if (hasOpenAI) {
    return "openai";
  }

  return null;
}

function getChatProviderStatus() {
  const provider = pickProvider();

  if (!provider) {
    return {
      enabled: true, // Enable demo mode
      provider: "demo",
      model: "demo-assistant",
      message: "Demo chatbot is ready (responses are simulated)."
    };
  }

  return {
    enabled: true,
    provider,
    model:
      provider === "gemini"
        ? DEFAULT_GEMINI_MODEL
        : provider === "groq"
          ? DEFAULT_GROQ_MODEL
          : DEFAULT_OPENAI_MODEL,
    message:
      provider === "gemini"
        ? "Gemini chatbot is ready."
        : provider === "groq"
          ? "Groq chatbot is ready."
          : "OpenAI chatbot is ready."
  };
}

function buildSystemPrompt(user, dashboard) {
  const preferences = user.preferences || {};
  const macros = (dashboard.nutrition?.macros || [])
    .map((item) => `${item.label}: ${item.value}`)
    .join(", ");
  const schedule = (dashboard.schedule || [])
    .map((item) => `${item.time} ${item.title}`)
    .join(" | ");

  return [
    "You are SmartTracker AI, a practical fitness and nutrition chatbot inside a fitness dashboard.",
    "Give concise, helpful, user-specific answers about diet, workouts, recovery, hydration, schedule, sleep, vegetarian meal planning, muscle gain, fat loss, stamina, consistency, motivation, habits, basic supplement guidance, and simple exercise form tips.",
    "Use the provided dashboard profile as your main context.",
    "If the user asks a broad fitness question, answer it directly and adapt the advice to their dashboard goal and preferences.",
    "If the user asks about calories, protein, workouts, timing, or recovery, give specific actionable guidance instead of generic motivation.",
    "If the user asks something unrelated to fitness, wellness, nutrition, habits, or training, say you are mainly their fitness dashboard assistant and redirect them to a health, training, or routine topic.",
    "Do not claim to be a doctor. For injuries, medical conditions, or severe symptoms, advise the user to consult a qualified professional.",
    "Do not recommend steroids, illegal drugs, or dangerous weight-loss practices.",
    "Keep responses under 220 words unless the user explicitly asks for detail.",
    "Use clear short paragraphs or short bullets when useful.",
    `User goal: ${user.goal}.`,
    `Workout preference: ${preferences.preferredWorkout || "Strength"}.`,
    `Experience level: ${preferences.experienceLevel || "Beginner"}.`,
    `Available minutes: ${preferences.availableMinutes || 38}.`,
    `Workout days per week: ${preferences.workoutDays || 4}.`,
    `Meal preference: ${preferences.mealPreference || "Balanced"}.`,
    `Hydration goal: ${preferences.hydrationGoal || 3} liters.`,
    `Wake time: ${preferences.wakeTime || "07:00"}. Workout time: ${preferences.workoutTime || "18:00"}. Sleep time: ${preferences.sleepTime || "22:30"}.`,
    `Nutrition target: ${dashboard.nutrition?.calories || 1850} kcal. Macros: ${macros || "Protein 120g, Carbs 210g, Fats 55g"}.`,
    `Current schedule: ${schedule}.`
  ].join("\n");
}

function normalizeHistory(history) {
  return Array.isArray(history)
    ? history
        .filter((item) => item && typeof item.text === "string" && (item.role === "user" || item.role === "assistant"))
        .slice(-8)
    : [];
}

async function callGemini({ user, dashboard, history, message }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!hasRealSecret(apiKey)) {
    throw new Error("Gemini API key is missing");
  }

  const contents = normalizeHistory(history).map((item) => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: item.text }]
  }));

  contents.push({
    role: "user",
    parts: [{ text: message }]
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemPrompt(user, dashboard) }]
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 320
        }
      })
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini request failed");
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return {
    provider: "gemini",
    model: DEFAULT_GEMINI_MODEL,
    reply: text
  };
}

async function callDemo({ user, dashboard, history, message }) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  const responses = [
    "That's a great question about your fitness journey! Based on your goal to stay active, I recommend starting with 30 minutes of moderate cardio 3 times per week.",
    "For your nutrition, aim for balanced meals with plenty of vegetables, lean proteins, and whole grains. A good target is 2,000-2,500 calories per day depending on your activity level.",
    "Sleep is crucial for recovery! Try to get 7-9 hours per night. Consider winding down 30 minutes before bed with no screens.",
    "Hydration is key - aim for at least 8 glasses of water per day, more if you're active. Your body needs water for optimal performance.",
    "Consistency is more important than perfection. Even small daily improvements add up over time. Keep up the great work!",
    "For muscle recovery, consider light stretching or yoga on rest days. This helps prevent injury and improves flexibility.",
    "Your current streak is impressive! Building habits takes time, but you're on the right track. What aspect of fitness interests you most?",
    "Remember to listen to your body. If something doesn't feel right, it's okay to modify your routine. Safety first!",
    "Nutrition timing can help - try eating protein-rich meals within 30-60 minutes after workouts to support muscle repair.",
    "Progress tracking is motivating! Keep logging your workouts and meals - it helps you see how far you've come."
  ];

  const randomResponse = responses[Math.floor(Math.random() * responses.length)];

  return {
    provider: "demo",
    model: "demo-assistant",
    reply: randomResponse
  };
}

async function callGroq({ user, dashboard, history, message }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!hasRealSecret(apiKey)) {
    throw new Error("Groq API key is missing");
  }

  const messages = [
    {
      role: "system",
      content: buildSystemPrompt(user, dashboard)
    },
    ...normalizeHistory(history).map((item) => ({
      role: item.role,
      content: item.text
    })),
    {
      role: "user",
      content: message
    }
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEFAULT_GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 320,
      stream: false
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Groq request failed");
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Groq returned an empty response");
  }

  return {
    provider: "groq",
    model: DEFAULT_GROQ_MODEL,
    reply: text
  };
}

async function callOpenAI({ user, dashboard, history, message }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!hasRealSecret(apiKey)) {
    throw new Error("OpenAI API key is missing");
  }

  const messages = [
    {
      role: "system",
      content: buildSystemPrompt(user, dashboard)
    },
    ...normalizeHistory(history).map((item) => ({
      role: item.role,
      content: item.text
    })),
    {
      role: "user",
      content: message
    }
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEFAULT_OPENAI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 320
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI request failed");
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned an empty response");
  }

  return {
    provider: "openai",
    model: DEFAULT_OPENAI_MODEL,
    reply: text
  };
}

async function generateChatReply({ user, dashboard, history, message }) {
  const provider = pickProvider();

  try {
    if (provider === "gemini") {
      return callGemini({ user, dashboard, history, message });
    }

    if (provider === "openai") {
      return callOpenAI({ user, dashboard, history, message });
    }

    if (provider === "groq") {
      return callGroq({ user, dashboard, history, message });
    }

    // Demo mode - no real API key needed
    return callDemo({ user, dashboard, history, message });
  } catch (error) {
    console.error("Chat provider error:", error);
    // Fallback to demo if real API fails
    return callDemo({ user, dashboard, history, message });
  }
}

module.exports = {
  generateChatReply,
  getChatProviderStatus
};
