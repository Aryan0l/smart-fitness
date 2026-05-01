const menuToggle = document.querySelector(".menu-toggle");
const navItems = document.querySelectorAll(".nav-links a, .nav-actions a");
const range = document.querySelector("#habitRange");
const scoreValue = document.querySelector("#scoreValue");
const minuteValue = document.querySelector("#minuteValue");
const navbar = document.querySelector(".navbar");
const API_BASE_URL = (() => {
    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (isLocalhost && window.location.port !== "3003") {
        return "http://localhost:3003";
    }
    return "";
})();

if (menuToggle) {
    menuToggle.addEventListener("click", () => {
        const isOpen = document.body.classList.toggle("nav-open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
}

navItems.forEach((item) => {
    item.addEventListener("click", () => {
        document.body.classList.remove("nav-open");
        if (menuToggle) {
            menuToggle.setAttribute("aria-expanded", "false");
        }
    });
});

function updateBoosterScore() {
    const minutes = Number(range.value);
    const score = Math.min(100, Math.round(48 + minutes * 0.53));

    scoreValue.textContent = score;
    minuteValue.textContent = `${minutes} min`;
}

if (range && scoreValue && minuteValue) {
    range.addEventListener("input", updateBoosterScore);
    updateBoosterScore();
}

function updateNavbarState() {
    if (!navbar) {
        return;
    }

    navbar.classList.toggle("scrolled", window.scrollY > 24);
}

window.addEventListener("scroll", updateNavbarState);
updateNavbarState();

const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.18 }
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

function setMessage(element, message, type) {
    if (!element) {
        return;
    }

    if (!message) {
        element.textContent = "";
        element.className = "form-message";
        return;
    }

    element.textContent = message;
    element.className = `form-message show ${type}`;
}

function saveSession(data) {
    localStorage.setItem("smartTrackerToken", data.token);
    localStorage.setItem("smartTrackerUser", JSON.stringify(data.user));
}

function queuePlannerLaunch(role) {
    if ((role || "user") === "coach") {
        sessionStorage.removeItem("smartTrackerOpenPlanner");
        return;
    }

    sessionStorage.setItem("smartTrackerOpenPlanner", "true");
}

function shouldAutoOpenPlanner() {
    return sessionStorage.getItem("smartTrackerOpenPlanner") === "true";
}

function clearPlannerLaunchFlag() {
    sessionStorage.removeItem("smartTrackerOpenPlanner");
}

function getSavedUser() {
    try {
        return JSON.parse(localStorage.getItem("smartTrackerUser") || "{}");
    } catch (error) {
        return {};
    }
}

function getSavedUserRole() {
    return getSavedUser().role || "user";
}

function getToken() {
    return localStorage.getItem("smartTrackerToken");
}

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
    }

    return data;
}

const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");

function updateAuthRoleUi(role) {
    const normalizedRole = role === "coach" ? "coach" : "user";
    const isCoach = normalizedRole === "coach";

    const loginRoleInput = document.querySelector("#loginRole");
    const signupRoleInput = document.querySelector("#signupRole");
    const socialRoleInput = document.querySelector("#socialRole");

    if (loginRoleInput) {
        loginRoleInput.value = normalizedRole;
    }
    if (signupRoleInput) {
        signupRoleInput.value = normalizedRole;
    }
    if (socialRoleInput) {
        socialRoleInput.value = normalizedRole;
    }

    updateText("#loginRoleEyebrow", isCoach ? "Coach login" : "User login");
    updateText("#loginRoleTitle", isCoach ? "Login to your coach space" : "Login to your tracker");
    updateText("#loginRoleCopy", isCoach ? "Use your coach account details to manage your athletes." : "Use your user account details to continue.");
    updateText("#signupRoleEyebrow", isCoach ? "New coach" : "New user");
    updateText("#signupRoleCopy", isCoach ? "Create a coach account to review users and collect their feedback." : "Create a free demo account to preview your dashboard.");

    document.querySelectorAll("[data-role-switch]").forEach((switchElement) => {
        switchElement.querySelectorAll("[data-role-option]").forEach((button) => {
            button.classList.toggle("active", button.dataset.roleOption === normalizedRole);
        });
    });
}

document.querySelectorAll("[data-role-option]").forEach((button) => {
    button.addEventListener("click", () => {
        const role = button.dataset.roleOption || "user";
        updateAuthRoleUi(role);
        
        // Hide/show goal field based on role
        const goalWrapper = document.querySelector("#goalFieldWrapper");
        const goalSelect = document.querySelector("#goal");
        if (goalWrapper && goalSelect) {
            if (role === "coach") {
                goalWrapper.style.display = "none";
                goalSelect.removeAttribute("required");
                goalSelect.value = "";
            } else {
                goalWrapper.style.display = "block";
                goalSelect.setAttribute("required", "required");
                if (!goalSelect.value) {
                    goalSelect.value = "Stay active";
                }
            }
        }
    });
});

updateAuthRoleUi("user");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = document.querySelector("#loginMessage");
        const formData = new FormData(loginForm);

        try {
            setMessage(message, "Logging in...", "success");
            const data = await apiRequest("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    username: formData.get("username"),
                    password: formData.get("password"),
                    role: formData.get("role")
                })
            });

            saveSession(data);
            queuePlannerLaunch(data.user?.role);
            window.location.href = "dashboard.html";
        } catch (error) {
            setMessage(message, error.message, "error");
        }
    });
}

if (signupForm) {
    const signupEmail = document.querySelector("#email");
    const signupPassword = document.querySelector("#newPassword");
    const signupConfirmPassword = document.querySelector("#confirmPassword");
    const signupSubmitButton = document.querySelector("#signupSubmitButton");
    const signupMessage = document.querySelector("#signupMessage");

    function isValidSignupEmail(value) {
        return /^[^\s@]+@gmail\.com$/.test(value);
    }

    function updateSignupButtonState() {
        if (!signupEmail || !signupPassword || !signupConfirmPassword || !signupSubmitButton) {
            return;
        }

        const emailValid = isValidSignupEmail(signupEmail.value.trim());
        const passwordValid = signupPassword.value.length >= 6;
        const passwordsMatch = signupPassword.value && signupPassword.value === signupConfirmPassword.value;
        signupSubmitButton.disabled = !(emailValid && passwordValid && passwordsMatch);

        if (!emailValid && signupEmail.value.length) {
            setMessage(signupMessage, "Please enter a valid Gmail address (@gmail.com).", "error");
        } else if (signupPassword.value && signupPassword.value.length < 6) {
            setMessage(signupMessage, "Password must be at least 6 characters.", "error");
        } else if (signupPassword.value && signupConfirmPassword.value && !passwordsMatch) {
            setMessage(signupMessage, "Passwords do not match.", "error");
        } else {
            setMessage(signupMessage, "", "");
        }
    }

    signupEmail?.addEventListener("input", updateSignupButtonState);
    signupPassword?.addEventListener("input", updateSignupButtonState);
    signupConfirmPassword?.addEventListener("input", updateSignupButtonState);

    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(signupForm);

        if (!isValidSignupEmail(signupEmail.value.trim())) {
            setMessage(signupMessage, "Please enter a valid Gmail address (@gmail.com).", "error");
            return;
        }

        if (signupPassword.value.length < 6) {
            setMessage(signupMessage, "Password must be at least 6 characters.", "error");
            return;
        }

        if (signupPassword.value !== signupConfirmPassword.value) {
            setMessage(signupMessage, "Passwords do not match.", "error");
            return;
        }

        try {
            setMessage(signupMessage, "Creating your account...", "success");
            const data = await apiRequest("/api/auth/signup", {
                method: "POST",
                body: JSON.stringify({
                    fullName: formData.get("fullName"),
                    goal: formData.get("role") === "coach" ? "" : formData.get("goal"),
                    email: formData.get("email"),
                    password: formData.get("newPassword"),
                    role: formData.get("role")
                })
            });

            saveSession(data);
            queuePlannerLaunch(data.user?.role);
            window.location.href = "dashboard.html";
        } catch (error) {
            setMessage(signupMessage, error.message, "error");
        }
    });
}



