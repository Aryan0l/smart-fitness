const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

function getTodayDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function getDayDifference(previousDateString, currentDateString) {
  if (!previousDateString) {
    return null;
  }

  const previousDate = new Date(`${previousDateString}T00:00:00`);
  const currentDate = new Date(`${currentDateString}T00:00:00`);
  return Math.round((currentDate - previousDate) / 86400000);
}

async function updateLoginStreak(user) {
  const today = getTodayDateString();
  const dayDifference = getDayDifference(user.lastLoginDate, today);

  if (dayDifference === null) {
    user.streak = Math.max(user.streak || 1, 1);
    user.totalLoginDays = Math.max(user.totalLoginDays || 1, 1);
    user.lastLoginDate = today;
    await User.updateById(user._id, user);
    return;
  }

  if (dayDifference === 0) {
    return;
  }

  if (dayDifference === 1) {
    user.streak += 1;
    user.totalLoginDays += 1;
  } else {
    user.streak = 1;
    user.totalLoginDays += 1;
  }

  user.lastLoginDate = today;
  await User.updateById(user._id, user);
}

function createToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || "smart_tracker_secret", {
    expiresIn: "7d"
  });
}

function userResponse(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role || "user",
    goal: user.goal,
    plan: user.plan,
    streak: user.streak
  };
}

router.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password, goal, role } = req.body;
    const normalizedRole = role === "coach" ? "coach" : "user";

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Full name, email and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Account already exists. Please login." });
    }

    const accountGoal = normalizedRole === "coach" ? "Stay active" : goal || "Stay active";
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: normalizedRole,
      goal: accountGoal,
      lastLoginDate: getTodayDateString(),
      streak: 1,
      totalLoginDays: 1
    });

    res.status(201).json({
      message: "Account created successfully",
      token: createToken(user._id),
      user: userResponse(user)
    });
  } catch (error) {
    res.status(500).json({ message: "Signup failed", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const normalizedRole = role === "coach" ? "coach" : "user";

    if (!username || !password) {
      return res.status(400).json({ message: "Email/username and password are required" });
    }

    const user = await User.findOne({ email: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid login details" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid login details" });
    }
    if ((user.role || "user") !== normalizedRole) {
      return res.status(403).json({ message: `This account is registered as a ${user.role || "user"}. Select the correct login role.` });
    }

    await updateLoginStreak(user);

    res.json({
      message: "Login successful",
      token: createToken(user._id),
      user: userResponse(user)
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

router.post("/social-login", async (req, res) => {
  try {
    const { provider, email, fullName, role } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const authProvider = String(provider || "Google").trim();
    const normalizedRole = role === "coach" ? "coach" : "user";

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const generatedPassword = await bcrypt.hash(`${authProvider}-${normalizedEmail}-${Date.now()}`, 10);
      user = await User.create({
        fullName: fullName || normalizedEmail.split("@")[0] || `${authProvider} User`,
        email: normalizedEmail,
        password: generatedPassword,
        role: normalizedRole,
        goal: "Stay active",
        lastLoginDate: getTodayDateString(),
        streak: 1,
        totalLoginDays: 1
      });
    } else {
      if ((user.role || "user") !== normalizedRole) {
        return res.status(403).json({ message: `This account is registered as a ${user.role || "user"}. Select the correct login role.` });
      }
      await updateLoginStreak(user);
    }

    res.json({
      message: `${authProvider} login successful`,
      token: createToken(user._id),
      user: userResponse(user)
    });
  } catch (error) {
    res.status(500).json({ message: "Social login failed", error: error.message });
  }
});

router.get("/me", protect, (req, res) => {
  res.json({ user: userResponse(req.user) });
});

module.exports = router;
