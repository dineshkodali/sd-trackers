# SDTracker Real-Time Status & Infrastructure Health Portal

A compact, real-time, high-density system status and diagnostic dashboard for **SDTracker** (by **SDCommercial**).

---

## 1. Key Architectural Upgrades

### A. Real-Time Failure Watchdog (Zero-Delay Reflection)
Whenever any service component, process thread, database connection, or API route fails or degrades:
1. **Immediate Candidate Confirmation**: Failures are confirmed on the very first detection cycle (`CONFIRM_CHECKS = 1`), immediately updating the top status banner and component state.
2. **Aggressive Client Polling**: The frontend polls `/api/status?live=1` every **3.5 seconds** with active countdown and live latency telemetry.
3. **Instant Network & Process Fallback**: If the backend server drops or encounters an unhandled process exception (`uncaughtException` / `unhandledRejection`), the status page immediately trips to **Major System Outage** and opens an automated incident audit card.
4. **Browser Runtime Error Capture**: Listens to global `window.error` and `unhandledrejection` events to immediately flag frontend client health degradation if client scripts crash.

### B. The 5 Core Infrastructure Pillars
Displays live health and latency metrics for:
- 🖥️ **Backend Runtime**: Node.js process health, event loop latency, and unhandled exception monitoring.
- 🌐 **Frontend Client**: SPA bundle availability, responsive render state, and browser runtime health.
- ⚡ **API Services**: REST route latency, `/api/health`, and HTTP error rates.
- 🗄️ **Database (DBs)**: PostgreSQL / Supabase pool latency, schema migrations, and table query probes.
- 🔄 **Flows & Workers**: Background jobs, SLA monitoring cron, and SMTP email dispatch queues.

### C. Compact, High-Density Executive Layout
Instead of vertically stacked sections spanning thousands of pixels, the dashboard uses a **streamlined executive format**:
- **Compact Hero Banner**: Streamlined overall status bar (~68px) with average latency, 90-day availability, and real-time timestamp.
- **2-Column Services Matrix**: 8 compact service rows with latency pills and status badges.
- **Segmented Detail Tabs**: Seamless tab bar switching between:
  - **Live Incidents** (with active count badge)
  - **90-Day Uptime** (stats grid + 90-day visual bar with hover tooltip)
  - **Planned Maintenance** (scheduled maintenance windows)
  - **Incident History** (expandable audit trail accordions)
  - **Subscribe to Alerts** (compact inline notification preference)

---

## 2. How to Open

- **Direct in Browser**: Double-click `status.html` or `status/index.html` to open directly via `file://`.
- **Via Express Server**:
  ```bash
  npm run dev
  # Navigate to http://localhost:3020/status.html or http://localhost:3020/status/
  ```

---

## 3. Immediate Incident Simulation (Demo Controls)

Click the **"⚙️ Demo Controls"** button in the header or the floating pill at bottom-right to test immediate reactions:
- **Set All Operational**: Resets all services and pillars to healthy operational state.
- **Simulate Degraded DB**: Immediately reflects degraded performance on PostgreSQL and opens a live database lock contention incident.
- **Simulate API Outage**: Immediately flips API Gateway to Partial Outage and opens an incident.
- **Simulate Major Outage**: Instantly switches overall status to Major System Outage.
- **Simulate Maintenance**: Activates the planned maintenance window.
- **Clear Incidents**: Closes all active incident cards.

---

## 4. Verification & Testing

Run the automated Playwright test suite covering all screen sizes (320px, 375px, 768px, 1440px) and error simulations:
```bash
npx tsx scripts/test-status-page.ts
```