const paymentButtons = document.querySelectorAll(".payment-button");
const paymentForm = document.querySelector("#paymentForm");
const paymentMessage = document.querySelector("#paymentMessage");
const paymentPlanKey = document.querySelector("#paymentPlanKey");
const paymentPlanTitle = document.querySelector("#paymentPlanTitle");
const paymentPlanMeta = document.querySelector("#paymentPlanMeta");
const payNowButton = document.querySelector("#payNowButton");

function setButtonLoading(button, isLoading, loadingText = "Processing...") {
    if (!button) {
        return;
    }

    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.disabled = true;
        button.classList.add("is-loading");
        button.textContent = loadingText;
        return;
    }

    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = button.dataset.originalText || button.textContent;
}

function openPaymentModal(button) {
    const user = getSavedUser();
    const planName = button.dataset.planName;
    const planPrice = button.dataset.planPrice;

    paymentPlanKey.value = button.dataset.planKey;
    paymentPlanTitle.textContent = `Pay Rs. ${planPrice} for ${planName}`;
    paymentPlanMeta.textContent = `${planName} plan will be activated after payment confirmation.`;
    document.querySelector("#paymentName").value = user.fullName || "";
    document.querySelector("#paymentEmail").value = user.email || "";
    setMessage(paymentMessage, "", "");
    openModal("#paymentModal");
}

function closePaymentModal() {
    closeModal("#paymentModal");
}

function goAfterPayment() {
    window.location.href = getToken() ? "dashboard.html" : "signup.html";
}

async function verifyRazorpayPayment(response) {
    const data = await apiRequest("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify(response)
    });

    setMessage(paymentMessage, "Payment successful. Plan activated.", "success");
    window.setTimeout(() => {
        goAfterPayment();
    }, 900);
    return data;
}

function openRazorpayCheckout(orderData, customer) {
    if (!window.Razorpay) {
        throw new Error("Razorpay checkout could not load. Check your internet connection.");
    }

    const checkout = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "Smart Tracker Booster",
        description: `${orderData.plan.name} plan`,
        order_id: orderData.order.id,
        prefill: {
            name: customer.customerName,
            email: customer.customerEmail
        },
        theme: {
            color: "#8a2be2"
        },
        handler: verifyRazorpayPayment
    });

    checkout.open();
}

paymentButtons.forEach((button) => {
    button.addEventListener("click", () => openPaymentModal(button));
});

if (paymentForm) {
    paymentForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(paymentForm);
        const customer = {
            planKey: formData.get("planKey"),
            customerName: formData.get("customerName"),
            customerEmail: formData.get("customerEmail")
        };

        try {
            setButtonLoading(payNowButton, true, "Creating order...");
            setMessage(paymentMessage, "Creating secure payment order...", "success");

            const orderData = await apiRequest("/api/payments/create-order", {
                method: "POST",
                body: JSON.stringify(customer)
            });

            if (orderData.demoMode) {
                setMessage(paymentMessage, "Demo mode active. Saving payment as successful...", "success");
                await apiRequest("/api/payments/demo-success", {
                    method: "POST",
                    body: JSON.stringify({ orderId: orderData.order.id })
                });
                setMessage(paymentMessage, "Demo payment successful. Plan activated.", "success");
                window.setTimeout(() => {
                    goAfterPayment();
                }, 900);
                return;
            }

            setMessage(paymentMessage, "Opening Razorpay checkout...", "success");
            openRazorpayCheckout(orderData, customer);
        } catch (error) {
            setMessage(paymentMessage, error.message, "error");
        } finally {
            setButtonLoading(payNowButton, false);
        }
    });
}

document.querySelector("#closePaymentModal")?.addEventListener("click", closePaymentModal);
document.querySelector("#paymentModal")?.addEventListener("click", (event) => {
    if (event.target.id === "paymentModal") {
        closePaymentModal();
    }
});

function updateText(selector, value) {
    const element = document.querySelector(selector);
    if (element && value !== undefined && value !== null) {
        element.textContent = value;
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showToast(message) {
    const toast = document.querySelector("#dashboardToast");
    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function openModal(selector) {
    const modal = document.querySelector(selector);
    if (modal) {
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
    }
}

function closeModal(selector) {
    const modal = document.querySelector(selector);
    if (modal) {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
    }
}

function getDashboardState() {
    try {
        return JSON.parse(localStorage.getItem("smartDashboardState") || "{}");
    } catch (error) {
        return {};
    }
}

function saveDashboardState(nextState) {
    const current = getDashboardState();
    localStorage.setItem("smartDashboardState", JSON.stringify({ ...current, ...nextState }));
}

function scrollToPanel(selector) {
    const panel = document.querySelector(selector);
    if (!panel) {
        return;
    }

    panel.scrollIntoView({ behavior: "smooth", block: "center" });
    panel.classList.add("panel-highlight");
    window.setTimeout(() => panel.classList.remove("panel-highlight"), 1400);
}

function renderDashboard(data) {
    updateText("#dashboardUserName", data.user.name);
    updateText(
        "#dashboardIntro",
        `Your current goal is "${data.user.goal}" on the ${data.user.plan} plan. Track your score, workout, nutrition, schedule, recovery, and achievements here.`
    );
    updateText("#workoutTitle", data.workoutTitle);
    updateText("#workoutTimer", data.workoutDuration);
    updateText("#goalCompleted", `${data.summary.goalCompleted}%`);
    updateText("#boosterScore", `${data.summary.boosterScore}%`);
    updateText("#boosterTrend", data.summary.boosterTrend);
    updateText("#streakCount", data.summary.streak);
    updateText(
        "#streakNote",
        `${data.user.totalLoginDays || data.summary.streak} total login day${(data.user.totalLoginDays || data.summary.streak) > 1 ? "s" : ""}`
    );
    updateText("#stepsCount", data.summary.steps.toLocaleString("en-IN"));
    updateText("#stepsNote", data.summary.stepsNote);
    updateText("#caloriesCount", data.summary.calories);
    updateText("#caloriesNote", data.summary.caloriesNote);
    updateText("#nutritionCalories", `${data.nutrition.calories.toLocaleString("en-IN")} kcal`);
    updateText("#nutritionNote", data.nutrition.note);

    const progressBars = document.querySelector("#progressBars");
    if (progressBars) {
        progressBars.innerHTML = data.progress
            .map(
                (item) =>
                    `<div><span>${escapeHtml(item.label)}</span><strong>${item.value}%</strong><i style="--fill: ${item.value}%"></i></div>`
            )
            .join("");
    }

    const workoutList = document.querySelector("#workoutList");
    if (workoutList) {
        workoutList.innerHTML = data.workout
            .map((item) => `<div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.meta)}</span></div>`)
            .join("");
    }

    const macroGrid = document.querySelector("#macroGrid");
    if (macroGrid) {
        macroGrid.innerHTML = data.nutrition.macros
            .map((item) => `<div><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`)
            .join("");
    }

    const scheduleList = document.querySelector("#scheduleList");
    if (scheduleList) {
        scheduleList.innerHTML = data.schedule
            .map((item) => `<div><time>${escapeHtml(item.time)}</time><span>${escapeHtml(item.title)}</span></div>`)
            .join("");
    }

    const achievementList = document.querySelector("#achievementList");
    if (achievementList) {
        achievementList.innerHTML = data.achievements.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
    }

    const activityFeed = document.querySelector("#activityFeed");
    if (activityFeed) {
        activityFeed.innerHTML = data.activity
            .map((item) => `<p><strong>${escapeHtml(item.action)}</strong> ${escapeHtml(item.detail)}</p>`)
            .join("");
    }

    renderMongoEventTable(data.dashboardEvents || []);

    const plannerForm = document.querySelector("#plannerForm");
    if (plannerForm && data.user.preferences) {
        plannerForm.goal.value = data.user.goal || "Stay active";
        plannerForm.preferredWorkout.value = data.user.preferences.preferredWorkout || "Strength";
        plannerForm.experienceLevel.value = data.user.preferences.experienceLevel || "Beginner";
        plannerForm.mealPreference.value = data.user.preferences.mealPreference || "Balanced";
        plannerForm.wakeTime.value = data.user.preferences.wakeTime || "07:00";
        plannerForm.workoutTime.value = data.user.preferences.workoutTime || "18:00";
        plannerForm.sleepTime.value = data.user.preferences.sleepTime || "22:30";
        plannerForm.availableMinutes.value = data.user.preferences.availableMinutes || 38;
        plannerForm.workoutDays.value = data.user.preferences.workoutDays || 4;
        plannerForm.hydrationGoal.value = data.user.preferences.hydrationGoal || 3;
    }

    if ((data.needsPreferences || shouldAutoOpenPlanner()) && (data.user.role || "user") !== "coach") {
        openModal("#plannerModal");
        clearPlannerLaunchFlag();
    }

    applyDashboardRoleView(data);
    hydrateEnhancedDashboard(data);
}

function applyDashboardRoleView(data) {
    const role = data.user.role || getSavedUserRole();
    const isCoach = role === "coach";
    document.body.dataset.accountRole = role;

    updateText("#progressPageLink", isCoach ? "Progress page locked" : "Open progress page");

    if (!isCoach) {
        return;
    }

    updateText("#dashboardIntro", "You are logged in as a coach. Review training quality, monitor activity signals, and collect user feedback from the progress page.");
    updateText("#coachMessage", "Coach space active. User feedback submitted from the progress page will appear in the saved dashboard records.");
    updateText("#coachTagOne", "Coach account");
    updateText("#coachTagTwo", "Feedback ready");
    updateText("#coachTagThree", "Guide users");
    updateText("#missionTitle", "Review user consistency and next coaching actions");
    updateText("#missionDescription", "Use this space to monitor routine quality, note recovery risks, and respond after each user feedback cycle.");
    updateText("#missionReward", "Coach mode");
    updateText("#goalCompleted", "Coach");
}

function renderMongoEventTable(events) {
    const table = document.querySelector("#mongoEventTable");
    if (!table) {
        return;
    }

    const rows = events.length
        ? events
              .slice(0, 6)
              .map((event) => {
                  const payload = event.payload ? JSON.stringify(event.payload) : "Saved";
                  return `<div><span>${escapeHtml(event.label)}</span><span>${escapeHtml(payload)}</span></div>`;
              })
              .join("")
        : "<div><span>No saved events yet</span><span>Use dashboard buttons</span></div>";

    table.innerHTML = `<div><strong>Action</strong><strong>Data</strong></div>${rows}`;
}

async function postDashboardAction(path, body) {
    const token = getToken();
    if (!token) {
        window.location.href = "login.html";
        return null;
    }

    const data = await apiRequest(path, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body || {})
    });

    if (data.dashboard) {
        renderDashboard(data.dashboard);
    }

    showToast(data.message || "Action completed");
    return data;
}

async function saveDashboardInteraction(eventType, label, payload = {}) {
    const token = getToken();
    if (!token) {
        return null;
    }

    try {
        const data = await apiRequest("/api/dashboard/interaction", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ eventType, label, payload })
        });

        if (data.savedData) {
            prependMongoEvent(data.savedData);
        }

        return data;
    } catch (error) {
        showToast(error.message);
        return null;
    }
}

