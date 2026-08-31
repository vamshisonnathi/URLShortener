/**
 * @file Web Application User Interface Route Handler
 * @description Serves the interactive Single-Page Application (SPA) for link shortening and analytics inspection at `GET /`.
 * @module routes/ui
 */

import type { FastifyInstance } from 'fastify';

/** HTML, CSS, and client-side JavaScript content for the Web UI. */
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>URL Shortener | Enterprise Link Management & Analytics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --text-subtle: #94a3b8;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --primary-light: #eff6ff;
      --border: #e2e8f0;
      --border-focus: #93c5fd;
      --success-bg: #f0fdf4;
      --success-text: #15803d;
      --success-border: #bbf7d0;
      --error-bg: #fef2f2;
      --error-text: #b91c1c;
      --error-border: #fecaca;
      --radius: 10px;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      line-height: 1.5;
      padding: 0;
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top Navigation Bar */
    .navbar {
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 700;
      font-size: 1.125rem;
      color: var(--text-main);
      text-decoration: none;
    }

    .brand-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 800;
      font-size: 1.1rem;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--success-bg);
      color: var(--success-text);
      border: 1px solid var(--success-border);
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #22c55e;
    }

    /* Main Container */
    .main-container {
      width: 100%;
      max-width: 800px;
      margin: 2.5rem auto;
      padding: 0 1.5rem;
    }

    .hero {
      text-align: center;
      margin-bottom: 2.5rem;
    }

    .hero h1 {
      font-size: 2.25rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--text-main);
      margin-bottom: 0.5rem;
    }

    .hero p {
      color: var(--text-muted);
      font-size: 1.05rem;
      max-width: 540px;
      margin: 0 auto;
    }

    /* Card Component */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: var(--shadow);
    }

    .card-title {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Form Inputs */
    .form-group {
      margin-bottom: 1.25rem;
    }

    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.4rem;
      color: var(--text-main);
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-icon {
      position: absolute;
      left: 1rem;
      color: var(--text-subtle);
      pointer-events: none;
    }

    input[type="url"],
    input[type="text"],
    input[type="datetime-local"] {
      width: 100%;
      padding: 0.75rem 1rem 0.75rem 2.5rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #ffffff;
      color: var(--text-main);
      font-size: 0.95rem;
      font-family: inherit;
      transition: all 0.15s ease;
    }

    input.no-icon {
      padding-left: 1rem;
    }

    input::placeholder {
      color: var(--text-subtle);
    }

    input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 640px) {
      .form-row { grid-template-columns: 1fr; }
    }

    .alias-preview {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.35rem;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.8rem 1.5rem;
      border-radius: 8px;
      border: 1px solid transparent;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .btn-primary {
      background: var(--primary);
      color: #ffffff;
      width: 100%;
    }

    .btn-primary:hover {
      background: var(--primary-hover);
    }

    .btn-secondary {
      background: #ffffff;
      color: var(--text-main);
      border-color: var(--border);
    }

    .btn-secondary:hover {
      background: var(--bg);
    }

    .btn-sm {
      padding: 0.5rem 0.9rem;
      font-size: 0.85rem;
    }

    /* Alerts & Results */
    .alert {
      padding: 0.85rem 1rem;
      border-radius: 8px;
      margin-top: 1.25rem;
      font-size: 0.875rem;
      font-weight: 500;
      display: none;
    }

    .alert-error {
      background: var(--error-bg);
      color: var(--error-text);
      border: 1px solid var(--error-border);
    }

    .result-box {
      margin-top: 1.5rem;
      padding: 1.25rem;
      background: var(--primary-light);
      border-radius: 8px;
      border: 1px solid #bfdbfe;
      display: none;
    }

    .result-header {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary);
      margin-bottom: 0.5rem;
    }

    .result-controls {
      display: flex;
      gap: 0.5rem;
    }

    .result-controls input {
      flex: 1;
      font-weight: 600;
      color: var(--primary);
      background: #ffffff;
    }

    /* Analytics Section */
    .quick-sample-pills {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .sample-pill {
      background: #f1f5f9;
      border: 1px solid var(--border);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      cursor: pointer;
      color: var(--primary);
      font-weight: 600;
    }

    .sample-pill:hover {
      background: var(--primary-light);
    }

    .stats-overview {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin: 1.5rem 0;
    }

    .metric-card {
      background: #f8fafc;
      border: 1px solid var(--border);
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
    }

    .metric-num {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text-main);
    }

    .metric-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-top: 0.2rem;
    }

    .tab-bar {
      display: flex;
      border-bottom: 1px solid var(--border);
      margin-bottom: 1rem;
    }

    .tab-item {
      padding: 0.75rem 1.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-muted);
      border: none;
      background: none;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.15s ease;
    }

    .tab-item.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    th {
      text-align: left;
      padding: 0.6rem 0.75rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }

    td {
      padding: 0.75rem;
      border-bottom: 1px solid var(--border);
      color: var(--text-main);
    }

    tr:last-child td {
      border-bottom: none;
    }

    footer {
      text-align: center;
      margin-top: auto;
      padding: 2rem 0;
      color: var(--text-muted);
      font-size: 0.85rem;
      border-top: 1px solid var(--border);
      background: #ffffff;
    }
  </style>
