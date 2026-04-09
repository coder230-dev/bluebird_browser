// Enhanced Battery Analytics Dashboard (renderer-only)
// Improvements: left-axis percentage labels on sparkline, tooltip, more analytics, CSV export.
// Stores samples in localStorage under key "batteryData"

(() => {
    const STORAGE_KEY = "batteryData";
    const MAX_SAMPLES = 2000;
    const SAMPLE_MIN_INTERVAL_MS = 30 * 1000; // 30s
    const PERIODIC_SAMPLE_MS = 5 * 60 * 1000; // 5min
    const LOW_BATTERY_THRESHOLD = 15; // percent for alert

    // ---------- Utilities ----------
    const now = () => Date.now();
    const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
    const round = (v, p = 2) => Number(Number(v).toFixed(p));
    const fmtPercent = v => `${Math.round(v)}%`;
    const fmtTime = s => {
        if (!isFinite(s) || s === Infinity || s === 0) return "—";
        const sec = Math.max(0, Math.floor(s));
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const parts = [];
        if (h) parts.push(`${h}h`);
        if (m || !h) parts.push(`${m}m`);
        return parts.join(" ");
    };
    const fmtDate = ts => new Date(ts).toLocaleString();

    // ---------- Storage ----------
    function loadBatteryData() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        } catch {
            return [];
        }
    }
    function saveBatteryData(arr) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    }
    function recordSample(sample) {
        const data = loadBatteryData();
        const last = data.length ? data[data.length - 1] : null;
        if (last && sample.timestamp - last.timestamp < SAMPLE_MIN_INTERVAL_MS) {
            if (sample.timestamp - last.timestamp < 5000) {
                data[data.length - 1] = sample;
            } else {
                return;
            }
        } else {
            data.push(sample);
        }
        if (data.length > MAX_SAMPLES) data.splice(0, data.length - MAX_SAMPLES);
        saveBatteryData(data);
    }

    // ---------- Icon mapping ----------
    function getBatteryIcon(level, isCharging) {
        if (isCharging) return "battery_android_bolt";
        if (level >= 96) return "battery_android_frame_full";
        if (level >= 86) return "battery_android_frame_6";
        if (level >= 71) return "battery_android_frame_5";
        if (level >= 56) return "battery_android_frame_4";
        if (level >= 36) return "battery_android_frame_3";
        if (level >= 21) return "battery_android_frame_2";
        if (level >= 6) return "battery_android_frame_1";
        if (level >= 0) return "battery_android_alert";
        return "battery_android_question";
    }

    // ---------- Math helpers ----------
    function median(arr) {
        if (!arr.length) return null;
        const s = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    }
    function stddev(arr) {
        if (!arr.length) return null;
        const m = arr.reduce((a, b) => a + b, 0) / arr.length;
        const v = arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length;
        return Math.sqrt(v);
    }

    // ---------- Analytics computations ----------
    function computeRecentRate(samples, windowMinutes = 5) {
        if (!samples.length) return null;
        const cutoff = now() - windowMinutes * 60 * 1000;
        const recent = samples.filter(s => s.timestamp >= cutoff);
        if (recent.length < 2) return null;
        const first = recent[0], last = recent[recent.length - 1];
        const dtMin = (last.timestamp - first.timestamp) / 60000;
        if (dtMin <= 0) return null;
        const dLevel = last.level - first.level;
        return round(dLevel / dtMin, 4); // % per minute
    }

    function computeRollingAverage(samples, mode = "discharge") {
        const filtered = samples.filter(s => (mode === "discharge" ? !s.charging : s.charging));
        if (filtered.length < 2) return null;
        const first = filtered[0], last = filtered[filtered.length - 1];
        const dtMin = (last.timestamp - first.timestamp) / 60000;
        if (dtMin <= 0) return null;
        const dLevel = last.level - first.level;
        return round(dLevel / dtMin, 4);
    }

    function computePeakRates(samples) {
        if (samples.length < 2) return { peakDrain: null, peakCharge: null };
        let peakDrain = 0, peakCharge = 0;
        for (let i = 1; i < samples.length; i++) {
            const dtMin = (samples[i].timestamp - samples[i - 1].timestamp) / 60000;
            if (dtMin <= 0) continue;
            const rate = (samples[i].level - samples[i - 1].level) / dtMin;
            if (rate < peakDrain) peakDrain = rate;
            if (rate > peakCharge) peakCharge = rate;
        }
        return { peakDrain: round(peakDrain, 4), peakCharge: round(peakCharge, 4) };
    }

    function computeCycles(samples) {
        if (samples.length < 2) return 0;
        let transitions = 0;
        for (let i = 1; i < samples.length; i++) {
            if (samples[i].charging !== samples[i - 1].charging) transitions++;
        }
        return Math.floor(transitions / 2);
    }

    function computeLowEvents(samples, threshold = 20) {
        return samples.filter(s => s.level <= threshold).length;
    }

    function computeSessionLengths(samples) {
        // returns array of session durations (ms) for charging sessions and discharging sessions
        const sessions = [];
        if (!samples.length) return sessions;
        let start = samples[0];
        for (let i = 1; i < samples.length; i++) {
            if (samples[i].charging !== start.charging) {
                sessions.push({ charging: start.charging, start: start.timestamp, end: samples[i].timestamp, duration: samples[i].timestamp - start.timestamp });
                start = samples[i];
            }
        }
        // last session
        const last = samples[samples.length - 1];
        sessions.push({ charging: start.charging, start: start.timestamp, end: last.timestamp, duration: last.timestamp - start.timestamp });
        return sessions;
    }

    function computeHourlyDrain(samples) {
        // returns array[24] average delta per hour (negative = drain)
        const buckets = Array.from({ length: 24 }, () => []);
        for (let i = 1; i < samples.length; i++) {
            const prev = samples[i - 1], cur = samples[i];
            const hour = new Date(cur.timestamp).getHours();
            const dtMin = (cur.timestamp - prev.timestamp) / 60000;
            if (dtMin <= 0) continue;
            const rate = (cur.level - prev.level) / dtMin; // %/min
            buckets[hour].push(rate);
        }
        return buckets.map(arr => arr.length ? round(arr.reduce((a, b) => a + b, 0) / arr.length, 4) : null);
    }

    function estimateTimeToEmptyOrFull(currentLevel, isCharging, recentRatePerMin, batteryObj) {
        if (isCharging && batteryObj.chargingTime && isFinite(batteryObj.chargingTime) && batteryObj.chargingTime > 0) {
            return batteryObj.chargingTime;
        }
        if (!isCharging && batteryObj.dischargingTime && isFinite(batteryObj.dischargingTime) && batteryObj.dischargingTime > 0) {
            return batteryObj.dischargingTime;
        }
        if (!recentRatePerMin || recentRatePerMin === 0) return Infinity;
        if (isCharging) {
            const remainingPct = 100 - currentLevel;
            const minutes = remainingPct / recentRatePerMin;
            return minutes * 60;
        } else {
            const minutes = currentLevel / Math.abs(recentRatePerMin);
            return minutes * 60;
        }
    }

    function computeHealthScore(samples) {
        if (!samples.length) return null;
        const avgDis = Math.abs(computeRollingAverage(samples, "discharge") || 0);
        const avgCh = Math.abs(computeRollingAverage(samples, "charge") || 0);
        const lowEvents = computeLowEvents(samples);
        let score = 100;
        score -= Math.min(50, avgDis * 5);
        score -= Math.min(20, lowEvents * 0.5);
        if (avgCh && avgCh < 0.5) score -= 5;
        // trend: if recent drain is improving, small bonus
        const recent = computeRecentRate(samples, 30);
        if (recent !== null && recent > -0.2) score += 3;
        return Math.max(0, Math.round(score));
    }

    // ---------- CSV export ----------
    function exportCSV(samples) {
        if (!samples.length) return;
        const header = ["timestamp", "iso", "level", "charging", "chargingTime", "dischargingTime"];
        const rows = samples.map(s => [
            s.timestamp,
            new Date(s.timestamp).toISOString(),
            s.level,
            s.charging,
            s.chargingTime ?? "",
            s.dischargingTime ?? ""
        ]);
        const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `batteryData_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // ---------- Visual helpers (sparkline with left axis) ----------
    function drawSparklineWithAxis(canvas, values, color = "#7CFC00") {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const DPR = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        canvas.width = Math.floor(width * DPR);
        canvas.height = Math.floor(height * DPR);
        ctx.scale(DPR, DPR);
        ctx.clearRect(0, 0, width, height);

        const leftPadding = 44; // space for percentage labels
        const w = width - leftPadding - 8;
        const h = height - 12;
        const x0 = leftPadding;
        const y0 = 6;

        // background
        ctx.fillStyle = "rgba(255,255,255,0.01)";
        ctx.fillRect(0, 0, width, height);

        if (!values.length) {
            // draw axis labels empty
            ctx.fillStyle = "#7f9fb8";
            ctx.font = "12px Poppins, system-ui";
            ctx.fillText("No data", x0 + 8, height / 2);
            return;
        }

        const max = Math.max(...values), min = Math.min(...values);
        const range = max - min || 1;

        // draw left axis ticks (5 ticks)
        ctx.fillStyle = "#9fb0c8";
        ctx.font = "12px Poppins, system-ui";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        const ticks = 5;
        for (let i = 0; i <= ticks; i++) {
            const t = i / ticks;
            const y = y0 + (1 - t) * h;
            const val = Math.round(min + t * range);
            ctx.fillText(`${val}%`, leftPadding - 8, y);
            // small tick line
            ctx.strokeStyle = "rgba(255,255,255,0.03)";
            ctx.beginPath();
            ctx.moveTo(leftPadding - 4, y);
            ctx.lineTo(leftPadding, y);
            ctx.stroke();
        }

        // draw sparkline path
        ctx.beginPath();
        values.forEach((v, i) => {
            const x = x0 + (i / (values.length - 1 || 1)) * w;
            const y = y0 + (1 - (v - min) / range) * h;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // fill under curve
        ctx.lineTo(x0 + w, y0 + h);
        ctx.lineTo(x0, y0 + h);
        ctx.closePath();
        ctx.fillStyle = color + "22";
        ctx.fill();

        // draw border vertical line separating axis
        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        ctx.beginPath();
        ctx.moveTo(leftPadding, 4);
        ctx.lineTo(leftPadding, height - 4);
        ctx.stroke();
    }

    // tooltip for sparkline
    function attachSparkTooltip(canvas, samples) {
        // remove existing tooltip if any
        let tooltip = document.getElementById("spark-tooltip");
        if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.id = "spark-tooltip";
            tooltip.style.position = "fixed";
            tooltip.style.pointerEvents = "none";
            tooltip.style.padding = "8px 10px";
            tooltip.style.borderRadius = "8px";
            tooltip.style.background = "rgba(6,12,20,0.9)";
            tooltip.style.color = "#dff7ff";
            tooltip.style.fontSize = "12px";
            tooltip.style.boxShadow = "0 6px 18px rgba(0,0,0,0.6)";
            tooltip.style.zIndex = 9999;
            tooltip.style.display = "none";
            document.body.appendChild(tooltip);
        }

        function hide() {
            tooltip.style.display = "none";
        }

        function showAt(x, y, html) {
            tooltip.innerHTML = html;
            tooltip.style.left = `${x + 12}px`;
            tooltip.style.top = `${y + 12}px`;
            tooltip.style.display = "block";
        }

        canvas.onmousemove = (ev) => {
            if (!samples.length) return hide();
            const rect = canvas.getBoundingClientRect();
            const leftPadding = 44;
            const x0 = rect.left + leftPadding;
            const w = rect.width - leftPadding - 8;
            const relX = clamp(ev.clientX - x0, 0, w);
            const idx = Math.round((relX / (w || 1)) * (samples.length - 1));
            const s = samples[idx];
            if (!s) return hide();
            const html = `<div style="font-weight:700">${s.level}%</div><div style="color:#bfe9ff;font-size:12px">${fmtDate(s.timestamp)}</div>`;
            showAt(ev.clientX, ev.clientY, html);
        };
        canvas.onmouseleave = hide;
    }

    // ---------- UI rendering ----------
    function createCard(title, innerHTML) {
        return `
      <section class="card">
        <h3>${title}</h3>
        <div class="card-body">${innerHTML}</div>
      </section>
    `;
    }

    function drawHistogram(canvas, values, bins = 10, color = "#4FC3F7") {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (!values.length) return;
        const min = 0, max = 100;
        const binSize = (max - min) / bins;
        const counts = new Array(bins).fill(0);
        values.forEach(v => {
            const idx = Math.min(bins - 1, Math.floor((v - min) / binSize));
            counts[idx]++;
        });
        const maxCount = Math.max(...counts) || 1;
        const barW = w / bins;
        counts.forEach((c, i) => {
            const barH = (c / maxCount) * h;
            ctx.fillStyle = color;
            ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
        });
    }

    function renderDashboard(state) {
        const {
            level, isCharging, chargingTime, dischargingTime,
            recentRate, avgDischarge, avgCharge, cycles, lowEvents, healthScore,
            samples, peakDrain, peakCharge, medianRate, stdRate, sessions, hourlyDrain, lastSampleTime
        } = state;

        const sparkValues = samples.slice(-120).map(s => s.level);
        const histValues = samples.map(s => s.level);

        const summaryHTML = `
      <div class="summary card-lg">
        <i class="material-symbols-rounded">${getBatteryIcon(level, isCharging)}</i>
        <div>
          <div class="percent">${fmtPercent(level)}</div>
          <div class="subtle">${isCharging ? "Charging" : "Discharging"} • Last: ${lastSampleTime ? new Date(lastSampleTime).toLocaleTimeString() : "—"}</div>
        </div>
      </div>
      <div class="stat-grid" style="margin-top:12px">
        <div class="stat"><b>${fmtTime(chargingTime)}</b><div class="small">Time to full</div></div>
        <div class="stat"><b>${fmtTime(dischargingTime)}</b><div class="small">Time to empty</div></div>
        <div class="stat"><b>${samples.length}</b><div class="small">Samples stored</div></div>
        <div class="stat"><b>${cycles}</b><div class="small">Charge cycles (est.)</div></div>
      </div>
    `;

        const gaugeHTML = `
      <div class="gauge card-md">
        <div class="gauge-bar"><div class="gauge-fill" style="width:${clamp(level, 0, 100)}%"></div></div>
        <div class="stat-grid" style="margin-top:10px">
          <div class="stat"><b>${recentRate === null ? "…" : `${recentRate > 0 ? "+" : ""}${recentRate}%/min`}</b><div class="small">Instant rate</div></div>
          <div class="stat"><b>${medianRate === null ? "…" : `${medianRate > 0 ? "+" : ""}${medianRate}%/min`}</b><div class="small">Median rate</div></div>
          <div class="stat"><b>${stdRate === null ? "…" : `${stdRate}`}</b><div class="small">Std dev</div></div>
          <div class="stat"><b>${peakDrain === null ? "…" : `${peakDrain}%/min`}</b><div class="small">Peak drain</div></div>
        </div>
      </div>
    `;

        const trendsHTML = `
      <div class="trends card-md">
        <div class="trend-item"><div class="small">Avg discharge</div><div class="value">${avgDischarge === null ? "…" : `${avgDischarge}%/min`}</div></div>
        <div class="trend-item"><div class="small">Avg charge</div><div class="value">${avgCharge === null ? "…" : `${avgCharge}%/min`}</div></div>
        <div class="trend-item"><div class="small">Peak charge</div><div class="value">${peakCharge === null ? "…" : `${peakCharge}%/min`}</div></div>
        <div class="trend-item"><div class="small">Low events (≤20%)</div><div class="value">${lowEvents}</div></div>
      </div>
    `;

        const healthHTML = `
      <div class="health-score card-sm">
        <div class="health-badge">${healthScore === null ? "—" : healthScore - 3}</div>
        <div>
          <div style="font-weight:600">Battery health</div>
          <div class="subtle">Heuristic score (0–100) based on drain speed, low events, and trend</div>
          <div style="margin-top:8px" class="small">Sessions: ${sessions.length} • Avg session: ${sessions.length ? fmtTime(Math.round(sessions.reduce((a, b) => a + b.duration, 0) / sessions.length / 1000)) : "—"}</div>
        </div>
      </div>
      <div class="tips">${generateTips(state).map(t => `<div>• ${t}</div>`).join("")}</div>
    `;

        const historyHTML = `
      <div class="card-sm" style="display:flex;gap:12px;align-items:center">
        <div style="flex:1">
          <canvas id="spark" width="720" height="120"></canvas>
        </div>
      </div>
      <div style="height:10px"></div>
      <canvas id="hist" width="720" height="80"></canvas>
    `;

        const controlsHTML = `
      <div class="controls card-sm">
        <div style="display:flex;gap:8px">
          <button id="btnExport">Export CSV</button>
          <button id="btnClear">Clear analytics</button>
          </div>
          <div class="sample-count">Stored: <b>${samples.length}</b></div>
          </div>
    `;

        const html = `
      <div class="dashboard-grid" style="display:grid;grid-template-columns:1fr;gap:12px">
        ${createCard("Summary", summaryHTML)}
        ${createCard("Live Gauge", gaugeHTML)}
        ${createCard("Trends", trendsHTML)}
        ${createCard("Health & Tips", healthHTML)}
        ${createCard("History", historyHTML)}
        ${createCard("Controls", controlsHTML)}
      </div>
    `;

        document.querySelector("main").innerHTML = html;

        // draw sparkline with axis and histogram
        const spark = document.getElementById("spark");
        const hist = document.getElementById("hist");
        drawSparklineWithAxis(spark, sparkValues, "#7CFC00");
        drawHistogram(hist, histValues, 12, "#4FC3F7");

        // attach tooltip
        attachSparkTooltip(spark, samples.slice(-120));

        // wire controls
        document.getElementById("btnClear").addEventListener("click", () => {
            if (!confirm("Clear stored battery analytics? This cannot be undone.")) return;
            localStorage.removeItem(STORAGE_KEY);
            renderDashboard({
                level, isCharging, chargingTime, dischargingTime,
                recentRate: null, avgDischarge: null, avgCharge: null, cycles: 0, lowEvents: 0, healthScore: null, samples: []
            });
        });
        document.getElementById("btnExport").addEventListener("click", () => exportCSV(samples));
    }

    // ---------- Tips generator ----------
    function generateTips(state) {
        const tips = [];
        const { level, isCharging, recentRate, avgDischarge, avgCharge, lowEvents } = state;
        if (!isCharging && level <= LOW_BATTERY_THRESHOLD) tips.push("Battery low — consider plugging in soon.");
        if (isCharging && level >= 95) tips.push("Battery nearly full — unplug occasionally to reduce wear.");
        if (recentRate !== null && recentRate < -1.5) tips.push("High drain detected — close heavy tabs or disable extensions.");
        if (avgDischarge !== null && avgDischarge < -0.5) tips.push("Average drain moderate; enable power saving for longer sessions.");
        if (avgCharge !== null && avgCharge < 0.5) tips.push("Charging appears slow — check cable/charger or try a different port.");
        if (lowEvents > 3) tips.push("Device frequently reaches low battery — avoid deep discharges to improve longevity.");
        if (!tips.length) tips.push("Battery looks stable. Monitor trends for long-term health.");
        return tips;
    }

    // ---------- Main initialization ----------
    async function initBatteryDashboard() {
        if (!("getBattery" in navigator)) {
            document.querySelector("main").innerHTML = "<p>Battery API not supported in this environment.</p>";
            return;
        }

        const battery = await navigator.getBattery();

        // initial sample and render
        const sample = {
            timestamp: now(),
            level: Math.round(battery.level * 100),
            charging: !!battery.charging,
            chargingTime: battery.chargingTime || null,
            dischargingTime: battery.dischargingTime || null
        };
        recordSample(sample);

        // compute and render
        function computeAndRender() {
            const samples = loadBatteryData();
            const recentRate = computeRecentRate(samples, 5);
            const avgDischarge = computeRollingAverage(samples, "discharge");
            const avgCharge = computeRollingAverage(samples, "charge");
            const { peakDrain, peakCharge } = computePeakRates(samples);
            const cycles = computeCycles(samples);
            const lowEvents = computeLowEvents(samples);
            const healthScore = computeHealthScore(samples);
            const medianRate = median(samples.slice(-120).map((s, i, arr) => {
                if (i === 0) return 0;
                const prev = arr[i - 1];
                const dtMin = (s.timestamp - prev.timestamp) / 60000;
                return dtMin > 0 ? (s.level - prev.level) / dtMin : 0;
            }));
            const stdRate = round(stddev(samples.slice(-120).map((s, i, arr) => {
                if (i === 0) return 0;
                const prev = arr[i - 1];
                const dtMin = (s.timestamp - prev.timestamp) / 60000;
                return dtMin > 0 ? (s.level - prev.level) / dtMin : 0;
            })) || 0, 4);
            const sessions = computeSessionLengths(samples);
            const hourlyDrain = computeHourlyDrain(samples);
            const lastSampleTime = samples.length ? samples[samples.length - 1].timestamp : null;

            renderDashboard({
                level: sample.level,
                isCharging: sample.charging,
                chargingTime: sample.chargingTime,
                dischargingTime: sample.dischargingTime,
                recentRate, avgDischarge, avgCharge, cycles, lowEvents, healthScore,
                samples, peakDrain, peakCharge, medianRate, stdRate, sessions, hourlyDrain, lastSampleTime
            });

            // low battery visual alert (small pulse on body)
            if (!sample.charging && sample.level <= LOW_BATTERY_THRESHOLD) {
                document.body.style.boxShadow = "inset 0 0 120px rgba(255,40,40,0.06)";
            } else {
                document.body.style.boxShadow = "none";
            }
        }

        computeAndRender();

        // unified update handler
        const emit = () => {
            const s = {
                timestamp: now(),
                level: Math.round(battery.level * 100),
                charging: !!battery.charging,
                chargingTime: battery.chargingTime || null,
                dischargingTime: battery.dischargingTime || null
            };
            recordSample(s);
            // update sample reference for computeAndRender closure
            Object.assign(sample, s);
            computeAndRender();
        };

        battery.addEventListener("levelchange", emit);
        battery.addEventListener("chargingchange", emit);
        battery.addEventListener("chargingtimechange", emit);
        battery.addEventListener("dischargingtimechange", emit);

        // periodic sample to capture long idle periods
        setInterval(() => {
            const s = {
                timestamp: now(),
                level: Math.round(battery.level * 100),
                charging: !!battery.charging,
                chargingTime: battery.chargingTime || null,
                dischargingTime: battery.dischargingTime || null
            };
            recordSample(s);
            Object.assign(sample, s);
            computeAndRender();
        }, PERIODIC_SAMPLE_MS);
    }

    // start
    initBatteryDashboard().catch(err => {
        console.error("Battery dashboard init failed", err);
        document.querySelector("main").innerHTML = "<p>Failed to initialize battery dashboard.</p>";
    });

    function deleteOlderThan(days) {
        const data = loadBatteryData();
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const filtered = data.filter(s => s.timestamp >= cutoff);
        saveBatteryData(filtered);
    }
    deleteOlderThan(20)
})();