function prependMongoEvent(event) {
    const table = document.querySelector("#mongoEventTable");
    if (!table) {
        return;
    }

    const payload = event.payload ? JSON.stringify(event.payload) : "Saved";
    const row = `<div><span>${escapeHtml(event.label)}</span><span>${escapeHtml(payload)}</span></div>`;
    const header = "<div><strong>Action</strong><strong>Data</strong></div>";
    const existingRows = [...table.querySelectorAll("div")]
        .slice(1)
        .filter((rowElement) => !rowElement.textContent.includes("No saved events yet"))
        .slice(0, 5)
        .map((rowElement) => rowElement.outerHTML)
        .join("");

    table.innerHTML = `${header}${row}${existingRows}`;
}

function setWorkoutRunning() {
    const timer = document.querySelector("#workoutTimer");
    const workoutItems = document.querySelectorAll("#workoutList div");

    updateText("#workoutTimer", "Running");
    if (timer) {
        timer.classList.add("running");
    }

    workoutItems.forEach((item, index) => {
        item.classList.toggle("active-task", index === 0);
    });

    updateCoachMessage("Workout mode is active. Keep your first block clean and controlled.");
}

async function completeWorkout() {
    document.querySelectorAll("#workoutList div").forEach((item) => {
        item.classList.add("completed");
        item.classList.remove("active-task");
    });
    updateText("#workoutTimer", "Done");
    updateCoachMessage("Workout completed. Great work. Prioritize protein and a calm cooldown now.");
    showToast("Workout marked complete. Great job!");
    await saveDashboardInteraction("workout_complete", "Marked workout complete", {
        completedAt: new Date().toISOString()
    });
}

function updateCoachMessage(message) {
    updateText("#coachMessage", message);
}

function updateReadinessState() {
    const energy = Number(document.querySelector("#energyRange")?.value || 7);
    const focus = Number(document.querySelector("#focusRange")?.value || 8);
    const recovery = Number(document.querySelector("#recoveryRange")?.value || 6);
    const readiness = Math.round(((energy + focus + recovery) / 30) * 100);

    updateText("#readinessScore", `${readiness}% ready`);

    let note = "You are in a strong zone for a focused workout today.";
    let coach = "You are ready to push a little harder in the main block today.";

    if (readiness < 55) {
        note = "Recovery is a little low. Keep intensity moderate and protect your form.";
        coach = "Today should feel smooth, not heavy. Use control, mobility, and shorter bursts.";
    } else if (readiness < 75) {
        note = "You are stable today. Aim for consistency and avoid wasted energy.";
        coach = "A balanced session will suit you best. Keep pace clean and recover between sets.";
    }

    updateText("#readinessNote", note);
    updateCoachMessage(coach);
    updateBodyBattery(readiness, recovery);

    const tagOne = readiness >= 75 ? "Peak session" : readiness >= 55 ? "Balanced day" : "Recovery mode";
    updateText("#coachTagOne", tagOne);
    updateText("#coachTagTwo", energy >= 8 ? "High energy" : "Energy watch");
    updateText("#coachTagThree", recovery >= 7 ? "Recovery good" : "Stretch longer");

    saveDashboardState({ energy, focus, recovery });
    saveReadinessInteraction(energy, focus, recovery, readiness);
}

function updateBodyBattery(readiness = 76, recovery = 6) {
    const battery = Math.max(28, Math.min(100, Math.round(readiness * 0.75 + recovery * 3.5)));
    const status = battery >= 80 ? "High energy" : battery >= 55 ? "Balanced" : "Recover";
    const note =
        battery >= 80
            ? "You have enough energy for a stronger training block today."
            : battery >= 55
              ? "Your body is ready for a controlled workout."
              : "Keep today's session lighter and prioritize recovery.";
    const fill = document.querySelector("#batteryFill");

    updateText("#batteryValue", `${battery}%`);
    updateText("#batteryStatus", status);
    updateText("#batteryNote", note);

    if (fill) {
        fill.style.height = `${battery}%`;
    }
}

let readinessSaveTimeout = null;

function saveReadinessInteraction(energy, focus, recovery, readiness) {
    window.clearTimeout(readinessSaveTimeout);
    readinessSaveTimeout = window.setTimeout(() => {
        saveDashboardInteraction("readiness_update", "Updated readiness sliders", {
            energy,
            focus,
            recovery,
            readiness,
            updatedAt: new Date().toISOString()
        });
    }, 500);
}