</head>
<body>

  <!-- Top Navbar -->
  <nav class="navbar">
    <a href="#" class="brand">
      <div class="brand-icon">⚡</div>
      <span>LinkPulse</span>
    </a>
    <div class="status-badge">
      <span class="status-dot"></span> System Operational
    </div>
  </nav>

  <main class="main-container">
    <!-- Hero Header -->
    <header class="hero">
      <h1>Enterprise URL Shortener</h1>
      <p>Transform long URLs into clean, tracked links with high-reliability analytics.</p>
    </header>

    <!-- Create Short Link Card -->
    <section class="card">
      <div class="card-title">
        <span>Create Short URL</span>
      </div>

      <form id="shorten-form">
        <div class="form-group">
          <label for="url">Destination URL *</label>
          <div class="input-wrapper">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            <input type="url" id="url" name="url" placeholder="https://example.com/analytics/dashboard/report-2026" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="customAlias">Custom Alias (Optional)</label>
            <div class="input-wrapper">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
              <input type="text" id="customAlias" name="customAlias" placeholder="e.g. launch-2026" pattern="[A-Za-z0-9_-]{3,32}" title="3-32 characters (letters, numbers, hyphens, underscores)" />
            </div>
            <div id="alias-preview" class="alias-preview">Short URL: http://localhost:3000/<span id="alias-preview-code">random</span></div>
          </div>

          <div class="form-group">
            <label for="expiresAt">Expiration Date (Optional)</label>
            <div class="input-wrapper">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <input type="datetime-local" id="expiresAt" name="expiresAt" />
            </div>
          </div>
        </div>

        <button type="submit" id="submit-btn" class="btn btn-primary">
          <span>Shorten URL</span>
        </button>
      </form>

      <div id="error-alert" class="alert alert-error"></div>

      <!-- Result Card -->
      <div id="result-box" class="result-box">
        <div class="result-header">Short Link Created Successfully</div>
        <div class="result-controls">
          <input type="text" id="result-short-url" class="no-icon" readonly />
          <button type="button" id="copy-btn" class="btn btn-secondary btn-sm">Copy</button>
          <button type="button" id="visit-btn" class="btn btn-secondary btn-sm">Test 302</button>
        </div>
      </div>
    </section>

    <!-- Analytics Dashboard Card -->
    <section class="card">
      <div class="card-title">
        <span>Analytics Inspector</span>
      </div>

      <div class="form-group">
        <label for="analytics-code-input">Short Code</label>
        <div style="display: flex; gap: 0.5rem;">
          <input type="text" id="analytics-code-input" class="no-icon" placeholder="Enter code (e.g. demoGH1)" style="flex: 1;" />
          <button type="button" id="fetch-analytics-btn" class="btn btn-secondary btn-sm" style="width: auto;">Inspect</button>
        </div>
        <div class="quick-sample-pills">
          <span>Try seeded demos:</span>
          <span class="sample-pill" onclick="inspectCode('demoGH1')">demoGH1</span>
          <span class="sample-pill" onclick="inspectCode('launch')">launch</span>
        </div>
      </div>

      <div id="analytics-result" style="display: none;">
        <div class="stats-overview">
          <div class="metric-card">
            <div id="stat-total-clicks" class="metric-num">0</div>
            <div class="metric-label">Total Clicks</div>
          </div>
          <div class="metric-card">
            <div id="stat-top-referrer" class="metric-num" style="font-size: 1.1rem; line-height: 2rem;">Direct</div>
            <div class="metric-label">Top Referrer</div>
          </div>
          <div class="metric-card">
            <div id="stat-top-country" class="metric-num" style="font-size: 1.1rem; line-height: 2rem;">XX</div>
            <div class="metric-label">Top Country</div>
          </div>
        </div>

        <div class="tab-bar">
          <button type="button" class="tab-item active" onclick="switchTab('referrers', this)">Referrers</button>
          <button type="button" class="tab-item" onclick="switchTab('countries', this)">Countries</button>
          <button type="button" class="tab-item" onclick="switchTab('days', this)">Clicks by Day</button>
        </div>

        <div id="tab-referrers">
          <table id="table-referrers">
            <thead><tr><th>Referrer Domain</th><th>Clicks</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>

        <div id="tab-countries" style="display: none;">
          <table id="table-countries">
            <thead><tr><th>Country Code</th><th>Clicks</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>

        <div id="tab-days" style="display: none;">
          <table id="table-days">
            <thead><tr><th>Date</th><th>Clicks</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <div id="analytics-error" class="alert alert-error"></div>
    </section>
  </main>

  <footer>
    URL Shortener &copy; 2026 — Built with Node.js, Fastify, Prisma & Redis
  </footer>

  <script>
    const form = document.getElementById('shorten-form');
    const submitBtn = document.getElementById('submit-btn');
    const errorAlert = document.getElementById('error-alert');
    const resultBox = document.getElementById('result-box');
    const resultShortUrl = document.getElementById('result-short-url');
    const copyBtn = document.getElementById('copy-btn');
    const visitBtn = document.getElementById('visit-btn');
    const customAliasInput = document.getElementById('customAlias');
    const aliasPreviewCode = document.getElementById('alias-preview-code');

    // Live preview of alias
    customAliasInput.addEventListener('input', () => {
      const val = customAliasInput.value.trim();
      aliasPreviewCode.textContent = val || 'random';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorAlert.style.display = 'none';
      resultBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Creating Link...</span>';

      const payload = { url: document.getElementById('url').value.trim() };
      const alias = customAliasInput.value.trim();
      const expiresAt = document.getElementById('expiresAt').value;

      if (alias) payload.customAlias = alias;
      if (expiresAt) payload.expiresAt = new Date(expiresAt).toISOString();

      try {
        const res = await fetch('/api/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || data.error || 'Failed to create short URL');
        }

        resultShortUrl.value = data.shortUrl;
        resultBox.style.display = 'block';

        // Pre-fill analytics search code
        document.getElementById('analytics-code-input').value = data.shortCode;
      } catch (err) {
        errorAlert.textContent = err.message;
        errorAlert.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Shorten URL</span>';
      }
    });

    copyBtn.addEventListener('click', async () => {
      if (!resultShortUrl.value) return;
      await navigator.clipboard.writeText(resultShortUrl.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });

    visitBtn.addEventListener('click', () => {
      if (resultShortUrl.value) {
        window.open(resultShortUrl.value, '_blank');
      }
    });

    // Analytics search
    const fetchAnalyticsBtn = document.getElementById('fetch-analytics-btn');
    const analyticsCodeInput = document.getElementById('analytics-code-input');
    const analyticsResult = document.getElementById('analytics-result');
    const analyticsError = document.getElementById('analytics-error');

    fetchAnalyticsBtn.addEventListener('click', () => {
      const code = analyticsCodeInput.value.trim();
      if (code) loadAnalytics(code);
    });

    function inspectCode(code) {
      analyticsCodeInput.value = code;
      loadAnalytics(code);
    }

    async function loadAnalytics(code) {
      analyticsError.style.display = 'none';
      analyticsResult.style.display = 'none';

      try {
        const res = await fetch('/api/analytics/' + encodeURIComponent(code));
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'Analytics not found for code: ' + code);
        }

        document.getElementById('stat-total-clicks').textContent = data.totalClicks;
        document.getElementById('stat-top-referrer').textContent = data.topReferrers && data.topReferrers[0] ? (data.topReferrers[0].referrer || 'Direct') : 'Direct';
        document.getElementById('stat-top-country').textContent = data.topCountries && data.topCountries[0] ? data.topCountries[0].country : 'XX';

        populateTable('table-referrers', data.topReferrers, 'referrer', 'clicks');
        populateTable('table-countries', data.topCountries, 'country', 'clicks');
        populateTable('table-days', data.clicksByDay, 'day', 'clicks');

        analyticsResult.style.display = 'block';
      } catch (err) {
        analyticsError.textContent = err.message;
        analyticsError.style.display = 'block';
      }
    }

    function populateTable(tableId, items, keyName, valueName) {
      const tbody = document.getElementById(tableId).querySelector('tbody');
      tbody.innerHTML = '';
      if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="color: var(--text-muted); text-align: center;">No recorded data yet</td></tr>';
        return;
      }
      items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (item[keyName] || 'Direct / None') + '</td><td style="font-weight: 600;">' + item[valueName] + '</td>';
        tbody.appendChild(tr);
      });
    }

    function switchTab(tabName, el) {
      ['referrers', 'countries', 'days'].forEach(t => {
        document.getElementById('tab-' + t).style.display = t === tabName ? 'block' : 'none';
      });
      document.querySelectorAll('.tab-item').forEach(btn => btn.classList.remove('active'));
      el.classList.add('active');
    }
  </script>
</body>
</html>`;

/**
 * Registers Web UI HTTP endpoints on the Fastify instance.
 *
 * Route: `GET /`
 * - 200 OK: Serves the single-page HTML/CSS/JS application (`text/html`).
 *
 * @param app - The Fastify application instance.
 */
export async function uiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_request, reply) => {
    return reply.type('text/html').send(HTML_CONTENT);
  });
}
