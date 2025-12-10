// dashboard.js — Final Version (with Today default + auto-refresh)

(async () => {
  const API_BASE = "http://localhost:5000";
  const statusEl = document.getElementById("status");
  const sitesList = document.getElementById("sitesList");
  const totalTimeEl = document.getElementById("totalTime");
  const fromEl = document.getElementById("from");
  const toEl = document.getElementById("to");

  const refreshBtn = document.getElementById("refresh");
  const last7Btn = document.getElementById("last7");
  const last30Btn = document.getElementById("last30");
  const todayBtn = document.getElementById("todayBtn");  // NEW

  const exportBtn = document.getElementById("exportCsv");

  const barChartEl = document.getElementById("barChart");
  const barLabelsEl = document.getElementById("barLabels");
  const lineChartEl = document.getElementById("lineChart");
  const lineLabelsEl = document.getElementById("lineLabels");

  const viewSitesBtn = document.getElementById("viewSites");
  const viewDaysBtn = document.getElementById("viewDays");
  const barContainer = document.getElementById("barContainer");
  const lineContainer = document.getElementById("lineContainer");

  const pagesPanel = document.getElementById("pagesPanel");

  let autoRefreshInterval = null;

  // ----------------------------------------------------------
  // Helper: Set date range
  // days = 0 means Today
  // ----------------------------------------------------------
  function setRange(days = 0) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    fromEl.value = start.toISOString().slice(0,10);
    toEl.value = end.toISOString().slice(0,10);
  }

  // ----------------------------------------------------------
  // Helper: Active button highlighting
  // ----------------------------------------------------------
  function setActiveRange(btn) {
    [todayBtn, last7Btn, last30Btn].forEach(b => b?.classList.remove("active"));
    btn?.classList.add("active");
  }

  // ----------------------------------------------------------
  // Helper: Auto-refresh (live screen time)
  // Only when Today is active
  // ----------------------------------------------------------
  function enableAutoRefresh(isToday) {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    if (isToday) {
      autoRefreshInterval = setInterval(loadData, 60_000); // refresh every 60s
    }
  }

  // ----------------------------------------------------------
  // Token lookup
  // ----------------------------------------------------------
  async function getToken() {
    try {
      const s = await chrome.storage.local.get("user");
      if (s?.user?.token) return s.user.token;
    } catch {}
    return localStorage.getItem("token");
  }

  // ----------------------------------------------------------
  // Format seconds → 1h 23m 10s
  // ----------------------------------------------------------
  function fmtSeconds(s) {
    s = Number(s) || 0;
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const sec = s % 60;
    return `${h? h+'h ':''}${m? m+'m ':''}${sec}s`;
  }

  // ----------------------------------------------------------
  // DRAW BAR CHART (unchanged from your version)
  // ----------------------------------------------------------
  function drawBarChart(dataEntries) {
    barChartEl.innerHTML = "";
    barLabelsEl.innerHTML = "";
    const w = barChartEl.clientWidth || 600;
    const h = barChartEl.clientHeight || 240;
    const padding = 20;
    const innerW = w - padding*2;
    const innerH = h - padding*2;
    const maxSeconds = Math.max(1, ...dataEntries.map(e => e[1]));
    const barWidth = Math.max(12, Math.floor(innerW/dataEntries.length) - 8);

    const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);

    // grid lines
    for (let i=0;i<4;i++){
      const y = padding + (i/3)*innerH;
      const line = document.createElementNS(svg.namespaceURI,"line");
      line.setAttribute("x1", padding);
      line.setAttribute("x2", w-padding);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "#eef2ff");
      svg.appendChild(line);
    }

    dataEntries.forEach((entry, idx) => {
      const [label, sec] = entry;
      const x = padding + idx*(barWidth + 8);
      const height = (sec/maxSeconds) * innerH;
      const y = padding + (innerH - height);

      const rect = document.createElementNS(svg.namespaceURI,"rect");
      rect.setAttribute("x",x);
      rect.setAttribute("y",y);
      rect.setAttribute("width",barWidth);
      rect.setAttribute("height",height);
      rect.setAttribute("fill","#7c3aed");
      rect.setAttribute("rx",3);
      svg.appendChild(rect);

      // label
      const t = document.createElementNS(svg.namespaceURI,"text");
      t.setAttribute("x",x+barWidth/2);
      t.setAttribute("y",padding+innerH+14);
      t.setAttribute("text-anchor","middle");
      t.setAttribute("fill","#475569");
      t.setAttribute("font-size","11");
      t.textContent = label.length>12?label.slice(0,12)+"…":label;
      svg.appendChild(t);
    });

    barChartEl.appendChild(svg);

    barLabelsEl.innerHTML = dataEntries.map(e=>`${e[0]} — ${fmtSeconds(e[1])}`).join(" · ");
  }

  // ----------------------------------------------------------
  // DRAW LINE CHART (unchanged from your version)
  // ----------------------------------------------------------
  function drawLineChart(dayEntries) {
    lineChartEl.innerHTML = "";
    lineLabelsEl.innerHTML = "";

    const w = lineChartEl.clientWidth || 600;
    const h = lineChartEl.clientHeight || 240;
    const padding = 28;
    const innerW = w - padding*2;
    const innerH = h - padding*2;
    const maxSeconds = Math.max(1, ...dayEntries.map(d => d.seconds));

    const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);

    // grid
    for (let i=0;i<4;i++){
      const y = padding + (i/3)*innerH;
      const line = document.createElementNS(svg.namespaceURI,"line");
      line.setAttribute("x1", padding);
      line.setAttribute("x2", w-padding);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("stroke","#eef2ff");
      svg.appendChild(line);
    }

    // points and path
    const points = dayEntries.map((d,i)=>{
      const x = padding + (i/(dayEntries.length-1||1))*innerW;
      const y = padding + innerH - (d.seconds/maxSeconds)*innerH;
      return {x,y};
    });

    // line
    const path = document.createElementNS(svg.namespaceURI,"path");
    path.setAttribute("d", points.map((p,i)=>`${i===0?'M':'L'}${p.x} ${p.y}`).join(" "));
    path.setAttribute("stroke","#7c3aed");
    path.setAttribute("stroke-width","2");
    path.setAttribute("fill","none");
    svg.appendChild(path);

    // dots + x labels
    points.forEach((p,i)=>{
      const c = document.createElementNS(svg.namespaceURI,"circle");
      c.setAttribute("cx",p.x);
      c.setAttribute("cy",p.y);
      c.setAttribute("r",3);
      c.setAttribute("fill","#7c3aed");
      svg.appendChild(c);

      const lbl = document.createElementNS(svg.namespaceURI,"text");
      lbl.setAttribute("x",p.x);
      lbl.setAttribute("y",padding+innerH+16);
      lbl.setAttribute("text-anchor","middle");
      lbl.setAttribute("font-size","11");
      lbl.setAttribute("fill","#475569");
      lbl.textContent = dayEntries[i].date.slice(5);
      svg.appendChild(lbl);
    });

    lineChartEl.appendChild(svg);

    lineLabelsEl.innerHTML = dayEntries.map(d => `${d.date} — ${fmtSeconds(d.seconds)}`).join(" · ");
  }

  // ----------------------------------------------------------
  // Main LOAD DATA function
  // ----------------------------------------------------------
  async function loadData() {
    statusEl.textContent = "Loading…";
    sitesList.innerHTML = "";
    totalTimeEl.textContent = "0s";
    barChartEl.innerHTML = ""; lineChartEl.innerHTML="";
    barLabelsEl.innerHTML=""; lineLabelsEl.innerHTML="";

    const token = await getToken();
    if (!token) {
      statusEl.textContent = "Please login first.";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/activity/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        statusEl.textContent = `Server error ${res.status}`;
        return;
      }

      const body = await res.json();
      const activities = body.activities || [];
      statusEl.textContent = `${activities.length} records loaded`;

      // date filtering
      const start = new Date(fromEl.value+"T00:00:00").getTime();
      const end = new Date(toEl.value+"T00:00:00").getTime() + 24*3600*1000;

      const siteMap = {};
      const dayMap = {};
      let total = 0;

      activities.forEach(a=>{
        const t = new Date(a.date).getTime();
        if (t < start || t >= end) return;
        const site = a.name || a.domain || "unknown";
        const dur = Number(a.duration || 0);

        siteMap[site] = (siteMap[site] || 0) + dur;

        const dayKey = new Date(t).toISOString().slice(0,10);
        dayMap[dayKey] = (dayMap[dayKey] || 0) + dur;

        total += dur;
      });

      totalTimeEl.textContent = fmtSeconds(total);

      // site list
      const sortedSites = Object.entries(siteMap).sort((a,b)=>b[1]-a[1]);
      if (!sortedSites.length) {
        sitesList.innerHTML = `<li class="muted">No activity in selected range</li>`;
      } else {
        sitesList.innerHTML = sortedSites
          .map(([s,sec]) => `<li><span>${s}</span><strong>${fmtSeconds(sec)}</strong></li>`)
          .join("");
      }

      // bar chart
      drawBarChart(sortedSites.slice(0,10));

      // line chart (daily)
      const days = [];
      const startD = new Date(fromEl.value+"T00:00:00");
      const endD = new Date(toEl.value+"T00:00:00");
      for (let d=new Date(startD); d<=endD; d.setDate(d.getDate()+1)) {
        const key = d.toISOString().slice(0,10);
        days.push({date:key, seconds: dayMap[key] || 0});
      }
      drawLineChart(days);

      // CSV export
      exportBtn.onclick = ()=>{
        const rows = [["date","site","duration_seconds"]];
        activities.forEach(a=>{
          const tt = new Date(a.date).getTime();
          if (tt < start || tt >= end) return;
          rows.push([new Date(a.date).toISOString(), a.domain, a.duration]);
        });
        const csv = rows.map(r=>r.join(",")).join("\n");
        const blob = new Blob([csv], { type:"text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "activity.csv"; a.click();
        URL.revokeObjectURL(url);
      };

    } catch (err) {
      statusEl.textContent = "Error loading data";
      console.error(err);
    }
  }

  // ----------------------------------------------------------
  // Event Wiring
  // ----------------------------------------------------------

  // Show TODAY by default
  setRange(0);
  setActiveRange(todayBtn);
  enableAutoRefresh(true);

  todayBtn.addEventListener("click", ()=>{
    setRange(0);
    setActiveRange(todayBtn);
    enableAutoRefresh(true);
    loadData();
  });

  last7Btn.addEventListener("click", ()=>{
    setRange(6);
    setActiveRange(last7Btn);
    enableAutoRefresh(false);
    loadData();
  });

  last30Btn.addEventListener("click", ()=>{
    setRange(29);
    setActiveRange(last30Btn);
    enableAutoRefresh(false);
    loadData();
  });

  refreshBtn.addEventListener("click", ()=>loadData());

  viewSitesBtn.addEventListener("click", ()=>{
    viewSitesBtn.classList.add("active");
    viewDaysBtn.classList.remove("active");
    barContainer.style.display = "";
    lineContainer.style.display = "none";
  });

  viewDaysBtn.addEventListener("click", ()=>{
    viewDaysBtn.classList.add("active");
    viewSitesBtn.classList.remove("active");
    lineContainer.style.display = "";
    barContainer.style.display = "none";
  });

  // ----------------------------------------------------------
  // Load immediately
  // ----------------------------------------------------------
  loadData();

})();