function setupHydrationTracker() {
    const state = getDashboardState();
    const filled = Number(state.waterCount || 0);
    const drops = document.querySelectorAll(".water-drop");
    let count = filled;

    function paint() {
        drops.forEach((drop, index) => {
            drop.classList.toggle("filled", index < count);
        });
        updateText("#hydrationStatus", `${count} / 8 glasses`);
        updateText(
            "#hydrationNote",
            count >= 8 ? "Hydration goal complete. Excellent discipline today." : `You need ${8 - count} more glasses to close the day strong.`
        );
        saveDashboardState({ waterCount: count });
    }

    drops.forEach((drop, index) => {
        drop.addEventListener("click", () => {
            count = index + 1 === count ? index : index + 1;
            paint();
            if (count > 0) {
                updateCoachMessage(`Hydration updated: ${count} of 8 glasses complete. Keep the momentum going.`);
            }
            saveDashboardInteraction("hydration_update", "Updated water tracker", {
                glasses: count,
                updatedAt: new Date().toISOString()
            });
        });
    });

    paint();
}

const missions = [
    {
        title: "Finish 3 focused sets without long breaks",
        description: "Complete this mini challenge to sharpen consistency and unlock a momentum badge today.",
        reward: "+15 XP"
    },
    {
        title: "Hit your hydration goal before workout time",
        description: "Use your water tracker early so your energy stays stable through the session.",
        reward: "+10 XP"
    },
    {
        title: "Walk 2,000 extra steps after dinner",
        description: "A short walk tonight will improve recovery and help close your daily step gap.",
        reward: "+18 XP"
    },
    {
        title: "Log every meal today with protein included",
        description: "Nutrition clarity gives your dashboard much smarter recommendations.",
        reward: "+20 XP"
    }
];

function renderMission(index) {
    const mission = missions[index % missions.length];
    updateText("#missionTitle", mission.title);
    updateText("#missionDescription", mission.description);
    updateText("#missionReward", mission.reward);
    saveDashboardState({ missionIndex: index });
}

function setupMissionModule() {
    const state = getDashboardState();
    let missionIndex = Number(state.missionIndex || 0);
    renderMission(missionIndex);

    document.querySelector("#newMissionButton")?.addEventListener("click", () => {
        missionIndex = (missionIndex + 1) % missions.length;
        renderMission(missionIndex);
        showToast("New mission loaded for today.");
        saveDashboardInteraction("mission_new", "Loaded new mission", {
            mission: missions[missionIndex],
            updatedAt: new Date().toISOString()
        });
    });

    document.querySelector("#completeMissionButton")?.addEventListener("click", async () => {
        const badgeGrid = document.querySelector("#achievementList");
        const mission = missions[missionIndex];
        if (badgeGrid && !badgeGrid.innerHTML.includes("Mission master")) {
            badgeGrid.insertAdjacentHTML("afterbegin", "<span>Mission master</span>");
        }
        const activityFeed = document.querySelector("#activityFeed");
        if (activityFeed) {
            activityFeed.insertAdjacentHTML("afterbegin", `<p><strong>Unlocked</strong> ${escapeHtml(mission.title)}.</p>`);
        }
        updateCoachMessage("Mission reward claimed. That kind of consistency compounds fast.");
        showToast("Reward claimed and badge unlocked.");
        await saveDashboardInteraction("mission_complete", "Claimed mission reward", {
            mission,
            completedAt: new Date().toISOString()
        });
    });
}

let dashboardChatContext = null;
const chatbotQuickOptionResponses = {
    workout: "Here is a simple workout plan: 5 minutes warm-up, 3 rounds of squats, push-ups, lunges, and planks, then 5 minutes cool-down. If you want, I can also suggest a beginner, strength, or cardio version.",
    breakfast: "Good breakfast options are oatmeal with fruit, eggs with whole-grain toast, Greek yogurt with berries, or a banana-peanut butter smoothie. Aim for protein plus fiber to stay full longer.",
    sleep: "For better sleep, keep a fixed bedtime, avoid screens for 30 minutes before bed, limit late caffeine, and keep your room cool and dark. Try to get 7 to 9 hours each night.",
    motivation: "Focus on small wins. Set one clear goal for today, finish it, and build momentum from there. Consistency beats intensity when you are building long-term fitness habits.",
    progress: "Track progress by logging workouts, body weight, energy levels, sleep, and meal consistency. Compare weekly trends instead of judging a single day.",
    hydration: "A practical hydration target is 2 to 3 liters of water daily, and more on training days. Sip steadily through the day instead of waiting until you feel very thirsty.",
    mealprep: "For meal prep, batch-cook one protein, one carb source, and chopped vegetables. Example: grilled paneer or chicken, rice, and mixed veggies for easy balanced meals.",
    recovery: "Recovery matters as much as training. Prioritize protein, hydration, light stretching, and 7 to 9 hours of sleep. On hard days, a short walk can help reduce stiffness."
};

