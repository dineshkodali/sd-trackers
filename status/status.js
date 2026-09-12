/**
 * SDTracker WebCRM — Status Page Engine (Real-Time Compact Edition)
 * Real-Time Monitoring across Backend, Frontend, APIs, Databases, and Flows.
 * Instant failure reflection with zero delay.
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. Initial State & Data Definitions
  // =========================================================================

  const STATUS_DEFINITIONS = {
    operational: {
      label: 'Operational',
      badgeClass: 'badge-operational',
      dotClass: 'dot-op',
      color: '#059669'
    },
    degraded: {
      label: 'Degraded Performance',
      badgeClass: 'badge-degraded',
      dotClass: 'dot-deg',
      color: '#d97706'
    },
    partial_outage: {
      label: 'Partial Outage',
      badgeClass: 'badge-partial',
      dotClass: 'dot-part',
      color: '#ea580c'
    },
    major_outage: {
      label: 'Major Outage',
      badgeClass: 'badge-outage',
      dotClass: 'dot-out',
      color: '#dc2626'
    },
    maintenance: {
      label: 'Maintenance',
      badgeClass: 'badge-maintenance',
      dotClass: 'dot-maint',
      color: '#475569'
    }
  };

  // 8 Core SDTracker Services
  const defaultServices = [
    {
      id: 'web',
      name: 'Web Application',
      category: 'Frontend SPA',
      desc: 'Core responsive CRM UI portal & assets',
      status: 'operational',
      latencyMs: 14
    },
    {
      id: 'auth',
      name: 'Authentication',
      category: 'Identity & RBAC',
      desc: 'User login, MFA & session tokens',
      status: 'operational',
      latencyMs: 22
    },
    {
      id: 'database',
      name: 'Database',
      category: 'PostgreSQL Store',
      desc: 'Supabase relational pool & queries',
      status: 'operational',
      latencyMs: 18
    },
    {
      id: 'api',
      name: 'API Services',
      category: 'REST Gateway',
      desc: 'Express REST routes & webhooks',
      status: 'operational',
      latencyMs: 16
    },
    {
      id: 'files',
      name: 'File & Document Services',
      category: 'Storage & Media',
      desc: 'PDF generation & image assets',
      status: 'operational',
      latencyMs: 25
    },
    {
      id: 'notifications',
      name: 'Notifications',
      category: 'Messaging Queue',
      desc: 'Email alerts & emergency P1 escalations',
      status: 'operational',
      latencyMs: 28
    },
    {
      id: 'reporting',
      name: 'Reporting',
      category: 'Analytics Engine',
      desc: 'KPI aggregation & council exports',
      status: 'operational',
      latencyMs: 24
    },
    {
      id: 'background',
      name: 'Background Jobs',
      category: 'SLA Schedulers',
      desc: 'Health monitors & maintenance cron',
      status: 'operational',
      latencyMs: 12
    }
  ];

  // 5 Real-Time Core Pillars (Backend, Frontend, APIs, DBs, Flows)
  const defaultPillars = {
    backend: { name: 'Backend Runtime', icon: '🖥️', status: 'operational', latency: '15ms', note: 'Node.js & Event Loop Healthy' },
    frontend: { name: 'Frontend Client', icon: '🌐', status: 'operational', latency: '12ms', note: 'SPA Assets Verified' },
    api: { name: 'API Services', icon: '⚡', status: 'operational', latency: '16ms', note: 'REST Endpoints Responsive' },
    database: { name: 'Database (DBs)', icon: '🗄️', status: 'operational', latency: '18ms', note: 'PostgreSQL Pool Connected' },
    flows: { name: 'Flows & Workers', icon: '🔄', status: 'operational', latency: 'Active', note: 'Background Jobs & Schedulers' }
  };

  const pastIncidentsArchive = [
    {
      id: 'inc-past-01',
      date: '12 September 2026',
      title: 'Database performance degradation',
      impact: 'Some users experienced slower response times on tenant lists.',
      service: 'Database',
      status: 'Resolved',
      duration: '10:42 – 11:45 BST',
      timeline: [
        { time: '11:45 BST', status: 'Resolved', message: 'Connection pool optimized on primary replica. Latency < 40ms.' },
        { time: '11:25 BST', status: 'Monitoring', message: 'Read-replica query limits deployed; connection recovery observed.' },
        { time: '11:05 BST', status: 'Identified', message: 'CPU contention identified on report join queries.' },
        { time: '10:42 BST', status: 'Investigating', message: 'Engineers alerted to elevated query response times.' }
      ]
    },
    {
      id: 'inc-past-02',
      date: '05 September 2026',
      title: 'API service interruption',
      impact: 'Transient 503 errors observed on mobile upload requests.',
      service: 'API Services',
      status: 'Resolved',
      duration: '14:12 – 14:38 BST',
      timeline: [
        { time: '14:38 BST', status: 'Resolved', message: 'Route tables stabilized and gateway reloaded.' },
        { time: '14:24 BST', status: 'Monitoring', message: 'Traffic rerouted through secondary load balancer.' },
        { time: '14:12 BST', status: 'Investigating', message: 'Elevated 5xx rate detected on upstream gateway.' }
      ]
    },
    {
      id: 'inc-past-03',
      date: '28 August 2026',
      title: 'Scheduled infrastructure maintenance',
      impact: 'Brief 3-minute read-only window during schema migration.',
      service: 'Database',
      status: 'Completed',
      duration: '22:00 – 22:30 BST',
      timeline: [
        { time: '22:30 BST', status: 'Completed', message: 'Database point upgrade to 16.4 verified.' },
        { time: '22:00 BST', status: 'In Progress', message: 'Scheduled maintenance window initiated.' }
      ]
    }
  ];

  const defaultMaintenance = [
    {
      id: 'maint-01',
      title: 'SDTracker Database Engine Optimization',
      service: 'Database',
      date: '20 September 2026',
      timeWindow: '22:00 – 23:00 BST',
      active: false,
      impact: 'Brief read-only modes may occur during replica sync.'
    }
  ];

  function generate90DayUptime() {
    const days = [];
    const now = new Date(2026, 8, 12);

    for (let i = 89; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      let status = 'operational';
      let uptime = 100.0;
      let notes = '100% operational — No incidents recorded';

      if (i === 15) {
        status = 'maintenance';
        uptime = 99.85;
        notes = 'Scheduled maintenance (22:00–22:30 BST)';
      } else if (i === 7) {
        status = 'degraded';
        uptime = 99.42;
        notes = 'API service interruption (26m duration)';
      }

      days.push({
        date: dateStr,
        status,
        uptime,
        notes
      });
    }
    return days;
  }

  // Reactive Application State
  const AppState = {
    services: JSON.parse(JSON.stringify(defaultServices)),
    pillars: JSON.parse(JSON.stringify(defaultPillars)),
    currentIncidents: [],
    pastIncidents: pastIncidentsArchive,
    maintenance: JSON.parse(JSON.stringify(defaultMaintenance)),
    uptimeStats: {
      today: '100%',
      sevenDays: '99.98%',
      thirtyDays: '99.95%',
      ninetyDays: '99.97%'
    },
    uptimeHistory: generate90DayUptime(),
    lastUpdated: new Date(),
    isLiveConnected: false,
    activeTab: 'tab-incidents',
    lastProbeMs: 16
  };

  // =========================================================================
  // 2. Real-Time Status Engine & Failure Watchdog
  // =========================================================================

  /**
   * Evaluates overall status deterministically with instant failure priority
   */
  function calculateOverallStatus(services, maintenance) {
    const hasMajor = services.some(s => s.status === 'major_outage');
    if (hasMajor) {
      return {
        key: 'major_outage',
        title: 'Major System Outage',
        subtext: 'Critical disruption detected. Rapid mitigation in progress.',
        cssClass: 'state-outage'
      };
    }

    const hasPartial = services.some(s => s.status === 'partial_outage');
    if (hasPartial) {
      return {
        key: 'partial_outage',
        title: 'Partial System Outage',
        subtext: 'Some service components are currently unavailable.',
        cssClass: 'state-partial'
      };
    }

    const hasDegraded = services.some(s => s.status === 'degraded');
    if (hasDegraded) {
      return {
        key: 'degraded',
        title: 'Partial System Degradation',
        subtext: 'Elevated latency or degraded performance observed.',
        cssClass: 'state-degraded'
      };
    }

    const hasActiveMaintenance = maintenance && maintenance.some(m => m.active);
    if (hasActiveMaintenance) {
      return {
        key: 'maintenance',
        title: 'Under Maintenance',
        subtext: 'Scheduled system maintenance is currently in progress.',
        cssClass: 'state-maintenance'
      };
    }

    return {
      key: 'operational',
      title: 'All Systems Operational',
      subtext: 'Operating normally across all municipal properties and tenant workflows.',
      cssClass: 'state-operational'
    };
  }

  /**
   * Synchronizes 5-pillar telemetry with component statuses
   */
  function syncPillars() {
    // 1. Backend
    const webSvc = AppState.services.find(s => s.id === 'web');
    AppState.pillars.backend.status = webSvc?.status === 'major_outage' ? 'outage' : (webSvc?.status === 'degraded' ? 'degraded' : 'operational');
    AppState.pillars.backend.latency = `${webSvc?.latencyMs || 15}ms`;

    // 2. Frontend
    AppState.pillars.frontend.status = (webSvc?.status === 'major_outage') ? 'outage' : 'operational';

    // 3. APIs
    const apiSvc = AppState.services.find(s => s.id === 'api');
    AppState.pillars.api.status = apiSvc?.status === 'major_outage' ? 'outage' : (apiSvc?.status === 'partial_outage' || apiSvc?.status === 'degraded' ? 'degraded' : 'operational');
    AppState.pillars.api.latency = `${apiSvc?.latencyMs || 18}ms`;

    // 4. DBs
    const dbSvc = AppState.services.find(s => s.id === 'database');
    AppState.pillars.database.status = dbSvc?.status === 'major_outage' ? 'outage' : (dbSvc?.status === 'degraded' ? 'degraded' : 'operational');
    AppState.pillars.database.latency = `${dbSvc?.latencyMs || 16}ms`;

    // 5. Flows & Workers
    const bgSvc = AppState.services.find(s => s.id === 'background');
    const notifSvc = AppState.services.find(s => s.id === 'notifications');
    const flowDown = bgSvc?.status !== 'operational' || notifSvc?.status !== 'operational';
    AppState.pillars.flows.status = flowDown ? 'degraded' : 'operational';
  }

  /**
   * Real-time probe against live server
   */
  async function performRealtimeCheck() {
    const started = performance.now();
    if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
      try {
        const response = await fetch('/api/status?live=1', {
          cache: 'no-store',
          signal: AbortSignal.timeout(4000)
        });

        const elapsed = Math.round(performance.now() - started);
        AppState.lastProbeMs = elapsed;

        if (response.ok) {
          const remote = await response.json();
          AppState.isLiveConnected = true;

          if (remote && Array.isArray(remote.services)) {
            remote.services.forEach(rs => {
              const local = AppState.services.find(s => s.id === rs.id);
              if (local) {
                let st = rs.status;
                if (st === 'degraded_performance') st = 'degraded';
                local.status = st;
                if (rs.latencyMs !== null && rs.latencyMs !== undefined) {
                  local.latencyMs = rs.latencyMs;
                }
                if (rs.message) local.desc = rs.message;
              }
            });

            // Map live incidents if reported by server
            if (remote.incidents && Array.isArray(remote.incidents.active) && remote.incidents.active.length > 0) {
              AppState.currentIncidents = remote.incidents.active.map(inc => ({
                id: inc.id,
                title: inc.title,
                service: (inc.serviceIds && inc.serviceIds.join(', ')) || 'Core',
                currentStatus: inc.status || 'Investigating',
                badgeType: inc.impact === 'major_outage' ? 'outage' : 'degraded',
                description: inc.description || 'Service disruption identified.',
                startedTime: formatBST(new Date(inc.startedAt)),
                timeline: (inc.updates || []).map(u => ({
                  time: formatBST(new Date(u.at)),
                  status: u.status,
                  message: u.message
                }))
              }));
            }
          }
          AppState.lastUpdated = new Date();
        } else {
          // Non-200 response -> IMMEDIATE STATUS IMPACT
          triggerImmediateOutage(`Server API returned HTTP ${response.status}`);
        }
      } catch (err) {
        // Network failure / Server down -> IMMEDIATE OUTAGE IMPACT
        triggerImmediateOutage(`Connection failure: ${err?.message || 'Server unreachable'}`);
      }
    } else {
      // Offline / File Protocol mode: Keep active state with simulated probe
      AppState.isLiveConnected = false;
      AppState.lastUpdated = new Date();
    }

    syncPillars();
    renderAll();
  }

  /**
   * Instantly trips the status page on any process/network fault
   */
  function triggerImmediateOutage(reason) {
    AppState.isLiveConnected = false;
    const nowStr = formatBST(new Date());

    // Mark API & Web down
    AppState.services.forEach(s => {
      if (s.id === 'api' || s.id === 'web') s.status = 'major_outage';
      else if (s.status === 'operational') s.status = 'degraded';
    });

    // Auto-create active incident if not already present
    const existing = AppState.currentIncidents.find(i => i.id === 'inc-live-conn-err');
    if (!existing) {
      AppState.currentIncidents.unshift({
        id: 'inc-live-conn-err',
        title: 'Backend Process Disruption',
        service: 'API & Web Server',
        currentStatus: 'Investigating',
        badgeType: 'outage',
        description: `Immediate watchdog detected process failure: ${reason}. Automated diagnostics engaged.`,
        startedTime: nowStr,
        timeline: [
          { time: nowStr, status: 'Investigating', message: `Realtime health watchdog tripped: ${reason}` }
        ]
      });
    }

    syncPillars();
    renderAll();
  }

  // Global browser error listeners to capture frontend runtime exceptions
  window.addEventListener('error', (event) => {
    const web = AppState.services.find(s => s.id === 'web');
    if (web && web.status === 'operational') {
      web.status = 'degraded';
      web.desc = `Client exception: ${event.message?.slice(0, 50)}`;
      syncPillars();
      renderAll();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const api = AppState.services.find(s => s.id === 'api');
    if (api && api.status === 'operational') {
      api.status = 'degraded';
      api.desc = `Unhandled promise rejection in API flow`;
      syncPillars();
      renderAll();
    }
  });

  // =========================================================================
  // 3. UI Rendering & DOM Updates
  // =========================================================================

  function formatBST(dateObj) {
    const d = dateObj || new Date();
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    return `${day} ${month} ${hours}:${mins}:${secs} BST`;
  }

  function renderOverallBanner() {
    const banner = document.getElementById('main-status-banner');
    const headline = document.getElementById('banner-headline');
    const subtext = document.getElementById('banner-subtext');
    const timestampEl = document.getElementById('last-updated-timestamp');
    const latencyEl = document.getElementById('banner-latency-value');
    const livePill = document.getElementById('live-connection-badge');

    if (!banner || !headline) return;

    const overall = calculateOverallStatus(AppState.services, AppState.maintenance);
    banner.className = `main-status-banner ${overall.cssClass}`;
    headline.textContent = overall.title;
    subtext.textContent = overall.subtext;

    if (timestampEl) timestampEl.textContent = formatBST(AppState.lastUpdated);
    if (latencyEl) latencyEl.textContent = `${AppState.lastProbeMs} ms`;

    if (livePill) {
      if (AppState.isLiveConnected) {
        livePill.innerHTML = `<span class="live-dot" aria-hidden="true"></span><span>Live (3s)</span>`;
      } else {
        livePill.innerHTML = `<span class="live-dot" style="background:#38bdf8;" aria-hidden="true"></span><span>Realtime Active</span>`;
      }
    }

    // Accessible screen reader announcement
    const liveAnnouncer = document.getElementById('status-live-announcer');
    if (liveAnnouncer) {
      liveAnnouncer.textContent = `Status: ${overall.title}. ${overall.subtext}`;
    }
  }

  function renderTelemetryStrip() {
    const container = document.getElementById('telemetry-strip-container');
    if (!container) return;

    const pillars = [
      AppState.pillars.backend,
      AppState.pillars.frontend,
      AppState.pillars.api,
      AppState.pillars.database,
      AppState.pillars.flows
    ];

    container.innerHTML = pillars.map(p => `
      <div class="pillar-chip" title="${escapeHtml(p.note)}">
        <div class="pillar-info">
          <span class="pillar-icon">${p.icon}</span>
          <span class="pillar-name">${escapeHtml(p.name)}</span>
        </div>
        <span class="pillar-status-pill ${p.status}">
          ● ${p.status === 'operational' ? p.latency : (p.status === 'outage' ? 'Down' : 'Degraded')}
        </span>
      </div>
    `).join('');
  }

  function renderServicesGrid() {
    const container = document.getElementById('services-list-container');
    if (!container) return;

    container.innerHTML = AppState.services.map(service => {
      const def = STATUS_DEFINITIONS[service.status] || STATUS_DEFINITIONS.operational;
      return `
        <div class="service-row" data-service-id="${service.id}">
          <div class="service-info">
            <div class="service-name-wrap">
              <span class="service-name">${escapeHtml(service.name)}</span>
            </div>
            <span class="service-desc">${escapeHtml(service.desc)}</span>
          </div>
          <div class="service-meta-right">
            <span class="service-latency">${service.latencyMs || 15}ms</span>
            <div class="service-badge ${def.badgeClass}" role="status" aria-label="${service.name}: ${def.label}">
              <span class="service-badge-dot"></span>
              <span>${def.label}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderCurrentIncidents() {
    const container = document.getElementById('current-incidents-container');
    const tabBadge = document.getElementById('tab-incidents-count');
    if (!container) return;

    const count = AppState.currentIncidents.length;
    if (tabBadge) tabBadge.textContent = String(count);

    if (count === 0) {
      container.innerHTML = `
        <div class="no-incidents-box">
          <div class="no-incidents-icon" aria-hidden="true">✓</div>
          <div>
            <div class="no-incidents-title">No incidents reported</div>
            <div class="no-incidents-sub">All SDTracker backend, frontend, API and database services are operating normally.</div>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = AppState.currentIncidents.map(inc => {
      const timelineHtml = inc.timeline.map((step, sIdx) => `
        <div class="timeline-step ${sIdx === 0 ? 'active' : ''}">
          <div class="timeline-dot" aria-hidden="true"></div>
          <div class="timeline-header">
            <span class="timeline-status">${escapeHtml(step.status)}</span>
            <span class="timeline-time">${escapeHtml(step.time)}</span>
          </div>
          <div class="timeline-message">${escapeHtml(step.message)}</div>
        </div>
      `).join('');

      return `
        <div class="incident-card">
          <div class="incident-header">
            <div>
              <h3 class="incident-title">${escapeHtml(inc.title)}</h3>
              <div class="incident-meta">
                <span class="incident-service-tag">${escapeHtml(inc.service)}</span>
                <span>Started: ${escapeHtml(inc.startedTime)}</span>
              </div>
            </div>
            <div class="service-badge badge-${inc.badgeType || 'degraded'}">
              <span class="service-badge-dot"></span>
              <span>${escapeHtml(inc.currentStatus)}</span>
            </div>
          </div>
          <div class="incident-body">
            <p class="incident-description">${escapeHtml(inc.description)}</p>
            <div class="incident-timeline">${timelineHtml}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderUptimeSection() {
    const statToday = document.getElementById('uptime-today');
    const stat7 = document.getElementById('uptime-7d');
    const stat30 = document.getElementById('uptime-30d');
    const stat90 = document.getElementById('uptime-90d');

    if (statToday) statToday.textContent = AppState.uptimeStats.today;
    if (stat7) stat7.textContent = AppState.uptimeStats.sevenDays;
    if (stat30) stat30.textContent = AppState.uptimeStats.thirtyDays;
    if (stat90) stat90.textContent = AppState.uptimeStats.ninetyDays;

    const barsContainer = document.getElementById('uptime-bars-container');
    const tooltip = document.getElementById('uptime-tooltip');
    if (!barsContainer) return;

    barsContainer.innerHTML = AppState.uptimeHistory.map((day, idx) => {
      let barClass = '';
      if (day.status === 'degraded') barClass = 'bar-degraded';
      else if (day.status === 'partial_outage' || day.status === 'major_outage') barClass = 'bar-outage';
      else if (day.status === 'maintenance') barClass = 'bar-maintenance';

      return `
        <button
          type="button"
          class="uptime-day-bar ${barClass}"
          data-index="${idx}"
          aria-label="${day.date}: ${day.uptime}% uptime. ${day.notes}"
        ></button>
      `;
    }).join('');

    barsContainer.querySelectorAll('.uptime-day-bar').forEach(bar => {
      function showTooltip() {
        const idx = parseInt(bar.getAttribute('data-index'), 10);
        const data = AppState.uptimeHistory[idx];
        if (!data || !tooltip) return;

        tooltip.innerHTML = `<strong>${data.date}</strong><br/>${data.uptime}% uptime &bull; ${escapeHtml(data.notes)}`;
        const barRect = bar.getBoundingClientRect();
        const containerRect = barsContainer.getBoundingClientRect();
        const leftOffset = barRect.left - containerRect.left + (barRect.width / 2);
        tooltip.style.left = `${leftOffset}px`;
        tooltip.classList.add('visible');
      }

      function hideTooltip() {
        if (tooltip) tooltip.classList.remove('visible');
      }

      bar.addEventListener('mouseenter', showTooltip);
      bar.addEventListener('focus', showTooltip);
      bar.addEventListener('mouseleave', hideTooltip);
      bar.addEventListener('blur', hideTooltip);
    });
  }

  function renderPastIncidents() {
    const container = document.getElementById('past-incidents-container');
    if (!container) return;

    container.innerHTML = AppState.pastIncidents.map(inc => {
      const timelineHtml = inc.timeline.map(step => `
        <div class="timeline-step">
          <div class="timeline-dot" aria-hidden="true"></div>
          <div class="timeline-header">
            <span class="timeline-status">${escapeHtml(step.status)}</span>
            <span class="timeline-time">${escapeHtml(step.time)}</span>
          </div>
          <div class="timeline-message">${escapeHtml(step.message)}</div>
        </div>
      `).join('');

      return `
        <div class="past-incident-group">
          <span class="past-date-heading">${escapeHtml(inc.date)}</span>
          <div class="past-incident-item" id="accordion-${inc.id}">
            <div
              class="past-incident-summary"
              role="button"
              tabindex="0"
              aria-expanded="false"
              onclick="window.togglePastIncident('${inc.id}')"
              onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.togglePastIncident('${inc.id}'); }"
            >
              <div>
                <span class="past-incident-title">${escapeHtml(inc.title)}</span>
                <span class="past-incident-time">&bull; ${escapeHtml(inc.duration)}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="past-status-pill">${escapeHtml(inc.status)}</span>
                <svg class="past-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
            <div class="past-incident-details" id="details-${inc.id}">
              <p style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 12px;">${escapeHtml(inc.impact)}</p>
              <div class="incident-timeline">${timelineHtml}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderMaintenanceSection() {
    const container = document.getElementById('maintenance-container');
    const tabBadge = document.getElementById('tab-maint-count');
    if (!container) return;

    const scheduled = AppState.maintenance;
    if (tabBadge) tabBadge.textContent = String(scheduled.length);

    if (!scheduled || scheduled.length === 0) {
      container.innerHTML = `
        <div class="no-incidents-box">
          <div class="no-incidents-icon" style="color: var(--text-muted); background: var(--bg-surface-subtle); border-color: var(--border-color);" aria-hidden="true">📅</div>
          <div>
            <div class="no-incidents-title">No planned maintenance</div>
            <div class="no-incidents-sub">There are currently no scheduled maintenance activities.</div>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = scheduled.map(m => `
      <div class="maintenance-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="maintenance-title">${escapeHtml(m.title)}</span>
          <span class="maintenance-badge">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--status-maintenance);"></span>
            ${m.active ? 'Maintenance in Progress' : 'Scheduled'}
          </span>
        </div>
        <div class="maintenance-grid">
          <div><div class="maint-field-label">Component</div><div class="maint-field-val">${escapeHtml(m.service)}</div></div>
          <div><div class="maint-field-label">Date</div><div class="maint-field-val">${escapeHtml(m.date)}</div></div>
          <div><div class="maint-field-label">Window</div><div class="maint-field-val">${escapeHtml(m.timeWindow)}</div></div>
        </div>
        <div class="maint-impact-box"><strong>Expected Impact:</strong> ${escapeHtml(m.impact)}</div>
      </div>
    `).join('');
  }

  function renderAll() {
    renderOverallBanner();
    renderTelemetryStrip();
    renderServicesGrid();
    renderCurrentIncidents();
    renderUptimeSection();
    renderPastIncidents();
    renderMaintenanceSection();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================================
  // 4. Global Tab & Event Actions
  // =========================================================================

  window.switchDetailTab = function (tabId) {
    AppState.activeTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-content-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId);
    });
  };

  window.togglePastIncident = function (id) {
    const item = document.getElementById(`accordion-${id}`);
    if (!item) return;
    const isCurrentlyOpen = item.classList.contains('open');
    item.classList.toggle('open', !isCurrentlyOpen);
  };

  window.refreshStatus = async function () {
    const btn = document.getElementById('btn-refresh-status');
    if (btn) btn.disabled = true;
    await performRealtimeCheck();
    if (btn) setTimeout(() => { btn.disabled = false; }, 400);
  };

  function setupSubscription() {
    const form = document.getElementById('subscribe-form');
    const input = document.getElementById('subscribe-email');
    const feedback = document.getElementById('subscribe-feedback');

    if (!form || !input || !feedback) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const email = input.value.trim();
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

      if (!email || !emailRegex.test(email)) {
        feedback.className = 'subscribe-feedback error';
        feedback.textContent = 'Please provide a valid corporate email address.';
        input.focus();
        return;
      }

      feedback.className = 'subscribe-feedback success';
      feedback.innerHTML = `✓ Subscribed: Notifications for ${escapeHtml(email)} activated. [Demo Mode: Stored locally]`;
      input.value = '';
    });
  }

  window.toggleDemoModal = function (open) {
    const modal = document.getElementById('demo-modal-overlay');
    if (!modal) return;
    modal.classList.toggle('open', open);
  };

  // Immediate Simulation Presets
  window.demoSimulate = function (scenario) {
    const nowStr = formatBST(new Date());

    switch (scenario) {
      case 'all_operational':
        AppState.services.forEach(s => {
          s.status = 'operational';
          s.desc = defaultServices.find(d => d.id === s.id)?.desc || 'Operating normally';
        });
        AppState.currentIncidents = [];
        AppState.maintenance.forEach(m => m.active = false);
        break;

      case 'degraded_database':
        AppState.services.forEach(s => {
          if (s.id === 'database') {
            s.status = 'degraded';
            s.desc = 'Connection lock contention on reader replica';
          } else {
            s.status = 'operational';
          }
        });
        AppState.maintenance.forEach(m => m.active = false);
        AppState.currentIncidents = [
          {
            id: 'inc-demo-db',
            title: 'Database performance degradation',
            service: 'Database',
            currentStatus: 'Investigating',
            badgeType: 'degraded',
            description: 'Some users may experience slower than normal response times when querying tenant lists.',
            startedTime: nowStr,
            timeline: [
              { time: '11:05 BST', status: 'Identified', message: 'Connection pool lock contention detected on primary node.' },
              { time: '10:42 BST', status: 'Investigating', message: 'Engineers are investigating elevated read/write query latency.' }
            ]
          }
        ];
        break;

      case 'api_partial_outage':
        AppState.services.forEach(s => {
          if (s.id === 'api') {
            s.status = 'partial_outage';
            s.desc = 'Transient 503 gateway timeouts';
          } else {
            s.status = 'operational';
          }
        });
        AppState.maintenance.forEach(m => m.active = false);
        AppState.currentIncidents = [
          {
            id: 'inc-demo-api',
            title: 'API service interruption',
            service: 'API Services',
            currentStatus: 'Identified',
            badgeType: 'partial',
            description: 'REST API requests to sync endpoints are returning transient 502/503 gateway errors.',
            startedTime: nowStr,
            timeline: [
              { time: '14:24 BST', status: 'Identified', message: 'Route table inconsistency identified in upstream gateway cluster.' },
              { time: '14:12 BST', status: 'Investigating', message: 'Automated monitoring triggered alerts for elevated 5xx error rates.' }
            ]
          }
        ];
        break;

      case 'major_outage':
        AppState.services.forEach(s => {
          if (s.id === 'database' || s.id === 'web') {
            s.status = 'major_outage';
            s.desc = 'Connection dropped or unreachable';
          } else if (s.id === 'api') {
            s.status = 'partial_outage';
          } else {
            s.status = 'degraded';
          }
        });
        AppState.maintenance.forEach(m => m.active = false);
        AppState.currentIncidents = [
          {
            id: 'inc-demo-major',
            title: 'Critical Platform Outage',
            service: 'Core Platform & Database',
            currentStatus: 'Investigating',
            badgeType: 'outage',
            description: 'SDTracker WebCRM portal and core database are currently unreachable for multiple sites. Major incident response activated.',
            startedTime: nowStr,
            timeline: [
              { time: '16:02 BST', status: 'Investigating', message: 'All available engineering and infrastructure teams are engaged.' }
            ]
          }
        ];
        break;

      case 'maintenance':
        AppState.services.forEach(s => s.status = 'operational');
        AppState.currentIncidents = [];
        AppState.maintenance.forEach(m => m.active = true);
        break;

      case 'clear_incidents':
        AppState.currentIncidents = [];
        break;
    }

    AppState.lastUpdated = new Date();
    syncPillars();
    renderAll();
    window.toggleDemoModal(false);
  };

  // =========================================================================
  // 5. Lifecycle Initialization & Real-Time Polling Loop
  // =========================================================================

  document.addEventListener('DOMContentLoaded', () => {
    syncPillars();
    renderAll();
    setupSubscription();

    // Run first live probe immediately
    performRealtimeCheck();

    // Aggressive Real-Time Polling: every 3.5 seconds
    setInterval(performRealtimeCheck, 3500);
  });

})();
