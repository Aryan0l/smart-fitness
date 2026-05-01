const crypto = require("crypto");
const { query } = require("../db/pool");

const defaultPreferences = {
  wakeTime: "07:00",
  workoutTime: "18:00",
  sleepTime: "22:30",
  preferredWorkout: "Strength",
  experienceLevel: "Beginner",
  availableMinutes: 38,
  workoutDays: 4,
  mealPreference: "Balanced",
  hydrationGoal: 3
};

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    password: row.password,
    role: row.role,
    goal: row.goal,
    plan: row.plan,
    streak: row.streak,
    totalLoginDays: row.total_login_days,
    lastLoginDate: row.last_login_date,
    preferences: { ...defaultPreferences, ...(row.preferences || {}) },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findById(id) {
  const result = await query("SELECT * FROM users WHERE id = $1", [id]);
  return mapUser(result.rows[0]);
}

async function findOne(filter) {
  if (filter.email) {
    const result = await query("SELECT * FROM users WHERE email = $1", [String(filter.email).toLowerCase()]);
    return mapUser(result.rows[0]);
  }

  return null;
}

async function create(data) {
  const id = crypto.randomUUID();
  const preferences = { ...defaultPreferences, ...(data.preferences || {}) };
  const result = await query(
    `INSERT INTO users (
      id, full_name, email, password, role, goal, plan, streak, total_login_days, last_login_date, preferences
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      id,
      data.fullName,
      String(data.email).toLowerCase(),
      data.password,
      data.role || "user",
      data.goal || "Stay active",
      data.plan || "Premium",
      data.streak || 1,
      data.totalLoginDays || 1,
      data.lastLoginDate || null,
      JSON.stringify(preferences)
    ]
  );

  return mapUser(result.rows[0]);
}

async function updateById(id, data) {
  const existing = await findById(id);
  if (!existing) {
    return null;
  }

  const preferences = data.preferences ? { ...defaultPreferences, ...data.preferences } : existing.preferences;
  const result = await query(
    `UPDATE users
      SET full_name = $2,
          email = $3,
          password = $4,
          role = $5,
          goal = $6,
          plan = $7,
          streak = $8,
          total_login_days = $9,
          last_login_date = $10,
      preferences = $11::jsonb,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [
      id,
      data.fullName ?? existing.fullName,
      String(data.email ?? existing.email).toLowerCase(),
      data.password ?? existing.password,
      data.role ?? existing.role,
      data.goal ?? existing.goal,
      data.plan ?? existing.plan,
      data.streak ?? existing.streak,
      data.totalLoginDays ?? existing.totalLoginDays,
      data.lastLoginDate ?? existing.lastLoginDate,
      JSON.stringify(preferences)
    ]
  );

  return mapUser(result.rows[0]);
}

module.exports = {
  create,
  defaultPreferences,
  findById,
  findOne,
  updateById
};