// Chatbot Rules - Rule-based fitness chatbot
const chatbotRulesJS = {
    // Greetings and Introductions
    "hi|hello|hey|greetings": { response: "Hello there! Welcome to your fitness companion. How can I help you achieve your health goals today? You can ask me about workouts, meals, or sleep.", intent: 'greeting' },
    "how are you|how's it going": { response: "I'm a bot designed to help you with your fitness journey! How are you feeling today? Feel free to ask about workouts, nutrition, or sleep.", intent: 'greeting' },
    "what is your name|who are you": { response: "I'm your friendly Fitness Bot, here to answer your questions about health, workouts, and nutrition. What would you like to know?", intent: 'greeting' },

    // Workout-related Questions
    "workout plan|exercise routine|gym plan|workout|exercise|gym": { response: "I can help with workout plans! Are you looking for something for beginners, strength training, cardio, or flexibility? You can specify your preference.", intent: 'workout_plan' },
    "beginner|start exercising": { response: "For beginners, I recommend starting with bodyweight exercises like squats, push-ups (on knees if needed), and planks. Consistency is key! You can also ask about strength training or cardio.", intent: 'beginner_workout' },
    "strength|strength training|build muscle": { response: "Strength training is great! Focus on compound movements like squats, deadlifts, bench press, and overhead press. Ensure proper form! You can also ask about workout frequency or warm-up routines.", intent: 'strength_workout' },
    "cardio|endurance": { response: "Cardio helps heart health! Consider running, cycling, swimming, or brisk walking. Aim for at least 30 minutes most days. You can also ask about warm-up or cool-down exercises.", intent: 'cardio_workout' },
    "warm up|cool down|warmup|cooldown": { response: "Always warm up for 5-10 minutes before and cool down for 5-10 minutes after your workout to prevent injuries. You can also ask about different workout types.", intent: 'workout_prep' },
    "how many times a week|workout frequency|frequency|training frequency": { response: "For general fitness, aim for 3-5 workout sessions per week, allowing for rest days. You can also ask about specific exercises.", intent: 'workout_frequency' },
    "rest days|recovery days|rest day|recovery": { response: "Rest days are important for recovery and strength gains. Use them for light movement, stretching, or gentle walking.", intent: 'rest_day' },
    "fitness routine|training routine|schedule|workout schedule": { response: "A consistent routine helps build habits. Plan strength, cardio, mobility, and rest so your training is balanced and sustainable.", intent: 'routine' },
    "home workout|no equipment|bodyweight exercises|exercise at home": { response: "Home workouts can be effective with bodyweight moves like squats, lunges, push-ups, planks, and bird dogs. Focus on good form.", intent: 'home_workout' },
    "gym workout|gym exercises|weights|resistance training": { response: "Gym workouts are great for strength training. Use compound movements like squats, deadlifts, bench press, and rows for efficient progress.", intent: 'gym_workout' },
    "cardio workout|running|cycling|swimming|treadmill": { response: "Cardio supports heart health and endurance. Choose an activity you enjoy and aim for at least 20-30 minutes most days.", intent: 'cardio_workout' },
    "hiit|high intensity interval training|interval training|sprints": { response: "HIIT alternates intense effort with rest to boost conditioning. Keep sessions short and focus on quality over quantity.", intent: 'hiit' },
    "strength training|build muscle|gain muscle|muscle growth": { response: "Strength training builds muscle, strength, and metabolism. Use progressive overload and compound lifts, then add accessory work.", intent: 'strength_training' },
    "tone my body|toning|lean muscle|shape up": { response: "Toning is about building muscle and reducing body fat. Combine strength training with healthy nutrition and consistent workouts.", intent: 'toning' },
    "lose weight|weight loss|fat loss|burn fat": { response: "For weight loss, maintain a moderate calorie deficit, prioritize protein, and keep training consistent. Slow progress is more sustainable.", intent: 'weight_loss' },
    "gain weight|bulk up|weight gain|build muscle mass": { response: "To gain weight, eat slightly more calories than you burn and focus on strength training. Choose nutrient-dense foods instead of empty calories.", intent: 'weight_gain' },
    "protein|protein intake|protein foods|protein sources": { response: "Protein supports muscle repair and recovery. Eat lean meats, eggs, dairy, beans, lentils, or protein powder to meet your needs.", intent: 'protein_intake' },
    "carbs|carbohydrates|complex carbs|carb sources": { response: "Complex carbs like oats, brown rice, sweet potatoes, and whole grains provide lasting energy. Pair them with protein and veggies.", intent: 'carbs' },
    "healthy fats|fat sources|omega 3|nuts|avocado": { response: "Healthy fats such as nuts, seeds, avocados, and olive oil support energy and nutrient absorption. Include them in moderation.", intent: 'healthy_fats' },
    "balanced diet|macros|macronutrients|nutrition balance": { response: "A balanced diet includes protein, carbs, and healthy fats. Focus on whole foods and consistent meals for better results.", intent: 'balanced_diet' },
    "meal plan|meal ideas|food ideas|healthy meals": { response: "Try meals like grilled chicken with quinoa and greens, salmon with sweet potato, or a veggie-filled omelet with whole grain toast.", intent: 'meal_plan' },
    "meal prep|prepare meals|batch cooking|meal planning": { response: "Meal prepping saves time and helps you eat well. Cook proteins, carbs, and vegetables in advance for easy healthy meals.", intent: 'meal_prep' },
    "breakfast ideas|healthy breakfast|morning meal|breakfast": { response: "Good breakfasts include oatmeal with fruit, eggs and veggies, yogurt with nuts, or a protein smoothie with spinach.", intent: 'breakfast_ideas' },
    "lunch ideas|healthy lunch|midday meal|lunch": { response: "Lunch ideas include salads with lean protein, whole grain wraps, stir-fries, or grain bowls with veggies and beans.", intent: 'lunch_ideas' },
    "dinner ideas|healthy dinner|evening meal|dinner": { response: "Try grilled fish or chicken with roasted vegetables and brown rice, veggie stir-fry, or a hearty salad with beans and avocado.", intent: 'dinner_ideas' },
    "snack ideas|healthy snacks|between meals|snacks": { response: "Healthy snacks include fruit and nut butter, Greek yogurt, hummus with veggies, or a small handful of nuts and seeds.", intent: 'snack_ideas' },
    "pre workout snack|before workout|pre workout meal": { response: "Eat a small mix of carbs and protein before training, like a banana with peanut butter or yogurt with berries.", intent: 'pre_workout' },
    "post workout snack|after workout|post workout meal": { response: "After exercise, recover with protein and carbs such as a protein shake, chicken with rice, or cottage cheese with fruit.", intent: 'post_workout' },
    "hydration|drink water|water intake|stay hydrated": { response: "Drink water throughout the day and especially before, during, and after workouts. Aim for at least 2-3 liters daily.", intent: 'hydration' },
    "electrolytes|sports drink|sodium|potassium|magnesium": { response: "Electrolytes help with hydration and muscle function. You can get them from food or sports drinks if you sweat heavily.", intent: 'electrolytes' },
    "vegetarian protein|vegan protein|plant based protein|meatless protein": { response: "Plant proteins like beans, lentils, tofu, tempeh, and quinoa can support muscle growth when combined wisely.", intent: 'plant_protein' },
    "supplements|protein powder|creatine|vitamins|fish oil": { response: "Supplements can support nutrition, but whole foods come first. Useful options include protein powder, creatine, and a multivitamin if needed.", intent: 'supplements' },
    "calorie deficit|eat less|reduce calories|lose fat": { response: "A calorie deficit is needed for fat loss. Eat slightly fewer calories than you expend and focus on nutrient-dense foods.", intent: 'calorie_deficit' },
    "calorie surplus|eat more|gain muscle|bulk": { response: "A calorie surplus helps build muscle if paired with strength training. Add healthy calorie sources like oats, nuts, and lean proteins.", intent: 'calorie_surplus' },
    "BMI|body mass index|body fat|fat percentage": { response: "Metrics like BMI and body fat are useful, but focus more on how you feel, your strength, and your consistency.", intent: 'body_metrics' },
    "weight tracking|scale|measurements|progress tracking": { response: "Track your weight and measurements over time, but don’t obsess over daily changes. Look for steady improvement over weeks.", intent: 'tracking' },

    // Sleep and Recovery
    "improve sleep|sleep better|sleep tips|sleep": { response: "Quality sleep is essential for recovery. Keep a consistent bedtime, limit screens before bed, and aim for 7-9 hours.", intent: 'sleep_tips' },
    "how much sleep|hours of sleep|sleep duration": { response: "Most adults do best with 7-9 hours of sleep. Good rest supports recovery, energy, and fitness progress.", intent: 'sleep_duration' },
    "insomnia|can't sleep|sleep problems|sleep issue": { response: "Try a calm bedtime routine, limit caffeine, and keep your bedroom cool and dark. If sleep issues persist, speak with a healthcare provider.", intent: 'insomnia_help' },
    "muscle soreness|doms|sore muscles|soreness": { response: "Soreness is normal after hard workouts. Rest, hydrate, and move lightly until it eases.", intent: 'muscle_soreness' },
    "recovery|rest|recovery day|recovery tips": { response: "Recovery is part of training. Use rest days, proper nutrition, and good sleep to support muscle repair.", intent: 'recovery' },
    "foam rolling|self massage|mobility|flexibility": { response: "Foam rolling and mobility work can help release tight muscles and improve movement.", intent: 'foam_rolling' },
    "injury prevention|avoid injury|safe training|form": { response: "Use proper technique, warm up, and progress gradually to reduce injury risk.", intent: 'injury_prevention' },
    "knee pain|back pain|shoulder pain|joint pain": { response: "If you feel pain, reduce load and adjust your form. If it continues, see a professional.", intent: 'pain' },

    // Motivation and Mindset
    "motivation|stay motivated|keep going|don't quit": { response: "Motivation comes from small wins and consistency. Set achievable goals and celebrate progress.", intent: 'motivation' },
    "habit|routine|consistency|daily habit": { response: "Fitness is built through consistent habits. Try a routine you can maintain long-term.", intent: 'habit' },
    "goal setting|set goals|fitness goals|goal planning": { response: "Set clear, achievable goals and track them. Breaking goals into weekly habits makes progress easier.", intent: 'goal_setting' },
    "stress relief|mental health|mindset|wellbeing": { response: "Exercise can reduce stress and improve mood. Pair movement with good sleep and healthy eating.", intent: 'mental_health' },
    "confidence|self esteem|feel better|positive mindset": { response: "Fitness can boost confidence when you focus on what your body can do and how far you've come.", intent: 'confidence' },

    // App Features and Support
    "what can this app do|app features|features|dashboard": { response: "This app helps you track workouts, meals, sleep, and progress while giving fitness guidance.", intent: 'app_features' },
    "how do i use the app|app help|app guide|use app": { response: "Use the dashboard to log your workouts and meals, check progress, and ask me fitness questions anytime.", intent: 'app_help' },
    "coach role|coach account|coach dashboard": { response: "Coach accounts let you manage athletes, review progress, and provide guidance from your dashboard.", intent: 'coach_role' },
    "user role|user account|tracker account|login": { response: "User accounts let you track your fitness journey, plan meals, and stay motivated with the dashboard.", intent: 'user_role' },

    // Polite Closings and Exit Phrases
    "thank you|thanks|thanks a lot|thank u": { response: "You're most welcome! Keep up the great work and ask anytime for more fitness tips.", intent: 'thank_you' },
    "bye|goodbye|exit|quit|see you": { response: "Goodbye! Stay active, eat well, and keep moving toward your goals.", intent: 'exit' },

    // Default Response (when no specific rule matches)
    "default": { response: "I didn’t catch that, but I can help with workouts, nutrition, recovery, motivation, and healthy habits. Try asking me about a workout plan, meal ideas, or sleep tips.", intent: 'unknown' }
};

