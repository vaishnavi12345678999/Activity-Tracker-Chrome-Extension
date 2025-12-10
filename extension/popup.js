// popup.js (drop-in replacement)

const loginDiv = document.getElementById("loginDiv");
const signupDiv = document.getElementById("signupDiv");
const dashboardDiv = document.getElementById("dashboardDiv");
const loginError = document.getElementById("loginError");
const signupError = document.getElementById("signupError");
const userNameSpan = document.getElementById("userName");
const activityList = document.getElementById("activityList");
const API_BASE = "http://localhost:5000";

// UI helpers
const show = el => el?.classList?.remove("hidden");
const hide = el => el?.classList?.add("hidden");

// Persist token for background and popup
async function setTokenForBackground(token, userObj = {}) {
  const user = { ...userObj, token };
  await chrome.storage.local.set({ user });
  chrome.runtime.sendMessage({ type: "SET_TOKEN", token }, () => {});
}
async function clearTokenForBackground() {
  await chrome.storage.local.remove("user");
  chrome.runtime.sendMessage({ type: "CLEAR_TOKEN" }, () => {});
}

// Navigation handlers (keep your current IDs)
document.getElementById("showSignup").addEventListener("click", () => {
  hide(loginDiv); show(signupDiv); loginError.textContent = ""; signupError.textContent = "";
});
document.getElementById("backToLogin").addEventListener("click", () => {
  hide(signupDiv); show(loginDiv); loginError.textContent = ""; signupError.textContent = "";
});
document.getElementById("logoutBtn").addEventListener("click", async () => {
  localStorage.removeItem("token"); localStorage.removeItem("userName");
  await clearTokenForBackground();
  hide(dashboardDiv); show(loginDiv);
});

// Restore session on load
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const s = await chrome.storage.local.get("user");
    const user = s.user;
    if (user?.token) {
      localStorage.setItem("token", user.token);
      localStorage.setItem("userName", user.email || user.name || "You");
      showDashboard(user.email || user.name || "You");
      return;
    }
    // fallback to localStorage
    const token = localStorage.getItem("token");
    const name = localStorage.getItem("userName");
    if (token && name) {
      await setTokenForBackground(token, { email: name });
      showDashboard(name);
    }
  } catch (e) {
    console.warn("restore session error", e);
  }
});

// Google login (unchanged logic but keep token persistence)
document.getElementById("loginBtn").addEventListener("click", () => {
  loginError.textContent = "";
  chrome.identity.getAuthToken({ interactive: true }, async (chromeToken) => {
    if (chrome.runtime.lastError || !chromeToken) {
      loginError.textContent = "Login failed: " + (chrome.runtime.lastError?.message || "No token");
      return;
    }
    try {
      const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${chromeToken}` }
      });
      const user = await googleRes.json();
      const backendRes = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email })
      });
      const backendData = await backendRes.json();
      if (backendRes.ok && backendData.token) {
        localStorage.setItem("token", backendData.token);
        localStorage.setItem("userName", user.name || user.email);
        await setTokenForBackground(backendData.token, { email: user.email, name: user.name });
        showDashboard(user.name || user.email);
      } else {
        loginError.textContent = backendData.message || "Google login failed.";
      }
    } catch (err) {
      console.error("Google login error:", err);
      loginError.textContent = "Google login failed.";
    }
  });
});

// Manual login
document.getElementById("manualLoginBtn").addEventListener("click", async () => {
  loginError.textContent = "";
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();
  if (!email || !password) { loginError.textContent = "Enter email and password."; return; }
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("userName", email);
      await setTokenForBackground(data.token, { email });
      showDashboard(email);
    } else {
      loginError.textContent = data.message || "Login failed.";
    }
  } catch (err) {
    console.error("manual login error", err);
    loginError.textContent = "Login error, try again.";
  }
});

// Signup
document.getElementById("signupSubmit").addEventListener("click", async () => {
  signupError.textContent = "";
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value.trim();
  const confirm = document.getElementById("confirmPassword").value.trim();
  if (!email || !password || !confirm) { signupError.textContent = "Please fill all fields."; return; }
  if (password !== confirm) { signupError.textContent = "Passwords do not match."; return; }
  try {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      alert("Signup successful! Please login.");
      hide(signupDiv); show(loginDiv);
    } else signupError.textContent = data.message || "Signup failed.";
  } catch (err) { console.error("signup error", err); signupError.textContent = "Signup error."; }
});

// Dashboard
function showDashboard(name) {
  userNameSpan.textContent = name;
  hide(loginDiv); hide(signupDiv); show(dashboardDiv);
  loadUserActivities();
}

// Load activities (fixed endpoint + robust parsing)
async function loadUserActivities() {
  try {
    const s = await chrome.storage.local.get("user");
    const token = s.user?.token;
    if (!token) {
      activityList.innerHTML = "<li>Please login to see activity</li>";
      return;
    }

    const res = await fetch(`${API_BASE}/api/activity/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("Failed loading activities", res.status, text);
      activityList.innerHTML = `<li>Error loading activities (${res.status})</li>`;
      return;
    }

    const data = JSON.parse(text);
    const activities = data.activities || [];

    // Aggregate durations per site and compute today's total
    const siteDur = {};
    let totalToday = 0;
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(todayStart.getTime() + 24*60*60*1000);

    activities.forEach(a => {
      // backend uses: name, duration, date
      const name = a.name || a.domain || 'unknown';
      const dur = Number(a.duration ?? a.durationSeconds ?? 0);
      siteDur[name] = (siteDur[name] || 0) + dur;

      const ts = a.date ? new Date(a.date).getTime() : 0;
      if (ts >= todayStart.getTime() && ts < todayEnd.getTime()) totalToday += dur;
    });

    // Render list + total
    activityList.innerHTML = "";
    const totalLi = document.createElement("li");
    totalLi.innerHTML = `<strong>Total Time Today:</strong> ${totalToday} seconds`;
    totalLi.style.marginBottom = "8px";
    activityList.appendChild(totalLi);

    if (Object.keys(siteDur).length === 0) {
      activityList.innerHTML += "<li>No activity data available</li>";
    } else {
      for (const [site, sec] of Object.entries(siteDur)) {
        const li = document.createElement("li");
        li.textContent = `${site} — ${sec}s`;
        activityList.appendChild(li);
      }
    }

    // Chart (if canvas exists)
    const canvas = document.getElementById("activityChart");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (window._activityChart) try { window._activityChart.destroy(); } catch {}
      window._activityChart = new Chart(ctx, {
        type: "bar",
        data: { labels: Object.keys(siteDur), datasets: [{ label: "Time (s)", data: Object.values(siteDur) }] },
        options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
      });
    }

  } catch (err) {
    console.error("Failed to load activities", err);
    activityList.innerHTML = "<li>Error loading activities</li>";
  }
}
document.getElementById("openDashboardBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