let lastMatchedIntentJS = null;

function cleanInputJS(userInput) {
    userInput = userInput.toLowerCase();
    userInput = userInput.replace(/[^\w\s]/g, '');
    return userInput;
}

function getChatbotResponseJS(userInput) {
    const cleanedInput = cleanInputJS(userInput);
    let responseData = chatbotRulesJS.default;

    // Context-specific responses
    if (lastMatchedIntentJS === 'workout_plan') {
        if (/(^|\W)beginner(\W|$)/.test(cleanedInput)) {
            lastMatchedIntentJS = 'beginner_workout';
            return "Great! For beginners, focus on bodyweight exercises like squats, push-ups, and planks. Start slow and build consistency. You can also ask about strength training or cardio workouts.";
        } else if (/(^|\W)strength(\W|$)/.test(cleanedInput)) {
            lastMatchedIntentJS = 'strength_workout';
            return "Excellent! For strength training, compound movements like squats, deadlifts, and bench presses are key. Remember proper form! You can also ask about workout frequency or warm-up routines.";
        } else if (/(^|\W)cardio(\W|$)/.test(cleanedInput)) {
            lastMatchedIntentJS = 'cardio_workout';
            return "Good choice! Cardio can include running, cycling, or swimming. Aim for a consistent duration. You can also ask about warm-up or cool-down exercises.";
        }
    }

    // General rule matching
    for (const pattern in chatbotRulesJS) {
        if (pattern === "default") continue;

        const regex = new RegExp(`^.*\b(${pattern})\b.*$`);
        if (regex.test(cleanedInput)) {
            responseData = chatbotRulesJS[pattern];
            break;
        }
    }

    lastMatchedIntentJS = responseData.intent;
    return responseData.response;
}

function getChatbotOptionResponse(optionKey, fallbackPrompt) {
    const normalizedKey = String(optionKey || "").trim().toLowerCase();
    if (chatbotQuickOptionResponses[normalizedKey]) {
        return chatbotQuickOptionResponses[normalizedKey];
    }

    return getChatbotResponseJS(fallbackPrompt || normalizedKey);
}

function appendChatbotMessage(sender, message) {
    const thread = document.querySelector("#chatbot-thread");
    if (!thread) return;

    const wrapper = document.createElement('div');
    const isUser = sender === 'You';
    wrapper.className = `chatbot-message ${isUser ? 'user' : 'assistant'}`;

    const author = document.createElement('span');
    author.className = 'chatbot-author';
    author.textContent = isUser ? 'You' : 'Chatbot';

    const text = document.createElement('p');
    text.textContent = message;

    wrapper.appendChild(author);
    wrapper.appendChild(text);
    thread.appendChild(wrapper);

    // Smooth scroll to bottom
    thread.scrollTo({
        top: thread.scrollHeight,
        behavior: 'smooth'
    });
}

function handleChatbotInput(userInput) {
    if (userInput.trim() === "") return;

    appendChatbotMessage("You", userInput);
    document.querySelector("#chatbotInput").value = "";

    const typingIndicator = document.querySelector("#typing-indicator");
    if (typingIndicator) {
        typingIndicator.classList.remove('hidden');
    }

    setTimeout(() => {
        if (typingIndicator) {
            typingIndicator.classList.add('hidden');
        }
        const botResponse = getChatbotResponseJS(userInput);
        appendChatbotMessage("Chatbot", botResponse);
    }, 1500);
}

function handleChatbotOption(optionKey, promptLabel) {
    const prompt = String(promptLabel || "").trim();
    const label = prompt || String(optionKey || "").trim();
    if (!label) return;

    appendChatbotMessage("You", label);

    const typingIndicator = document.querySelector("#typing-indicator");
    if (typingIndicator) {
        typingIndicator.classList.remove("hidden");
    }

    setTimeout(() => {
        if (typingIndicator) {
            typingIndicator.classList.add("hidden");
        }
        appendChatbotMessage("Chatbot", getChatbotOptionResponse(optionKey, prompt));
    }, 900);
}

function setupDashboardChatbot(data) {
    const panel = document.querySelector("#assistantChatPanel");
    const input = document.querySelector("#chatbotInput");
    const submitButton = document.querySelector("#chatbotSubmitButton");
    const quickButtons = document.querySelectorAll("[data-chat-option], [data-chat-prompt]");
    const status = document.querySelector("#chatbotStatus");
    const intro = document.querySelector("#chatbotIntro");

    if (!panel || !input || !submitButton) {
        return;
    }

    dashboardChatContext = data;

    // Initialize chatbot with welcome message
    const thread = document.querySelector("#chatbot-thread");
    if (thread && !thread.hasChildNodes()) {
        thread.innerHTML = '<div class="chatbot-message assistant"><span class="chatbot-author">Chatbot</span><p>Hello! I\'m your Fitness Bot. Ask me about workouts, meals, or sleep!</p></div>';
    }

    // Update status
    if (status) {
        status.textContent = "Rule-based live";
    }
    if (intro) {
        intro.textContent = "Ask about workouts, meals, sleep, or motivation and get instant responses.";
    }

    // Set up event listeners
    if (!input.dataset.bound) {
        input.dataset.bound = "true";

        // Allow Enter key to submit
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleChatbotInput(input.value);
            }
        });

        // Send button click
        submitButton.addEventListener("click", () => {
            handleChatbotInput(input.value);
        });
    }

    // Set up quick action buttons
    quickButtons.forEach((button) => {
        if (button.dataset.bound) {
            return;
        }

        button.dataset.bound = "true";
        button.addEventListener("click", () => {
            const optionKey = button.dataset.chatOption || "";
            const prompt = button.dataset.chatPrompt || "";
            const label = button.textContent?.trim() || prompt;

            if (optionKey) {
                handleChatbotOption(optionKey, label);
                return;
            }

            if (!prompt) {
                return;
            }

            input.value = prompt;
            handleChatbotInput(prompt);
        });
    });
}

let focusInterval = null;
let focusSeconds = 300;

function paintFocusTimer() {
    const minutes = Math.floor(focusSeconds / 60);
    const seconds = focusSeconds % 60;
    updateText("#focusTimer", `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
}

function setupFocusTimer() {
    const startButton = document.querySelector("#startFocusButton");
    const resetButton = document.querySelector("#resetFocusButton");
    const panel = document.querySelector(".focus-panel");

    if (!startButton || !resetButton || startButton.dataset.bound) {
        return;
    }

    startButton.dataset.bound = "true";
    paintFocusTimer();

    startButton.addEventListener("click", () => {
        if (focusInterval) {
            window.clearInterval(focusInterval);
            focusInterval = null;
            startButton.textContent = "Resume";
            updateText("#focusStatus", "Paused");
            panel?.classList.remove("running");
            saveDashboardInteraction("focus_pause", "Paused focus timer", {
                remainingSeconds: focusSeconds,
                pausedAt: new Date().toISOString()
            });
            return;
        }

        startButton.textContent = "Pause";
        updateText("#focusStatus", "Running");
        panel?.classList.add("running");
        updateCoachMessage("Focus mode started. Keep your phone aside and finish this block cleanly.");
        saveDashboardInteraction("focus_start", "Started focus timer", {
            seconds: focusSeconds,
            startedAt: new Date().toISOString()
        });

        focusInterval = window.setInterval(() => {
            focusSeconds -= 1;
            paintFocusTimer();

            if (focusSeconds <= 0) {
                window.clearInterval(focusInterval);
                focusInterval = null;
                focusSeconds = 300;
                startButton.textContent = "Start Focus";
                updateText("#focusStatus", "Completed");
                panel?.classList.remove("running");
                showToast("Focus block completed. Nice work.");
                updateCoachMessage("Focus block complete. Take 60 seconds to breathe before the next move.");
                saveDashboardInteraction("focus_complete", "Completed focus timer", {
                    completedAt: new Date().toISOString()
                });
            }
        }, 1000);
    });

    resetButton.addEventListener("click", () => {
        if (focusInterval) {
            window.clearInterval(focusInterval);
            focusInterval = null;
        }
        focusSeconds = 300;
        paintFocusTimer();
        startButton.textContent = "Start Focus";
        updateText("#focusStatus", "Ready");
        panel?.classList.remove("running");
        saveDashboardInteraction("focus_reset", "Reset focus timer", {
            resetAt: new Date().toISOString()
        });
    });
}

function setupStreakMap() {
    const buttons = document.querySelectorAll("#streakMap button");
    if (!buttons.length || document.body.dataset.streakMapBound) {
        return;
    }

    document.body.dataset.streakMapBound = "true";

    function paint() {
        const activeCount = [...buttons].filter((button) => button.classList.contains("active")).length;
        updateText("#streakMapStatus", `${activeCount} / 7 active`);
        saveDashboardState({ activeWeekDays: activeCount });
    }

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            button.classList.toggle("active");
            paint();
            updateCoachMessage("Weekly map updated. Small visible wins make consistency easier.");
            saveDashboardInteraction("streak_map_update", "Updated weekly streak map", {
                activeDays: [...buttons].filter((item) => item.classList.contains("active")).map((item) => item.textContent),
                updatedAt: new Date().toISOString()
            });
        });
    });

    paint();
}

function setupMoodCheck() {
    const buttons = document.querySelectorAll("#moodGrid button");
    if (!buttons.length || document.body.dataset.moodBound) {
        return;
    }

    document.body.dataset.moodBound = "true";
    const moodNotes = {
        Calm: "Calm mood selected. Keep the workout smooth and focus on clean form.",
        Strong: "Strong mood selected. Keep intensity high but controlled.",
        Tired: "Tired mood selected. Reduce intensity and protect recovery today.",
        Focused: "Focused mood selected. This is a good day for precise sets and short rests."
    };

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            buttons.forEach((item) => item.classList.remove("selected"));
            button.classList.add("selected");
            const mood = button.dataset.mood || "Strong";
            updateText("#moodStatus", mood);
            updateText("#moodCoach", moodNotes[mood]);
            updateCoachMessage(moodNotes[mood]);
            saveDashboardState({ mood });
            saveDashboardInteraction("mood_update", "Updated mood check", {
                mood,
                note: moodNotes[mood],
                updatedAt: new Date().toISOString()
            });
        });
    });
}

function hydrateEnhancedDashboard(data) {
    const state = getDashboardState();
    const energyRange = document.querySelector("#energyRange");
    const focusRange = document.querySelector("#focusRange");
    const recoveryRange = document.querySelector("#recoveryRange");

    if (energyRange && focusRange && recoveryRange) {
        if (!energyRange.dataset.bound) {
            [energyRange, focusRange, recoveryRange].forEach((range) => {
                range.dataset.bound = "true";
                range.addEventListener("input", updateReadinessState);
            });
        }

        energyRange.value = state.energy || 7;
        focusRange.value = state.focus || 8;
        recoveryRange.value = state.recovery || 6;
        updateReadinessState();
    }

    if (!document.body.dataset.hydrationBound) {
        document.body.dataset.hydrationBound = "true";
        setupHydrationTracker();
        setupMissionModule();
        setupFocusTimer();
        setupStreakMap();
        setupMoodCheck();
    }

    setupDashboardChatbot(data);

    updateCoachMessage(
        `${data.user.name}, your ${String(data.user.goal).toLowerCase()} plan looks strong today. Keep ${String(data.user.preferences.preferredWorkout).toLowerCase()} intentional and recover well after.`
    );
}

function openMealModal() {
    openModal("#mealModal");
    document.querySelector("#mealName")?.focus();
}

function closeMealModal() {
    closeModal("#mealModal");
    saveDashboardInteraction("meal_modal_close", "Closed meal log modal", {
        closedAt: new Date().toISOString()
    });
}

async function handleDashboardAction(action) {
    try {
        if (action === "start-workout") {
            scrollToPanel("#workout");
            setWorkoutRunning();
            await postDashboardAction("/api/dashboard/workout/start");
        }

        if (action === "log-meal") {
            scrollToPanel("#nutrition");
            openMealModal();
            await saveDashboardInteraction("meal_modal_open", "Opened meal log modal", {
                openedAt: new Date().toISOString()
            });
        }

        if (action === "view-schedule") {
            scrollToPanel("#schedule");
            await postDashboardAction("/api/dashboard/schedule/view");
        }

        if (action === "check-progress") {
            if (getSavedUserRole() !== "user") {
                showToast("Only user accounts can open the progress page.");
                return;
            }
            await postDashboardAction("/api/dashboard/progress/check");
            window.location.href = "progress.html";
        }
    } catch (error) {
        showToast(error.message);
    }
}

document.querySelectorAll("[data-dashboard-action]").forEach((button) => {
    button.addEventListener("click", () => {
        handleDashboardAction(button.dataset.dashboardAction);
    });
});

document.querySelector(".quick-panel a[href='index.html']")?.addEventListener("click", async (event) => {
    event.preventDefault();
    await saveDashboardInteraction("back_to_website", "Clicked back to website", {
        clickedAt: new Date().toISOString()
    });
    window.location.href = "index.html";
});

const mealForm = document.querySelector("#mealForm");
if (mealForm) {
    mealForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(mealForm);

        try {
            await postDashboardAction("/api/dashboard/meal", {
                mealName: formData.get("mealName"),
                calories: Number(formData.get("calories")),
                protein: Number(formData.get("protein"))
            });
            mealForm.reset();
            closeMealModal();
        } catch (error) {
            showToast(error.message);
        }
    });
}

document.querySelector("#closeMealModal")?.addEventListener("click", closeMealModal);
document.querySelector("#mealModal")?.addEventListener("click", (event) => {
    if (event.target.id === "mealModal") {
        closeMealModal();
    }
});
document.querySelector("#openPlannerButton")?.addEventListener("click", () => {
    openModal("#plannerModal");
    saveDashboardInteraction("planner_open", "Opened customize plan", {
        openedAt: new Date().toISOString()
    });
});
document.querySelector("#closePlannerModal")?.addEventListener("click", () => {
    closeModal("#plannerModal");
    saveDashboardInteraction("planner_close", "Closed customize plan", {
        closedAt: new Date().toISOString()
    });
});
document.querySelector("#plannerModal")?.addEventListener("click", (event) => {
    if (event.target.id === "plannerModal") {
        closeModal("#plannerModal");
        saveDashboardInteraction("planner_close", "Closed customize plan", {
            closedAt: new Date().toISOString()
        });
    }
});
document.querySelector("#completeWorkoutButton")?.addEventListener("click", completeWorkout);
document.querySelector("#logoutButton")?.addEventListener("click", async () => {
    await saveDashboardInteraction("logout", "Clicked logout", {
        clickedAt: new Date().toISOString()
    });
    localStorage.removeItem("smartTrackerToken");
    localStorage.removeItem("smartTrackerUser");
    window.location.href = "login.html";
});

const plannerForm = document.querySelector("#plannerForm");
if (plannerForm) {
    plannerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const token = getToken();
        const formData = new FormData(plannerForm);

        const goal = formData.get("goal");
        const workout = formData.get("preferredWorkout");
        const experience = formData.get("experienceLevel");
        const mealPref = formData.get("mealPreference");
        const wakeTime = formData.get("wakeTime");
        const workoutTime = formData.get("workoutTime");
        const availableMinutes = Number(formData.get("availableMinutes"));
        const workoutDays = Number(formData.get("workoutDays"));

        // Generate AI recommendations based on user input
        const aiRecommendation = generateAIRecommendation({
            goal,
            workout,
            experience,
            mealPref,
            wakeTime,
            workoutTime,
            availableMinutes,
            workoutDays
        });

        // Show AI section
        const aiSection = document.querySelector("#aiAssistanceSection");
        const aiRecommendations = document.querySelector("#aiRecommendations");
        const aiCopy = document.querySelector("#aiAssistanceCopy");
        if (aiSection && aiRecommendations) {
            aiRecommendations.innerHTML = aiRecommendation;
        }
        if (aiCopy) {
            aiCopy.textContent = "Based on your latest inputs, the AI assistant generated this plan.";
        }

        try {
            const data = await apiRequest("/api/dashboard/preferences", {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    goal: formData.get("goal"),
                    preferredWorkout: formData.get("preferredWorkout"),
                    experienceLevel: formData.get("experienceLevel"),
                    mealPreference: formData.get("mealPreference"),
                    wakeTime: formData.get("wakeTime"),
                    workoutTime: formData.get("workoutTime"),
                    sleepTime: formData.get("sleepTime"),
                    availableMinutes: Number(formData.get("availableMinutes")),
                    workoutDays: Number(formData.get("workoutDays")),
                    hydrationGoal: Number(formData.get("hydrationGoal"))
                })
            });

            renderDashboard(data.dashboard);
            showToast(data.message);
        } catch (error) {
            showToast(error.message);
        }
    });
}

function generateAIRecommendation(inputs) {
    const { goal, workout, experience, mealPref, wakeTime, workoutTime, availableMinutes, workoutDays } = inputs;

    let recommendations = "<ul class='ai-recommendation-list'>";

    if (goal === "Lose weight") {
        recommendations += "<li>Focus on cardio-focused sessions at least 3 times each week to support steady fat loss.</li>";
        recommendations += "<li>Keep meals aligned with a calorie deficit and use your " + escapeHtml(mealPref) + " preference to stay consistent.</li>";
    } else if (goal === "Build muscle") {
        recommendations += "<li>Prioritize resistance work and compound lifts so each session pushes progressive overload.</li>";
        recommendations += "<li>Protein intake matters more here, so build meals around recovery and muscle repair.</li>";
    } else if (goal === "Improve stamina") {
        recommendations += "<li>Blend cardio and strength work to improve endurance without dropping overall athletic balance.</li>";
        recommendations += "<li>Increase intensity gradually so your conditioning improves without overloading recovery.</li>";
    } else {
        recommendations += "<li>Consistency is the main lever, so protect your " + escapeHtml(workoutDays) + "-day weekly routine.</li>";
        recommendations += "<li>Use light to moderate intensity work to stay active while keeping recovery manageable.</li>";
    }

    if (experience === "Beginner") {
        recommendations += "<li>Your " + escapeHtml(availableMinutes) + "-minute sessions are a good beginner load. Focus on clean form before intensity.</li>";
        recommendations += "<li>Keep workouts simple and repeatable so the habit stays easy to maintain.</li>";
    } else if (experience === "Intermediate") {
        recommendations += "<li>Your " + escapeHtml(availableMinutes) + "-minute window supports a structured warm-up, main block, and short finisher.</li>";
        recommendations += "<li>Add progressive overload week to week so performance keeps moving forward.</li>";
    } else {
        recommendations += "<li>Use the " + escapeHtml(availableMinutes) + "-minute slot for higher-efficiency sets, density blocks, or interval work.</li>";
        recommendations += "<li>Advanced recovery habits will be important if you want quality output across the full week.</li>";
    }

    recommendations += "<li>Daily timing looks strongest with wake-up at " + escapeHtml(wakeTime) + " and training at " + escapeHtml(workoutTime) + ".</li>";
    recommendations += "<li>" + escapeHtml(workout) + " training matches this goal well, especially if you stay consistent through the week.</li>";

    recommendations += "</ul>";

    return recommendations;
}

async function loadDashboard() {
    if (!document.querySelector(".dashboard-page") || document.querySelector(".progress-page")) {
        return;
    }

    const token = getToken();
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const data = await apiRequest("/api/dashboard", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        renderDashboard(data);
    } catch (error) {
        localStorage.removeItem("smartTrackerToken");
        localStorage.removeItem("smartTrackerUser");
        window.location.href = "login.html";
    }
}

function renderProgressPage(data) {
    updateText("#progressUserName", data.user.name);
    updateText("#progressIntro", `Track how your ${String(data.user.goal).toLowerCase()} plan is moving this week and send direct feedback to your coach.`);
    updateText("#progressStreakValue", `${data.summary.streak} day${data.summary.streak > 1 ? "s" : ""}`);
    updateText("#progressCoachLine", `Coach feedback lane is open for your ${data.user.plan} plan.`);
    updateText("#progressGoalValue", `${data.summary.goalCompleted}%`);
    updateText("#progressGoalNote", data.summary.boosterTrend);
    updateText("#progressScoreValue", `${data.summary.boosterScore}%`);
    updateText("#progressScoreNote", data.summary.caloriesNote);
    updateText("#progressStepsValue", data.summary.steps.toLocaleString("en-IN"));
    updateText("#progressStepsNote", data.summary.stepsNote);

    const bars = document.querySelector("#progressPageBars");
    if (bars) {
        bars.innerHTML = data.progress
            .map(
                (item) =>
                    `<div><span>${escapeHtml(item.label)}</span><strong>${item.value}%</strong><i style="--fill: ${item.value}%"></i></div>`
            )
            .join("");
    }

    const activityFeed = document.querySelector("#progressActivityFeed");
    if (activityFeed) {
        activityFeed.innerHTML = data.activity
            .map((item) => `<p><strong>${escapeHtml(item.action)}</strong> ${escapeHtml(item.detail)}</p>`)
            .join("");
    }

    const badgeGrid = document.querySelector("#progressBadgeGrid");
    if (badgeGrid) {
        badgeGrid.innerHTML = data.achievements.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
    }
}

function renderProgressGuard(role) {
    const page = document.querySelector("#progressPage");
    if (!page) {
        return;
    }

    page.innerHTML = `
        <section class="progress-guard reveal visible">
            <p class="eyebrow">Restricted page</p>
            <h1>${role === "coach" ? "Coach accounts cannot open user progress" : "Login required"}</h1>
            <p>${role === "coach" ? "The progress page is only for user accounts to track results and send feedback to their coach." : "Sign in with a user account to view progress and send coach feedback."}</p>
            <a href="${role === "coach" ? "dashboard.html" : "login.html"}" class="btn btn-primary">${role === "coach" ? "Back to dashboard" : "Go to login"}</a>
        </section>
    `;
}

const coachFeedbackForm = document.querySelector("#coachFeedbackForm");
if (coachFeedbackForm) {
    coachFeedbackForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const token = getToken();
        const message = document.querySelector("#coachFeedbackMessage");
        const button = document.querySelector("#coachFeedbackButton");
        const formData = new FormData(coachFeedbackForm);

        try {
            setButtonLoading(button, true, "Sending...");
            setMessage(message, "Sending your feedback to the coach...", "success");
            await apiRequest("/api/dashboard/interaction", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    eventType: "coach_feedback",
                    label: "Submitted coach feedback",
                    payload: {
                        rating: formData.get("rating"),
                        feedback: formData.get("feedback"),
                        submittedAt: new Date().toISOString()
                    }
                })
            });
            coachFeedbackForm.reset();
            setMessage(message, "Feedback sent to your coach.", "success");
            showToast("Coach feedback submitted.");
        } catch (error) {
            setMessage(message, error.message, "error");
        } finally {
            setButtonLoading(button, false);
        }
    });
}

async function loadProgressPage() {
    if (!document.querySelector(".progress-page")) {
        return;
    }

    const token = getToken();
    const role = getSavedUserRole();

    if (!token) {
        renderProgressGuard("guest");
        return;
    }

    if (role !== "user") {
        renderProgressGuard(role);
        return;
    }

    try {
        const data = await apiRequest("/api/dashboard", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        renderProgressPage(data);
    } catch (error) {
        localStorage.removeItem("smartTrackerToken");
        localStorage.removeItem("smartTrackerUser");
        renderProgressGuard("guest");
    }
}

loadDashboard();
loadProgressPage();
