const app = document.getElementById('app');
const hostingProviderOrder = ['netlify', 'githubPages', 'cloudflarePages'];
const hostingProviderLabels = {
  netlify: 'Netlify',
  githubPages: 'GitHub Pages',
  cloudflarePages: 'Cloudflare Pages',
};

function createEmptyHostingChecklist() {
  return {
    netlify: false,
    githubPages: false,
    cloudflarePages: false,
  };
}

const stepMeta = [
  { key: 'details', label: 'About the school', icon: 'fa-school' },
  { key: 'firebase', label: 'Connect Firebase', icon: 'fa-key' },
  { key: 'billing', label: 'Connect payments', icon: 'fa-credit-card' },
  { key: 'setup', label: 'Let me set it up', icon: 'fa-wand-magic-sparkles' },
  { key: 'final', label: 'Paste these final values', icon: 'fa-flag-checkered' },
];

const state = {
  loading: true,
  bootstrap: { defaults: { priceIds: {} }, schools: [] },
  mode: null,
  step: 0,
  form: {
    schoolLabel: '',
    projectId: '',
    renderUrl: '',
    siteDomain: '',
    readinessTarget: 'starter',
    firebaseLocation: 'europe-west1',
    serviceAccount: '',
    priceIds: {
      starter: '',
      pro: '',
      elite: '',
    },
  },
  serviceAccountSummary: null,
  setupResult: null,
  recheckSchoolId: '',
  recheckResult: null,
  manageSchoolId: '',
  manageSubscription: null,
  manageLoading: false,
  manageForm: {
    tier: 'pending',
    startsAt: '',
    endsAt: '',
    notes: '',
  },
  manageDeleteConfirm: '',
  manageSchoolSearch: '',
  manageHelpOpen: false,
  isRunning: false,
  renderPasted: false,
  hostingProvider: 'netlify',
  hostingCompleted: createEmptyHostingChecklist(),
  activity: null,
};

const taskIcons = {
  saveSchool: 'fa-book-open',
  copyKey: 'fa-key',
  bootstrapLogin: 'fa-user-shield',
  grantServiceUsageRoles: 'fa-id-badge',
  checkFirebase: 'fa-plug-circle-check',
  ensureAuth: 'fa-user-lock',
  enableEmailPassword: 'fa-envelope-open-text',
  authorizeSchoolDomain: 'fa-globe',
  enableApis: 'fa-toggle-on',
  ensureFirestore: 'fa-database',
  firestoreRules: 'fa-shield-halved',
  deployFirestoreRules: 'fa-shield',
  writePending: 'fa-lock',
  checkIndexes: 'fa-list-check',
  createIndexes: 'fa-hammer',
  storageRules: 'fa-box-archive',
  ensureStorage: 'fa-photo-film',
  deployStorageRules: 'fa-cloud-arrow-up',
  renderOutput: 'fa-cloud-arrow-up',
  hostingOutput: 'fa-globe',
  finalHealth: 'fa-heart-circle-check',
  savedSchool: 'fa-folder-open',
  subscriptionCheck: 'fa-receipt',
};

const manageTierMeta = {
  pending: {
    label: 'Pending',
    emoji: '⏳',
    tone: 'pending',
    blurb: 'School is locked until payment or grace access.',
  },
  starter: {
    label: 'Starter',
    emoji: '🌱',
    tone: 'starter',
    blurb: 'Core GCQ setup with lighter limits and no premium extras.',
  },
  pro: {
    label: 'Pro',
    emoji: '⚔️',
    tone: 'pro',
    blurb: 'Unlocks the richer classroom systems and larger school limits.',
  },
  elite: {
    label: 'Elite',
    emoji: '👑',
    tone: 'elite',
    blurb: 'Everything unlocked, including AI-powered features.',
  },
  expired: {
    label: 'Expired',
    emoji: '🔒',
    tone: 'expired',
    blurb: 'Access ends immediately until you grant a new plan.',
  },
  missing: {
    label: 'Missing',
    emoji: '❔',
    tone: 'pending',
    blurb: 'No saved subscription document was found yet.',
  },
};

function getHostingTargets(outputs) {
  const targets = outputs?.hostingTargets || {};
  return hostingProviderOrder
    .map((key) => targets[key])
    .filter((target) => target && target.envText);
}

function getSelectedHostingTarget(outputs) {
  const targets = getHostingTargets(outputs);
  if (!targets.length) return null;
  return targets.find((target) => target.key === state.hostingProvider) || targets[0];
}

function getHostingCompletionState() {
  return state.hostingCompleted[state.hostingProvider] === true;
}

function getVisibleManageSchools() {
  const schools = state.bootstrap.schools || [];
  const query = state.manageSchoolSearch.trim().toLowerCase();
  if (!query) return schools;
  return schools.filter((school) => {
    const label = String(school.schoolLabel || '').toLowerCase();
    const id = String(school.schoolId || '').toLowerCase();
    return label.includes(query) || id.includes(query);
  });
}

bootstrap().catch((error) => {
  app.innerHTML = `
    <section class="panel">
      <h2 class="panel-title">Could not load the onboarding console.</h2>
      <p class="panel-subtitle">${escapeHtml(error.message || 'Please try again.')}</p>
      <button class="primary-btn" data-action="reload-page">Reload this page</button>
    </section>
  `;
  bindStaticEvents();
});

async function bootstrap() {
  state.activity = {
    tone: 'info',
    title: 'Opening the onboarding console',
    description: 'Loading your saved defaults, school list, and tool readiness checks.',
    progress: 18,
  };
  const data = await api('/api/bootstrap');
  state.bootstrap = data;
  state.form.schoolLabel = data.defaults.lastSchoolLabel || '';
  state.form.projectId = data.defaults.lastProjectId || '';
  state.form.renderUrl = data.defaults.renderUrl || '';
  state.form.siteDomain = data.defaults.siteDomain || '';
  state.form.readinessTarget = data.defaults.readinessTarget || 'starter';
  state.form.firebaseLocation = data.defaults.firebaseLocation || 'europe-west1';
  state.form.priceIds = {
    starter: data.defaults.priceIds?.starter || '',
    pro: data.defaults.priceIds?.pro || '',
    elite: data.defaults.priceIds?.elite || '',
  };
  state.recheckSchoolId = data.schools[0]?.schoolId || '';
  state.manageSchoolId = data.schools[0]?.schoolId || '';
  state.loading = false;
  state.activity = null;
  render();
}

function render() {
  if (state.loading) {
    app.innerHTML = `
      ${renderActivityBanner()}
      ${renderLoadingCard('Loading your onboarding console...', 'Reading saved schools, defaults, and local setup status.')}
    `;
    return;
  }

  if (!state.mode) {
    app.innerHTML = `${renderActivityBanner()}${renderWelcome()}`;
    bindWelcomeEvents();
    return;
  }

  if (state.mode === 'recheck') {
    app.innerHTML = `${renderActivityBanner()}${renderRecheck()}`;
    bindRecheckEvents();
    return;
  }

  if (state.mode === 'manage') {
    app.innerHTML = `${renderActivityBanner()}${renderManageSchools()}`;
    bindManageEvents();
    return;
  }

  app.innerHTML = `${renderActivityBanner()}${renderNewSetup()}`;
  bindNewSetupEvents();
}

function renderWelcome() {
  const bootstrapAdmin = state.bootstrap.bootstrapAdmin || {
    available: false,
    message: '',
    actionHint: '',
  };
  const gcloud = state.bootstrap.gcloud || {
    installed: false,
    message: '',
    actionHint: '',
    command: 'gcloud auth application-default login',
  };
  return `
    <section class="welcome-grid">
      <div class="panel">
        <p class="eyebrow">Welcome</p>
        <h2 class="panel-title">Set Up a New School</h2>
        <p class="panel-subtitle">
          This tool helps you prepare a new school so payments and the app work properly.
          It gives you one clear step at a time, then shows exactly what to paste at the end.
        </p>
        <ul class="bullet-list">
          <li><i class="fas fa-check-circle"></i><span>Firebase project ID (the school project name/code)</span></li>
          <li><i class="fas fa-check-circle"></i><span>Firebase service account JSON file</span></li>
          <li><i class="fas fa-check-circle"></i><span>Your Render billing URL</span></li>
          <li><i class="fas fa-check-circle"></i><span>Your Stripe price IDs</span></li>
        </ul>
        <div class="helper-card" style="margin-top:18px;">
          <h4>One-time Google admin login</h4>
          <p>${escapeHtml(bootstrapAdmin.available
            ? bootstrapAdmin.message
            : 'For brand-new schools, the smoothest setup is to first sign in on this machine with the Google account that manages the Firebase project.')}</p>
          ${bootstrapAdmin.actionHint ? `<p class="field-hint" style="margin-top:12px;">${escapeHtml(bootstrapAdmin.actionHint)}</p>` : ''}
          ${bootstrapAdmin.technicalDetails ? `<p class="field-error" style="margin-top:12px;">${escapeHtml(bootstrapAdmin.technicalDetails)}</p>` : ''}
          <p class="field-hint">${escapeHtml(gcloud.installed
            ? 'Google Cloud CLI is installed, so this tool can open the sign-in flow for you.'
            : 'Google Cloud CLI is not installed yet, so the tool cannot open the sign-in flow on this machine yet.')}</p>
          ${bootstrapAdmin.available ? '' : `
            <div class="button-row" style="margin-top:12px;">
              <button class="secondary-btn" data-action="start-bootstrap-login" ${gcloud.installed ? '' : 'disabled'}>Open Google Sign-In</button>
              <button class="secondary-btn" data-action="set-bootstrap-quota-project" ${gcloud.installed ? '' : 'disabled'}>Use Current Project for Google Login</button>
              <button class="ghost-btn" data-action="refresh-bootstrap-status">Refresh Google Login Status</button>
            </div>
            <p class="field-hint" style="margin-top:12px;">${escapeHtml(gcloud.installed
              ? 'This opens a separate Terminal window and starts Google sign-in there.'
              : `Install Google Cloud CLI first, then run: ${gcloud.command}`)}</p>
          `}
        </div>
      </div>

      <div class="panel">
        <div class="choice-grid">
          <article class="choice-card">
            <h3>Set up a brand-new school</h3>
            <p>Use the guided wizard, let the console do the automatic checks, then paste the final values into Render and your hosting provider.</p>
            <button class="primary-btn" data-action="start-new">Start Setup</button>
          </article>

          <article class="choice-card">
            <h3>Check an existing school</h3>
            <p>Choose a saved school and rerun the safe checks to make sure its config, paywall, and indexes still look right.</p>
            <button class="secondary-btn" data-action="start-recheck">Check an Existing School</button>
          </article>

          <article class="choice-card">
            <h3>Manage saved schools</h3>
            <p>Open a school from your saved list, review its live access and payment timeline, and manually grant Starter, Pro, Elite, Pending, or Expired with an optional date range.</p>
            <button class="secondary-btn" data-action="start-manage">Manage Saved Schools</button>
          </article>
        </div>
      </div>
    </section>
  `;
}

function renderNewSetup() {
  const setupProgress = Math.round(((state.step + 1) / stepMeta.length) * 100);
  return `
    <section class="step-layout">
      <aside class="progress-card panel">
        <p class="eyebrow">Setup path</p>
        <h2 class="panel-title">One clear step at a time</h2>
        <p class="small-note">You can go back safely at any point before the automatic setup step.</p>
        <div class="inline-progress-summary">
          <div class="activity-progress-bar"><span style="width:${setupProgress}%;"></span></div>
          <strong>${setupProgress}% through the setup path</strong>
        </div>
        <ol class="progress-list">
          ${stepMeta.map((item, index) => {
            const status = state.step > index ? 'done' : state.step === index ? 'active' : '';
            return `
              <li class="progress-item ${status}">
                <span class="progress-dot"><i class="fas ${status === 'done' ? 'fa-check' : item.icon}"></i></span>
                <strong>${escapeHtml(item.label)}</strong>
              </li>
            `;
          }).join('')}
        </ol>
      </aside>

      <section class="step-card">
        ${renderCurrentStep()}
      </section>
    </section>
  `;
}

function renderCurrentStep() {
  const current = stepMeta[state.step];
  const stepHeader = `
    <p class="eyebrow">Step ${state.step + 1} of ${stepMeta.length}</p>
    <h2 class="step-title">${escapeHtml(current.label)}</h2>
  `;

  if (current.key === 'details') {
    const errors = detailsErrors();
    return `
      ${stepHeader}
      <p class="step-subtitle">Tell me which school you are preparing, where your billing server lives, and what public domain the teachers will actually use.</p>
      <div class="grid-two">
        <div class="field-grid">
          <div class="field-wrap">
            <label for="schoolLabel">School label</label>
            <input id="schoolLabel" type="text" value="${escapeHtml(state.form.schoolLabel)}" placeholder="e.g. Volos Frontistirio">
            <p class="${errors.schoolLabel ? 'field-error' : 'field-hint'}">${escapeHtml(errors.schoolLabel || 'This is just for you, so you can recognise the school later.')}</p>
          </div>

          <div class="field-wrap">
            <label for="projectId">Firebase project ID</label>
            <input id="projectId" type="text" value="${escapeHtml(state.form.projectId)}" placeholder="e.g. gcq-school-volos">
            <p class="${errors.projectId ? 'field-error' : 'field-hint'}">${escapeHtml(errors.projectId || 'Find this in Firebase Console. It is the project name/code, not the display name.')}</p>
          </div>

          <div class="field-wrap">
            <label for="renderUrl">Render billing URL</label>
            <input id="renderUrl" type="text" value="${escapeHtml(state.form.renderUrl)}" placeholder="https://your-billing.onrender.com">
            <p class="${errors.renderUrl ? 'field-error' : 'field-hint'}">${escapeHtml(errors.renderUrl || 'This is the address of your billing server on Render.')}</p>
          </div>

          <div class="field-wrap">
            <label for="siteDomain">School site domain</label>
            <input id="siteDomain" type="text" value="${escapeHtml(state.form.siteDomain)}" placeholder="gcq-test-school.netlify.app">
            <p class="${errors.siteDomain ? 'field-error' : 'field-hint'}">${escapeHtml(errors.siteDomain || 'The tool uses this to authorize sign-in in Firebase Authentication. You can paste the full URL or just the hostname.')}</p>
          </div>

          <div class="field-wrap">
            <label for="readinessTarget">What are you preparing today?</label>
            <select id="readinessTarget">
              <option value="starter" ${state.form.readinessTarget === 'starter' ? 'selected' : ''}>Starter / paywall only</option>
              <option value="pro" ${state.form.readinessTarget === 'pro' ? 'selected' : ''}>Pro / Elite ready</option>
              <option value="admin" ${state.form.readinessTarget === 'admin' ? 'selected' : ''}>Parent access + Secretary ready</option>
            </select>
            <p class="field-hint">Starter keeps things lighter. Pro / Elite ready adds Storage. Parent access + Secretary ready also prepares the Cloud Functions admin runtime and extra APIs for role-based access.</p>
          </div>

          <div class="field-wrap">
            <label for="firebaseLocation">Firebase region</label>
            <select id="firebaseLocation">
              <option value="europe-west1" ${state.form.firebaseLocation === 'europe-west1' ? 'selected' : ''}>Europe west 1 (Belgium) - Recommended</option>
              <option value="europe-west3" ${state.form.firebaseLocation === 'europe-west3' ? 'selected' : ''}>Europe west 3 (Frankfurt)</option>
              <option value="europe-west2" ${state.form.firebaseLocation === 'europe-west2' ? 'selected' : ''}>Europe west 2 (London)</option>
              <option value="us-central1" ${state.form.firebaseLocation === 'us-central1' ? 'selected' : ''}>US central 1 (Iowa)</option>
            </select>
            <p class="field-hint">This is only used if the tool must create Firestore or Storage automatically. It is a one-time choice for the Firebase project.</p>
          </div>

          <button class="primary-btn" data-action="save-details">Save and Continue</button>
        </div>

        <div class="helper-cards">
          <article class="helper-card">
            <h4>Where do I find the Firebase project ID?</h4>
            <p>Open Firebase Console, click the school project, then check Project settings. The project ID is the short code like <strong>gcq-school-volos</strong>.</p>
          </article>
          <article class="helper-card">
            <h4>Where do I find the Render URL?</h4>
            <p>Open your billing service on Render. The public URL is the address that ends in <strong>.onrender.com</strong>.</p>
          </article>
          <article class="helper-card">
            <h4>What should I put as the school site domain?</h4>
            <p>Use the exact public school site hostname, such as <strong>gcq-test-school.netlify.app</strong>, <strong>your-school.pages.dev</strong>, or <strong>your-user.github.io</strong>. This lets the tool authorize that domain for Firebase sign-in automatically.</p>
          </article>
          <article class="helper-card">
            <h4>What happens when I click?</h4>
            <p>I simply save these details inside the wizard and move you to the Firebase key step. Nothing is deployed yet.</p>
          </article>
          <article class="helper-card">
            <h4>Do I need to sign in with my Google admin account?</h4>
            <p>${escapeHtml((state.bootstrap.bootstrapAdmin && state.bootstrap.bootstrapAdmin.available)
              ? 'Yes, and this machine already looks ready for that one-time admin work.'
              : 'For brand-new Firebase projects, yes. The easiest path is to run gcloud auth application-default login once on this machine, using the same Google account that manages the Firebase project.')}</p>
          </article>
        </div>
      </div>
    `;
  }

  if (current.key === 'firebase') {
    const summary = state.serviceAccountSummary;
    const summaryBlock = summary ? `
      <div class="summary-card">
        <h3 class="mini-label">Key summary</h3>
        <div class="summary-grid">
          <div class="summary-pill">
            <div class="pill-label">Project detected</div>
            <div class="pill-value">${escapeHtml(summary.projectId || 'Not found')}</div>
          </div>
          <div class="summary-pill">
            <div class="pill-label">Client email</div>
            <div class="pill-value">${escapeHtml(summary.clientEmail || 'Not found')}</div>
          </div>
          <div class="summary-pill">
            <div class="pill-label">Key looks valid</div>
            <div class="pill-value">${summary.looksValid ? 'Yes' : 'Not yet'}</div>
          </div>
        </div>
        <p class="${summary.matchesProject ? 'field-success' : 'field-error'}" style="margin-top:14px;">
          ${escapeHtml(summary.message)}
        </p>
      </div>
    ` : '';

    return `
      ${stepHeader}
      <p class="step-subtitle">Add the Firebase service account file for this school. This is the JSON file you downloaded from Firebase.</p>
      <div class="grid-two">
        <div class="field-grid">
          <div class="field-wrap">
            <label for="serviceAccountFile">Upload JSON file</label>
            <input id="serviceAccountFile" type="file" accept=".json,application/json">
            <p class="field-hint">If you prefer, you can upload the file instead of pasting it below.</p>
          </div>

          <div class="field-wrap">
            <label for="serviceAccount">Or paste the JSON here</label>
            <textarea id="serviceAccount" placeholder="Paste the whole JSON file from Firebase here...">${escapeHtml(state.form.serviceAccount)}</textarea>
            <p class="field-hint">Nothing is sent anywhere except the services you already use, and this tool runs only on your machine.</p>
          </div>

          ${summaryBlock}

          <div class="button-row">
            <button class="secondary-btn" data-action="validate-key">Check This Key</button>
            <button class="ghost-btn" data-action="back-step">Back</button>
          </div>
          <button class="primary-btn" data-action="use-key" ${!summary || !summary.matchesProject ? 'disabled' : ''}>Use This Key</button>
        </div>

        <div class="helper-cards">
          <article class="helper-card">
            <h4>Where do I find this file?</h4>
            <p>In Firebase Console: Project settings -> Service accounts -> Generate new private key.</p>
          </article>
          <article class="helper-card">
            <h4>What happens when I click “Check This Key”?</h4>
            <p>I check that the JSON looks like a real Firebase service account and that it matches the school project ID you typed earlier.</p>
          </article>
          <article class="helper-card">
            <h4>What if it fails?</h4>
            <p>The message will tell you whether the file is broken or simply belongs to the wrong Firebase project.</p>
          </article>
        </div>
      </div>
    `;
  }

  if (current.key === 'billing') {
    const prices = state.form.priceIds;
    const priceErrors = billingErrors();
    return `
      ${stepHeader}
      <p class="step-subtitle">Add the Stripe price IDs for the plans you sell. If you have used this tool before, your saved prices can be loaded automatically.</p>
      <div class="grid-two">
        <div class="field-grid">
          <div class="field-wrap">
            <label for="starterPrice">Starter price ID</label>
            <input id="starterPrice" type="text" value="${escapeHtml(prices.starter)}" placeholder="price_xxxxx">
            <p class="${priceErrors.starter ? 'field-error' : 'field-hint'}">${escapeHtml(priceErrors.starter || 'This usually starts with price_.')}</p>
          </div>
          <div class="field-wrap">
            <label for="proPrice">Pro price ID</label>
            <input id="proPrice" type="text" value="${escapeHtml(prices.pro)}" placeholder="price_xxxxx">
            <p class="${priceErrors.pro ? 'field-error' : 'field-hint'}">${escapeHtml(priceErrors.pro || 'This usually starts with price_.')}</p>
          </div>
          <div class="field-wrap">
            <label for="elitePrice">Elite price ID</label>
            <input id="elitePrice" type="text" value="${escapeHtml(prices.elite)}" placeholder="price_xxxxx">
            <p class="${priceErrors.elite ? 'field-error' : 'field-hint'}">${escapeHtml(priceErrors.elite || 'This usually starts with price_.')}</p>
          </div>

          <div class="button-row">
            <button class="secondary-btn" data-action="load-saved-prices">Use My Saved Prices</button>
            <button class="ghost-btn" data-action="back-step">Back</button>
          </div>

          <div class="summary-card">
            <h3 class="mini-label">Plan summary</h3>
            <div class="summary-grid">
              ${['starter', 'pro', 'elite'].map((tier) => `
                <div class="summary-pill">
                  <div class="pill-label">${capitalize(tier)}</div>
                  <div class="pill-value">${escapeHtml(prices[tier] || 'Not added yet')}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <button class="primary-btn" data-action="save-billing">Save Billing Settings</button>
        </div>

        <div class="helper-cards">
          <article class="helper-card">
            <h4>Where do I find the Stripe price IDs?</h4>
            <p>Open Stripe -> Product catalog -> open the plan -> copy the price ID from the plan details.</p>
          </article>
          <article class="helper-card">
            <h4>What happens when I click?</h4>
            <p>I remember these prices for future schools and prepare them for the automatic setup step.</p>
          </article>
          <article class="helper-card">
            <h4>What if I make a mistake?</h4>
            <p>You can come back and edit the price IDs whenever you want. The console will not charge anyone by itself.</p>
          </article>
        </div>
      </div>
    `;
  }

  if (current.key === 'setup') {
    return `
      ${stepHeader}
      <p class="step-subtitle">This is the automatic part. When you click the button, I will save the school, save the Firebase key, set the paywall, check the Firestore indexes, create missing indexes, and prepare the final copy boxes.</p>

      <div class="helper-cards" style="margin-bottom:18px;">
        <article class="helper-card">
          <h4>What happens when I click?</h4>
          <p>The console uses your local machine to update the local billing files, talk to Firebase safely, and build the exact final values you need.</p>
        </article>
      </div>

      <button class="primary-btn" data-action="run-setup" ${state.isRunning ? 'disabled' : ''}>
        ${state.isRunning ? 'Running Automatic Setup...' : 'Run Automatic Setup'}
      </button>

      <div style="height:18px;"></div>
      ${state.setupResult ? `
        ${renderTaskProgress(state.setupResult.tasks, 'Automatic setup progress', 'Each safe setup task is tracked below so you can see what finished and what still needs attention.')}
        ${renderTaskList(state.setupResult.tasks)}
      ` : `
        <div class="empty-box">
          <strong>No tasks have run yet.</strong><br>
          When you click the button above, each setup task will appear here with a simple status and clear next steps.
        </div>
      `}

      ${state.setupResult ? `
        <div class="button-row" style="margin-top:18px;">
          <button class="secondary-btn" data-action="retry-setup">Try Again</button>
          <button class="primary-btn" data-action="continue-final">Continue to Final Steps</button>
        </div>
      ` : `
        <div class="button-row" style="margin-top:18px;">
          <button class="ghost-btn" data-action="back-step">Back</button>
        </div>
      `}
    `;
  }

  return renderFinalStep(stepHeader);
}

function renderFinalStep(stepHeader) {
  const result = state.setupResult;
  const selectedTarget = getSelectedHostingTarget(result?.outputs);
  const ready = result?.finalStatus === 'ready' && state.renderPasted && getHostingCompletionState();
  const bannerStatus = result?.finalStatus === 'ready' ? 'ready' : 'needs_attention';
  return `
    ${stepHeader}
    <p class="step-subtitle">These are the last two things you need to do. Copy the Render value, choose your hosting provider, then finish that provider’s final setup.</p>

    ${result ? `
      <div class="final-banner ${bannerStatus}">
        <div class="final-icon"><i class="fas ${bannerStatus === 'ready' ? 'fa-trophy' : 'fa-wrench'}"></i></div>
        <div class="final-copy">
          <h3>${ready ? 'This school is ready.' : result.finalStatus === 'ready' ? 'Almost there: paste the final values.' : 'Almost ready: one thing still needs attention.'}</h3>
          <p>${escapeHtml(result.summary)}</p>
        </div>
      </div>
    ` : ''}

    <div class="stack">
      <section class="giant-output">
        <div class="output-head">
          <div>
            <h3>Step 1: Paste this into Render</h3>
            <p>Open your billing service on Render -> Environment -> <strong>BILLING_SCHOOLS_JSON</strong>, then paste this whole value.</p>
          </div>
          <button class="copy-btn" data-copy="renderJson" ${!result?.outputs?.renderJson ? 'disabled' : ''}>Copy Render Value</button>
        </div>
        <pre class="output-box">${escapeHtml(result?.outputs?.renderJson || 'The Render value will appear here after automatic setup runs.')}</pre>
        <label class="checkline">
          <input type="checkbox" data-toggle="render-pasted" ${state.renderPasted ? 'checked' : ''}>
          I pasted this into Render
        </label>
      </section>

      <section class="giant-output">
        <div class="output-head">
          <div>
            <h3>Step 2: Configure ${escapeHtml(selectedTarget?.label || 'hosting')}</h3>
            <p>${escapeHtml(selectedTarget?.intro || 'The hosting setup details will appear here after automatic setup runs.')}</p>
          </div>
          <div class="button-row">
            <button class="copy-btn" data-copy="hostingEnv" ${!selectedTarget?.envText ? 'disabled' : ''}>${escapeHtml(selectedTarget?.copyLabel || 'Copy Hosting Values')}</button>
            <button class="secondary-btn" data-action="download-hosting-inline" ${!selectedTarget?.envText ? 'disabled' : ''}>${escapeHtml(selectedTarget?.downloadLabel || 'Download hosting env')}</button>
          </div>
        </div>
        ${renderHostingProviderPicker(result?.outputs)}
        ${selectedTarget?.instructions?.length ? `
          <ul class="bullet-list" style="margin-top:16px;">
            ${selectedTarget.instructions.map((item) => `<li><i class="fas fa-check-circle"></i><span>${escapeHtml(item)}</span></li>`).join('')}
          </ul>
        ` : ''}
        <pre class="output-box">${escapeHtml(selectedTarget?.envText || 'The hosting values will appear here after automatic setup runs.')}</pre>
        <label class="checkline">
          <input type="checkbox" data-toggle="hosting-completed" ${getHostingCompletionState() ? 'checked' : ''}>
          ${escapeHtml(selectedTarget?.confirmLabel || 'I finished the hosting setup')}
        </label>
      </section>
    </div>

    ${ready ? `
      <section class="quest-complete">
        <div class="quest-complete-glow"></div>
        <div class="quest-complete-copy">
          <p class="eyebrow">Quest Complete</p>
          <h3>This school is fully ready.</h3>
          <p>Render is updated, ${escapeHtml(selectedTarget?.label || 'your hosting provider')} is prepared, and this onboarding run is complete. You can move on to the next school whenever you want.</p>
        </div>
        <div class="button-row">
          <button class="primary-btn" data-action="finish-quest">Finish This School</button>
          <button class="secondary-btn" data-action="set-up-another">Set Up Another School</button>
        </div>
      </section>
    ` : ''}

    <div class="button-row" style="margin-top:18px;">
      <button class="secondary-btn" data-action="start-over">${ready ? 'Back to Home' : 'Back to Home'}</button>
      <button class="ghost-btn" data-action="back-step">Back</button>
    </div>
  `;
}

function renderLoadingCard(title, description) {
  return `
    <div class="loading-card">
      <div class="spinner"></div>
      <p><strong>${escapeHtml(title)}</strong></p>
      <p class="loading-card-copy">${escapeHtml(description)}</p>
    </div>
  `;
}

function renderActivityBanner() {
  if (!state.activity) return '';
  const progress = Math.max(6, Math.min(100, Number(state.activity.progress) || 0));
  return `
    <section class="activity-banner tone-${escapeHtml(state.activity.tone || 'info')}">
      <div class="activity-banner-copy">
        <p class="mini-label">In progress</p>
        <h3>${escapeHtml(state.activity.title || 'Working')}</h3>
        <p>${escapeHtml(state.activity.description || 'Please wait while the tool works through the next step.')}</p>
      </div>
      <div class="activity-banner-meter" aria-hidden="true">
        <div class="activity-progress-bar"><span style="width:${progress}%;"></span></div>
        <strong>${progress}%</strong>
      </div>
    </section>
  `;
}

function renderTaskProgress(tasks = [], title, description) {
  if (!Array.isArray(tasks) || !tasks.length) return '';
  const completeCount = tasks.filter((task) => ['done', 'already_done'].includes(task.status)).length;
  const progress = Math.round((completeCount / tasks.length) * 100);
  return `
    <section class="activity-banner tone-soft">
      <div class="activity-banner-copy">
        <p class="mini-label">Progress</p>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="activity-banner-meter" aria-hidden="true">
        <div class="activity-progress-bar"><span style="width:${progress}%;"></span></div>
        <strong>${completeCount}/${tasks.length}</strong>
      </div>
    </section>
  `;
}

function renderTaskList(tasks) {
  return `
    <div class="task-list">
      ${tasks.map((task) => {
        const statusLabel = task.status === 'already_done'
          ? 'Already done'
          : task.status === 'needs_attention'
            ? 'Needs attention'
            : task.status === 'working'
              ? 'Working'
              : task.status === 'done'
                ? 'Done'
                : 'Waiting';
        return `
          <article class="task-card">
            <div class="task-head">
              <div class="task-main">
                <div class="task-icon"><i class="fas ${taskIcons[task.task] || 'fa-stars'}"></i></div>
                <div>
                  <h3 class="task-title">${escapeHtml(task.title)}</h3>
                  <p class="task-message">${escapeHtml(task.message)}</p>
                  ${task.actionHint ? `<p class="field-hint" style="margin-top:8px;">${escapeHtml(task.actionHint)}</p>` : ''}
                </div>
              </div>
              <span class="status-pill status-${task.status}">${escapeHtml(statusLabel)}</span>
            </div>
            ${task.technicalDetails ? `
              <div class="details-row">
                <details>
                  <summary>Show technical details</summary>
                  <div class="details-content"><pre>${escapeHtml(task.technicalDetails)}</pre></div>
                </details>
              </div>
            ` : ''}
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderHostingProviderPicker(outputs, includeFallback = false) {
  const targets = getHostingTargets(outputs);
  const options = targets.length
    ? targets.map((target) => ({ key: target.key, label: target.label }))
    : includeFallback
      ? hostingProviderOrder.map((key) => ({ key, label: hostingProviderLabels[key] || key }))
      : [];
  if (!options.length) return '';
  return `
    <div class="button-row" style="margin-top:16px;">
      ${options.map((target) => `
        <button class="${state.hostingProvider === target.key ? 'primary-btn' : 'secondary-btn'}" data-action="pick-hosting-provider" data-provider="${escapeHtml(target.key)}">
          ${escapeHtml(target.label)}
        </button>
      `).join('')}
    </div>
  `;
}

function renderRecheck() {
  return `
    <section class="welcome-grid">
      <div class="panel">
        <p class="eyebrow">Existing school check</p>
        <h2 class="panel-title">Check a saved school</h2>
        <p class="panel-subtitle">Pick a school from your local saved list and rerun the safe checks. This does not create duplicate school records.</p>

        ${state.bootstrap.schools.length === 0 ? `
          <div class="empty-box">
            You do not have any saved schools yet. Run the new school setup first, then you can use the re-check mode any time you want.
          </div>
        ` : `
          <div class="field-grid">
            <div class="field-wrap">
              <label for="savedSchool">Saved school</label>
              <select id="savedSchool">
                ${state.bootstrap.schools.map((school) => `
                  <option value="${escapeHtml(school.schoolId)}" ${state.recheckSchoolId === school.schoolId ? 'selected' : ''}>
                    ${escapeHtml(school.schoolLabel || school.schoolId)} (${escapeHtml(school.schoolId)})
                  </option>
                `).join('')}
              </select>
              <p class="field-hint">This list comes from your local billing records on this machine.</p>
            </div>

            <div class="field-wrap">
              <label for="savedReadinessTarget">What do you want this school ready for now?</label>
              <select id="savedReadinessTarget">
                <option value="starter" ${state.form.readinessTarget === 'starter' ? 'selected' : ''}>Starter / paywall only</option>
                <option value="pro" ${state.form.readinessTarget === 'pro' ? 'selected' : ''}>Pro / Elite ready</option>
                <option value="admin" ${state.form.readinessTarget === 'admin' ? 'selected' : ''}>Parent access + Secretary ready</option>
              </select>
              <p class="field-hint">Use the admin option when the school now needs parent usernames, secretary access, and the Functions-based role runtime.</p>
            </div>

            <div class="field-wrap">
              <label for="savedFirebaseLocation">Firebase region if creation is needed</label>
              <select id="savedFirebaseLocation">
                <option value="europe-west1" ${state.form.firebaseLocation === 'europe-west1' ? 'selected' : ''}>Europe west 1 (Belgium) - Recommended</option>
                <option value="europe-west3" ${state.form.firebaseLocation === 'europe-west3' ? 'selected' : ''}>Europe west 3 (Frankfurt)</option>
                <option value="europe-west2" ${state.form.firebaseLocation === 'europe-west2' ? 'selected' : ''}>Europe west 2 (London)</option>
                <option value="us-central1" ${state.form.firebaseLocation === 'us-central1' ? 'selected' : ''}>US central 1 (Iowa)</option>
              </select>
            </div>

            <div class="button-row">
              <button class="primary-btn" data-action="run-recheck" ${state.isRunning ? 'disabled' : ''}>${state.isRunning ? 'Running School Check...' : 'Run School Check'}</button>
              <button class="ghost-btn" data-action="start-over">Back to Home</button>
            </div>
          </div>
        `}
      </div>

      <div class="panel">
        <div class="helper-cards">
          <article class="helper-card">
            <h4>What does this check?</h4>
            <p>The saved billing record, the paywall document, the Firestore indexes, and the final copy outputs.</p>
          </article>
          <article class="helper-card">
            <h4>Will this duplicate anything?</h4>
            <p>No. This mode is meant to be safe to rerun. It checks what is there and tells you what still needs attention.</p>
          </article>
          <article class="helper-card">
            <h4>Google admin login status</h4>
            <p>${escapeHtml((state.bootstrap.bootstrapAdmin && state.bootstrap.bootstrapAdmin.available)
              ? state.bootstrap.bootstrapAdmin.message
              : 'No local Google admin login is ready right now. Starter-to-Pro upgrades are much smoother if you run gcloud auth application-default login first.')}</p>
            ${state.bootstrap.gcloud?.installed ? `
              <div class="button-row" style="margin-top:12px;">
                <button class="secondary-btn" data-action="start-bootstrap-login">Open Google Sign-In</button>
                <button class="secondary-btn" data-action="set-bootstrap-quota-project">Use Current Project for Google Login</button>
                <button class="ghost-btn" data-action="refresh-bootstrap-status">Refresh Google Login Status</button>
              </div>
            ` : `
              <p class="field-hint" style="margin-top:12px;">Install Google Cloud CLI first, then run: ${escapeHtml(state.bootstrap.gcloud?.command || 'gcloud auth application-default login')}</p>
            `}
          </article>
        </div>
      </div>

      ${state.recheckResult ? `
        <div class="result-card" style="grid-column: 1 / -1;">
          ${(() => {
            const selectedTarget = getSelectedHostingTarget(state.recheckResult.outputs);
            return `
          ${renderTaskProgress(state.recheckResult.tasks, 'School check progress', 'This bar shows how many safe checks completed cleanly for the selected saved school.')}
          <div class="final-banner ${state.recheckResult.finalStatus === 'ready' ? 'ready' : 'needs_attention'}">
            <div class="final-icon"><i class="fas ${state.recheckResult.finalStatus === 'ready' ? 'fa-thumbs-up' : 'fa-triangle-exclamation'}"></i></div>
            <div class="final-copy">
              <h3>${state.recheckResult.finalStatus === 'ready' ? 'This saved school looks ready.' : 'This school still needs attention.'}</h3>
              <p>${escapeHtml(state.recheckResult.summary)}</p>
            </div>
          </div>
          ${renderTaskList(state.recheckResult.tasks)}
          <div class="stack" style="margin-top:18px;">
            <section class="giant-output">
              <div class="output-head">
                <div>
                  <h3>Render value</h3>
                  <p>This is the current value to paste into <strong>BILLING_SCHOOLS_JSON</strong> if you need to refresh Render.</p>
                </div>
                <button class="copy-btn" data-copy="renderJson" ${!state.recheckResult.outputs.renderJson ? 'disabled' : ''}>Copy Render Value</button>
              </div>
              <pre class="output-box">${escapeHtml(state.recheckResult.outputs.renderJson || 'No Render value available.')}</pre>
            </section>
            <section class="giant-output">
              <div class="output-head">
                <div>
                  <h3>${escapeHtml(selectedTarget?.label || 'Hosting')} values</h3>
                  <p>${escapeHtml(selectedTarget?.intro || 'This is the current hosting configuration for the school site.')}</p>
                </div>
                <div class="button-row">
                  <button class="copy-btn" data-copy="hostingEnv" ${!selectedTarget?.envText ? 'disabled' : ''}>${escapeHtml(selectedTarget?.copyLabel || 'Copy Hosting Values')}</button>
                  <button class="secondary-btn" data-action="download-hosting-saved" ${!selectedTarget?.envText ? 'disabled' : ''}>${escapeHtml(selectedTarget?.downloadLabel || 'Download hosting env')}</button>
                </div>
              </div>
              ${renderHostingProviderPicker(state.recheckResult.outputs)}
              ${selectedTarget?.instructions?.length ? `
                <ul class="bullet-list" style="margin-top:16px;">
                  ${selectedTarget.instructions.map((item) => `<li><i class="fas fa-check-circle"></i><span>${escapeHtml(item)}</span></li>`).join('')}
                </ul>
              ` : ''}
              <pre class="output-box">${escapeHtml(selectedTarget?.envText || 'No hosting values available yet.')}</pre>
            </section>
          </div>
            `;
          })()}
        </div>
      ` : ''}
    </section>
  `;
}

function renderManageSchools() {
  const details = state.manageSubscription;
  const subscription = details?.subscription || null;
  const billing = details?.billing || null;
  const grace = details?.grace || null;
  const currentTier = subscription?.tier || 'missing';
  const effectiveTier = subscription?.effectiveTier || 'pending';
  const deleteReady = state.manageDeleteConfirm.trim() === state.manageSchoolId;
  const selectedMeta = manageTierMeta[state.manageForm.tier] || manageTierMeta.pending;
  const currentMeta = manageTierMeta[currentTier] || manageTierMeta.missing;
  const effectiveMeta = manageTierMeta[effectiveTier] || manageTierMeta.pending;
  const selectedHostingLabel = hostingProviderLabels[state.hostingProvider] || 'Hosting';
  const schools = state.bootstrap.schools || [];
  const visibleSchools = getVisibleManageSchools();
  const selectedSchool = schools.find((school) => school.schoolId === state.manageSchoolId) || schools[0] || null;
  const activeSinceLabel = getActiveSinceLabel(subscription?.startsAt || billing?.subscriptionStartedAt || billing?.firstPaidAt);
  const remainingLabel = getRemainingAccessLabel(subscription?.endsAt || billing?.currentPeriodEnd);
  const accessProgress = getDateRangeProgress(subscription?.startsAt || billing?.subscriptionStartedAt, subscription?.endsAt || billing?.currentPeriodEnd);
  const paymentTone = getBillingTone(billing, effectiveMeta.tone);
  const graceTone = getGraceTone(grace);
  const latestPaid = billing?.latestPaidInvoice || billing?.recentPayments?.[0] || null;
  const graceStatus = getGraceStatusLabel(grace);
  const graceWindowLabel = getGraceWindowLabel(grace);
  const assessmentSummary = details?.assessmentSummary || null;
  return `
    <section class="manage-screen">
      <div class="panel manage-hero-panel manage-top-panel">
        <div class="manage-hero-head">
          <div class="manage-hero-copy">
            <p class="eyebrow">Saved school admin</p>
            <h2 class="panel-title">Manage a saved school subscription</h2>
            <p class="panel-subtitle">Switch schools quickly, see the payment story and access timeline, then update the live plan with a clear manual override.</p>
          </div>
          <button type="button" class="info-icon-btn" data-action="open-manage-help" aria-label="Open the manual school access guide">i</button>
        </div>
        <div class="manage-hero-orb" aria-hidden="true">
          <span>🏫</span>
        </div>

        ${schools.length === 0 ? `
          <div class="empty-box">
            You do not have any saved schools yet. Run the new school setup first, then this screen will let you manage them.
          </div>
        ` : `
          <div class="manage-switcher-shell">
            <div class="manage-current-school-card">
              <p class="mini-label">Selected school</p>
              <h3>${escapeHtml(selectedSchool?.schoolLabel || selectedSchool?.schoolId || 'Choose a saved school')}</h3>
              <p>${escapeHtml(selectedSchool?.schoolId || 'Nothing selected yet')}</p>
              <div class="manage-current-school-meta">
                <span class="status-pill status-${details ? 'done' : 'waiting'}">${details ? 'Loaded' : 'Choose and load'}</span>
                <span class="manage-inline-tier tone-${effectiveMeta.tone}">${escapeHtml(effectiveMeta.label)}</span>
              </div>
            </div>

            <div class="manage-switcher-controls">
              <div class="field-wrap manage-school-field">
                <label for="manageSchoolSearch">Find a saved school</label>
                <input id="manageSchoolSearch" type="text" value="${escapeHtml(state.manageSchoolSearch)}" placeholder="Search by school name or project ID">
                <p class="field-hint">${visibleSchools.length} school${visibleSchools.length === 1 ? '' : 's'} match${visibleSchools.length === 1 ? 'es' : ''} your search.</p>
              </div>

              <div class="manage-school-picker">
                <div class="field-wrap manage-school-field">
                  <label for="manageSchool">Choose a saved school</label>
                  <select id="manageSchool" ${visibleSchools.length ? '' : 'disabled'}>
                    ${visibleSchools.map((school) => `
                      <option value="${escapeHtml(school.schoolId)}" ${state.manageSchoolId === school.schoolId ? 'selected' : ''}>
                        ${escapeHtml(school.schoolLabel || school.schoolId)} (${escapeHtml(school.schoolId)})
                      </option>
                    `).join('')}
                  </select>
                  <p class="field-hint">This list comes from your local saved billing records.</p>
                </div>

                <div class="manage-school-actions">
                  <button class="secondary-btn" data-action="load-manage-school" ${state.manageLoading || !visibleSchools.length ? 'disabled' : ''}>${state.manageLoading ? 'Loading...' : details ? 'Refresh This School' : 'Open This School'}</button>
                  <button class="ghost-btn" data-action="start-over">Back to Home</button>
                </div>
              </div>
            </div>
          </div>

          ${visibleSchools.length ? `
            <div class="manage-school-chip-grid">
              ${visibleSchools.map((school) => `
                <button
                  type="button"
                  class="manage-school-chip ${state.manageSchoolId === school.schoolId ? 'selected' : ''}"
                  data-action="pick-manage-school"
                  data-school-id="${escapeHtml(school.schoolId)}"
                >
                  <span class="manage-school-chip-icon">${state.manageSchoolId === school.schoolId ? '✨' : '📘'}</span>
                  <span class="manage-school-chip-copy">
                    <strong>${escapeHtml(school.schoolLabel || school.schoolId)}</strong>
                    <small>${escapeHtml(school.schoolId)}</small>
                  </span>
                </button>
              `).join('')}
            </div>
          ` : `
            <div class="empty-box" style="margin-top:18px;">
              No saved schools matched that search. Try a shorter name or part of the Firebase project ID.
            </div>
          `}
        `}
      </div>

      ${state.manageHelpOpen ? renderManageHelpModal() : ''}

      ${details ? `
        <div class="result-card manage-results">
          <div class="manage-status-hero tone-${effectiveMeta.tone}">
            <div class="manage-status-main">
              <div class="manage-status-badge">
                <span class="manage-status-emoji">${effectiveMeta.emoji}</span>
                <div>
                  <p class="mini-label">Currently live in the app</p>
                  <h3>${escapeHtml(effectiveMeta.label)}</h3>
                </div>
              </div>
              <p class="manage-status-copy">${escapeHtml(subscription?.message || effectiveMeta.blurb)}</p>
              <div class="manage-lifespan-bar">
                <div class="activity-progress-bar"><span style="width:${accessProgress}%;"></span></div>
                <div class="manage-lifespan-copy">
                  <strong>${escapeHtml(activeSinceLabel)}</strong>
                  <span>${escapeHtml(remainingLabel)}</span>
                </div>
              </div>
            </div>
            <div class="manage-status-side">
              <div class="manage-school-title">
                <p class="mini-label">Saved school</p>
                <h4>${escapeHtml(details.school.schoolLabel || details.school.schoolId)}</h4>
                <p>${escapeHtml(details.school.schoolId)}</p>
              </div>
              ${renderHostingProviderPicker(null, true)}
              <button class="secondary-btn" data-action="download-hosting-managed">${escapeHtml(`Download ${selectedHostingLabel} env`)}</button>
            </div>
          </div>

          <div class="manage-snapshot-grid manage-snapshot-grid-wide">
            <article class="manage-snapshot-card tone-${currentMeta.tone}">
              <div class="manage-snapshot-top">
                <span class="manage-snapshot-emoji">${currentMeta.emoji}</span>
                <div>
                  <p class="pill-label">Saved tier</p>
                  <h4>${escapeHtml(currentMeta.label)}</h4>
                </div>
              </div>
              <p>${escapeHtml(currentMeta.blurb)}</p>
            </article>
            <article class="manage-snapshot-card tone-${effectiveMeta.tone}">
              <div class="manage-snapshot-top">
                <span class="manage-snapshot-emoji">${effectiveMeta.emoji}</span>
                <div>
                  <p class="pill-label">Effective right now</p>
                  <h4>${escapeHtml(effectiveMeta.label)}</h4>
                </div>
              </div>
              <p>${effectiveTier === currentTier
                ? 'The saved tier and the live tier currently match.'
                : 'Dates are changing what the app is doing right now.'}</p>
            </article>
            <article class="manage-snapshot-card neutral">
              <div class="manage-date-line">
                <span>Starts</span>
                <strong>${escapeHtml(formatDateForDisplay(subscription?.startsAt))}</strong>
              </div>
              <div class="manage-date-line">
                <span>Ends</span>
                <strong>${escapeHtml(formatDateForDisplay(subscription?.endsAt))}</strong>
              </div>
              <div class="manage-date-line">
                <span>Updated</span>
                <strong>${escapeHtml(formatDateForDisplay(subscription?.updatedAt))}</strong>
              </div>
            </article>
            <article class="manage-snapshot-card tone-${paymentTone}">
              <div class="manage-snapshot-top">
                <span class="manage-snapshot-emoji">${billing?.available ? (billing?.hasSubscription ? '💳' : '🧾') : '📡'}</span>
                <div>
                  <p class="pill-label">Stripe billing</p>
                  <h4>${escapeHtml(getBillingHeadline(billing))}</h4>
                </div>
              </div>
              <p>${escapeHtml(getBillingMessage(billing))}</p>
            </article>
            <article class="manage-snapshot-card tone-${graceTone}">
              <div class="manage-snapshot-top">
                <span class="manage-snapshot-emoji">${grace?.active ? '⏱️' : grace?.used ? '⌛' : '🌤️'}</span>
                <div>
                  <p class="pill-label">Grace period</p>
                  <h4>${escapeHtml(graceStatus)}</h4>
                </div>
              </div>
              <p>${escapeHtml(grace?.message || 'Grace-period status is not available.')}</p>
            </article>
            <article class="manage-snapshot-card neutral">
              <div class="manage-snapshot-top">
                <span class="manage-snapshot-emoji">${assessmentSummary?.configured ? '📝' : '📄'}</span>
                <div>
                  <p class="pill-label">Assessment setup</p>
                  <h4>${escapeHtml(assessmentSummary?.configured ? `${assessmentSummary.leagueCount} leagues saved` : 'Using legacy defaults')}</h4>
                </div>
              </div>
              <p>${escapeHtml(assessmentSummary?.message || 'Assessment defaults are not available for this school.')}</p>
            </article>
          </div>

          ${assessmentSummary?.configured ? `
            <section class="manage-card">
              <div class="manage-card-head">
                <div>
                  <p class="mini-label">Assessment defaults</p>
                  <h3>Saved grading setup by league</h3>
                </div>
              </div>
              <div class="manage-finance-grid">
                ${assessmentSummary.leagues.map((entry) => `
                  <article class="manage-metric-card neutral">
                    <p class="pill-label">${escapeHtml(entry.league)}</p>
                    <strong>Tests: ${escapeHtml(entry.tests)}</strong>
                    <span>Dictations: ${escapeHtml(entry.dictations)}</span>
                  </article>
                `).join('')}
              </div>
            </section>
          ` : ''}

          <section class="manage-card manage-finance-card">
            <div class="manage-card-head">
              <div>
                <p class="mini-label">Economic control</p>
                <h3>Payments, timing, and subscription health</h3>
              </div>
            </div>
            <div class="manage-finance-grid">
              <article class="manage-metric-card tone-${paymentTone}">
                <p class="pill-label">Paid subscription</p>
                <strong>${escapeHtml(billing?.available ? (billing?.hasSubscription ? 'Yes' : 'No active paid plan') : 'Unavailable')}</strong>
                <span>${escapeHtml(billing?.status ? capitalize(billing.status) : 'Billing server check')}</span>
              </article>
              <article class="manage-metric-card tone-${paymentTone}">
                <p class="pill-label">Current charge</p>
                <strong>${escapeHtml(formatBillingPrice(billing?.currentPrice))}</strong>
                <span>${escapeHtml(billing?.tier ? `${capitalize(billing.tier)} plan` : 'No Stripe plan saved')}</span>
              </article>
              <article class="manage-metric-card neutral">
                <p class="pill-label">Active for</p>
                <strong>${escapeHtml(activeSinceLabel)}</strong>
                <span>${escapeHtml(formatDateForDisplay(subscription?.startsAt || billing?.subscriptionStartedAt || billing?.firstPaidAt))}</span>
              </article>
              <article class="manage-metric-card neutral">
                <p class="pill-label">Time left</p>
                <strong>${escapeHtml(remainingLabel)}</strong>
                <span>${escapeHtml(formatDateForDisplay(subscription?.endsAt || billing?.currentPeriodEnd))}</span>
              </article>
              <article class="manage-metric-card tone-${paymentTone}">
                <p class="pill-label">Total paid</p>
                <strong>${escapeHtml(formatCurrencyMinor(billing?.lifetimePaidAmount, billing?.currentPrice?.currency || latestPaid?.currency))}</strong>
                <span>${escapeHtml((billing?.lifetimePaidCount || 0) + ' payment' + ((billing?.lifetimePaidCount || 0) === 1 ? '' : 's'))}</span>
              </article>
              <article class="manage-metric-card tone-${paymentTone}">
                <p class="pill-label">Last payment</p>
                <strong>${escapeHtml(latestPaid ? formatCurrencyMinor(latestPaid.amountPaid, latestPaid.currency) : 'No paid invoice yet')}</strong>
                <span>${escapeHtml(latestPaid?.paidAt ? formatDateForDisplay(latestPaid.paidAt) : 'Nothing recorded in Stripe')}</span>
              </article>
              <article class="manage-metric-card tone-${graceTone}">
                <p class="pill-label">Grace status</p>
                <strong>${escapeHtml(graceStatus)}</strong>
                <span>${escapeHtml(graceWindowLabel)}</span>
              </article>
              <article class="manage-metric-card tone-${graceTone}">
                <p class="pill-label">Grace started</p>
                <strong>${escapeHtml(formatDateForDisplay(grace?.startsAt))}</strong>
                <span>${escapeHtml(grace?.used ? getActiveSinceLabel(grace?.startsAt) : 'No grace period has started yet')}</span>
              </article>
              <article class="manage-metric-card tone-${graceTone}">
                <p class="pill-label">Grace ends</p>
                <strong>${escapeHtml(formatDateForDisplay(grace?.endsAt))}</strong>
                <span>${escapeHtml(getRemainingAccessLabel(grace?.endsAt))}</span>
              </article>
            </div>
          </section>

          <section class="manage-card manage-ledger-card">
            <div class="manage-card-head">
              <div>
                <p class="mini-label">Payment timeline</p>
                <h3>What they have paid</h3>
              </div>
            </div>
            ${renderPaymentTimeline(billing)}
          </section>

          <div class="manage-layout">
            <div class="manage-main-stack">
              <section class="manage-card manage-tier-card">
                <div class="manage-card-head">
                  <div>
                    <p class="mini-label">Step 1</p>
                    <h3>Pick the plan you want to grant</h3>
                  </div>
                  <div class="manage-selected-pill tone-${selectedMeta.tone}">
                    <span>${selectedMeta.emoji}</span>
                    <strong>${escapeHtml(selectedMeta.label)}</strong>
                  </div>
                </div>
                <div class="manage-tier-grid">
                  ${['pending', 'starter', 'pro', 'elite', 'expired'].map((tier) => {
                    const meta = manageTierMeta[tier];
                    return `
                      <button
                        type="button"
                        class="manage-tier-option tone-${meta.tone} ${state.manageForm.tier === tier ? 'selected' : ''}"
                        data-action="pick-manage-tier"
                        data-tier="${tier}"
                      >
                        <span class="manage-tier-emoji">${meta.emoji}</span>
                        <span class="manage-tier-copy">
                          <strong>${escapeHtml(meta.label)}</strong>
                          <small>${escapeHtml(meta.blurb)}</small>
                        </span>
                      </button>
                    `;
                  }).join('')}
                </div>
              </section>

              <section class="manage-card">
                <div class="manage-card-head">
                  <div>
                    <p class="mini-label">Step 2</p>
                    <h3>Choose when it starts and ends</h3>
                  </div>
                </div>
                <div class="manage-dates-grid">
                  <div class="field-wrap">
                    <label for="manageStartsAt">Start date</label>
                    <input id="manageStartsAt" type="date" value="${escapeHtml(state.manageForm.startsAt)}">
                    <p class="field-hint">Leave blank if the school should start this plan immediately.</p>
                  </div>

                  <div class="field-wrap">
                    <label for="manageEndsAt">End date</label>
                    <input id="manageEndsAt" type="date" value="${escapeHtml(state.manageForm.endsAt)}">
                    <p class="field-hint">Leave blank if the plan should stay active with no fixed end.</p>
                  </div>
                </div>
                <div class="manage-quick-grants">
                  <p class="pill-label">Helpful shortcuts</p>
                  <div class="manage-quick-grant-row">
                    <button class="secondary-btn" data-action="apply-days" data-days="30">30 Days</button>
                    <button class="secondary-btn" data-action="apply-days" data-days="60">60 Days</button>
                    <button class="secondary-btn" data-action="apply-days" data-days="90">90 Days</button>
                  </div>
                </div>
              </section>

              <section class="manage-card">
                <div class="manage-card-head">
                  <div>
                    <p class="mini-label">Step 3</p>
                    <h3>Leave yourself a note</h3>
                  </div>
                </div>
                <div class="field-wrap">
                  <label for="manageNotes">Why are you changing this?</label>
                  <textarea id="manageNotes" placeholder="e.g. Gifted Pro until summer exams.">${escapeHtml(state.manageForm.notes)}</textarea>
                  <p class="field-hint">This is only for you, so future-you remembers why this school was changed.</p>
                </div>
                <div class="manage-save-row">
                  <button class="primary-btn" data-action="save-manage-subscription" ${state.manageLoading ? 'disabled' : ''}>${state.manageLoading ? 'Saving...' : 'Save This Subscription'}</button>
                  <button class="ghost-btn" data-action="reset-manual-overrides" ${state.manageLoading ? 'disabled' : ''}>Clear Dates And Note</button>
                </div>
              </section>
            </div>

            <div class="manage-side-stack">
              <section class="manage-card manage-tips-card">
                <div class="manage-card-head">
                  <div>
                    <p class="mini-label">Helpful Examples</p>
                    <h3>Common things you might want to do</h3>
                  </div>
                </div>
                <div class="manage-example-list">
                  <article class="manage-example">
                    <span>🎁</span>
                    <div>
                      <strong>Temporary gift</strong>
                      <p>Choose Pro or Elite and add an end date.</p>
                    </div>
                  </article>
                  <article class="manage-example">
                    <span>🚪</span>
                    <div>
                      <strong>Lock the school again</strong>
                      <p>Choose Pending so the app shows the paywall.</p>
                    </div>
                  </article>
                  <article class="manage-example">
                    <span>⛔</span>
                    <div>
                      <strong>End access now</strong>
                      <p>Choose Expired when the school should stop immediately.</p>
                    </div>
                  </article>
                </div>
              </section>

              <section class="manage-card danger-card manage-danger-card">
                <div class="manage-card-head">
                  <div>
                    <p class="mini-label">Danger Zone</p>
                    <h3>Delete carefully</h3>
                  </div>
                </div>
                <p>Type <strong>${escapeHtml(state.manageSchoolId)}</strong> before using either delete action.</p>
                <div class="field-wrap">
                  <label for="manageDeleteConfirm">Type the school ID to confirm</label>
                  <input id="manageDeleteConfirm" type="text" value="${escapeHtml(state.manageDeleteConfirm)}" placeholder="${escapeHtml(state.manageSchoolId)}">
                </div>
                <div class="manage-danger-actions">
                  <button class="danger-btn" data-action="delete-school-local" ${deleteReady && !state.manageLoading ? '' : 'disabled'}>Remove From Saved List Only</button>
                  <button class="danger-btn" data-action="delete-school-project" ${deleteReady && !state.manageLoading ? '' : 'disabled'}>Delete Whole School Project</button>
                </div>
                <p class="field-hint">Removing from the saved list keeps Firebase alive. Deleting the whole school project requests deletion of the actual Google/Firebase project too.</p>
              </section>
            </div>
          </div>
        </div>
      ` : schools.length ? `
        <div class="panel manage-empty-state">
          <h3>Choose a school to load its access and payment details</h3>
          <p>The console will then show the live tier, the manual override dates, and the Stripe payment history if the billing server is reachable.</p>
        </div>
      ` : ''}
    </section>
  `;
}

function renderManageHelpModal() {
  return `
    <div class="modal-backdrop" data-action="close-manage-help">
      <div class="modal-panel manage-help-modal" role="dialog" aria-modal="true" aria-labelledby="manage-help-title" onclick="event.stopPropagation()">
        <div class="manage-help-modal-head">
          <div>
            <p class="mini-label">How This Works</p>
            <h3 id="manage-help-title">Manual school access, explained simply</h3>
          </div>
          <button type="button" class="info-icon-btn close" data-action="close-manage-help" aria-label="Close the manual school access guide">×</button>
        </div>
        <div class="manage-help-grid manage-help-grid-modal">
          <article class="manage-help-card sunrise wide">
            <div class="manage-help-top">
              <span class="manage-help-icon">🪄</span>
              <div>
                <h4>What this really changes</h4>
                <p class="manage-help-kicker">Live app access for this one school</p>
              </div>
            </div>
            <div class="manage-help-split">
              <p>This updates the school’s <strong>appConfig/subscription</strong> document in Firestore using the same plan rules the live app already understands.</p>
              <div class="manage-help-note">
                <strong>In plain English:</strong> whatever you save here is what the school app will read when deciding whether it should be Pending, Starter, Pro, Elite, or Expired.
              </div>
            </div>
          </article>
          <article class="manage-help-card sky">
            <div class="manage-help-top">
              <span class="manage-help-icon">🗓️</span>
              <div>
                <h4>What the dates do</h4>
                <p class="manage-help-kicker">Dates control when access starts and ends</p>
              </div>
            </div>
            <div class="manage-help-pill-row">
              <span>Future start = Pending</span>
              <span>Past end = Expired</span>
            </div>
            <p>A future start date keeps the school locked until that day. A passed end date means the school has already run out of access.</p>
          </article>
          <article class="manage-help-card mint">
            <div class="manage-help-top">
              <span class="manage-help-icon">🎁</span>
              <div>
                <h4>Helpful use cases</h4>
                <p class="manage-help-kicker">Common quick fixes you may want</p>
              </div>
            </div>
            <div class="manage-help-pill-row">
              <span>30-day Pro gift</span>
              <span>Elite for exam season</span>
              <span>Back to Pending</span>
            </div>
            <p>Use it to gift 30 days of Pro, unlock Elite for exam season, or push a school back to Pending until payment is sorted out.</p>
          </article>
        </div>
      </div>
    </div>
  `;
}

function renderPaymentTimeline(billing) {
  if (!billing?.available) {
    return `
      <div class="empty-box">
        <strong>Stripe payment history is not available right now.</strong><br>
        ${escapeHtml(billing?.message || 'The billing server could not be reached for this school.')}
      </div>
    `;
  }
  if (!billing.recentPayments?.length) {
    return `
      <div class="empty-box">
        <strong>No paid invoices were found yet.</strong><br>
        Stripe is reachable, but there is no recorded paid invoice history for this school yet.
      </div>
    `;
  }
  return `
    <div class="payment-timeline">
      ${billing.recentPayments.map((invoice) => `
        <article class="payment-timeline-item">
          <div class="payment-timeline-icon">${invoice.paid ? '✓' : '•'}</div>
          <div class="payment-timeline-copy">
            <strong>${escapeHtml(formatCurrencyMinor(invoice.amountPaid, invoice.currency))}</strong>
            <p>${escapeHtml(invoice.description || `${capitalize(billing.tier || 'school')} subscription payment`)}</p>
            <small>${escapeHtml(formatDateForDisplay(invoice.paidAt || invoice.createdAt))}${invoice.periodStart || invoice.periodEnd ? ` • ${escapeHtml(formatPeriodLabel(invoice.periodStart, invoice.periodEnd))}` : ''}</small>
          </div>
          <div class="payment-timeline-meta">
            <span class="status-pill status-${invoice.paid ? 'done' : 'waiting'}">${escapeHtml(invoice.status || (invoice.paid ? 'paid' : 'pending'))}</span>
            ${invoice.hostedInvoiceUrl ? `<a class="ghost-link" href="${escapeHtml(invoice.hostedInvoiceUrl)}" target="_blank" rel="noreferrer">Invoice</a>` : ''}
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function getBillingTone(billing, fallbackTone = 'pending') {
  if (!billing?.available) return 'pending';
  if (billing.hasSubscription) return 'pro';
  if (billing.hasPaidInvoices) return 'starter';
  return fallbackTone;
}

function getBillingHeadline(billing) {
  if (!billing?.available) return 'Billing server unavailable';
  if (billing.hasSubscription) return 'Paid subscription found';
  if (billing.hasPaidInvoices) return 'Past payments found';
  return 'No Stripe payments yet';
}

function getBillingMessage(billing) {
  return billing?.message
    || 'This card compares the Stripe side with the live access document.';
}

function getGraceTone(grace) {
  if (grace?.active) return 'starter';
  if (grace?.expired) return 'expired';
  return 'pending';
}

function getGraceStatusLabel(grace) {
  if (grace?.active) return 'Active now';
  if (grace?.expired) return 'Used and ended';
  if (grace?.used) return 'Used';
  return 'Not used yet';
}

function getGraceWindowLabel(grace) {
  if (!grace?.used) return 'The one-time setup grace period is still unused.';
  if (grace?.active) {
    return `Started ${formatDateForDisplay(grace.startsAt)} and ends ${formatDateForDisplay(grace.endsAt)}.`;
  }
  return `Started ${formatDateForDisplay(grace?.startsAt)} and ended ${formatDateForDisplay(grace?.endsAt)}.`;
}

function getActiveSinceLabel(value) {
  if (!value) return 'Start date not set';
  const diff = getDayDiffFromNow(value);
  if (diff === null) return 'Start date not clear';
  if (diff < 0) return `Starts in ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'}`;
  if (diff === 0) return 'Started today';
  return `Active for ${diff} day${diff === 1 ? '' : 's'}`;
}

function getRemainingAccessLabel(value) {
  if (!value) return 'No fixed end date';
  const diff = getDayDiffFromNow(value);
  if (diff === null) return 'End date not clear';
  if (diff > 0) return `Ended ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} ago`;
  if (diff === 0) return 'Ends today';
  return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} left`;
}

function getDateRangeProgress(startValue, endValue) {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  if (!start || !end || end <= start) {
    return start && start <= new Date() ? 100 : 12;
  }
  const now = Date.now();
  if (now <= start.getTime()) return 0;
  if (now >= end.getTime()) return 100;
  return Math.max(4, Math.min(100, Math.round(((now - start.getTime()) / (end.getTime() - start.getTime())) * 100)));
}

function getDayDiffFromNow(value) {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return Math.round((startOfToday.getTime() - target.getTime()) / 86400000);
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatBillingPrice(price) {
  if (!price?.unitAmount && price?.unitAmount !== 0) return 'No Stripe price saved';
  const interval = price.interval ? ` / ${price.intervalCount > 1 ? `${price.intervalCount} ${price.interval}s` : price.interval}` : '';
  return `${formatCurrencyMinor(price.unitAmount, price.currency)}${interval}`;
}

function formatCurrencyMinor(amount, currency = 'eur') {
  if (!Number.isFinite(amount)) return 'Not available';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: String(currency || 'eur').toUpperCase(),
    }).format((amount || 0) / 100);
  } catch (error) {
    return `${((amount || 0) / 100).toFixed(2)} ${String(currency || '').toUpperCase()}`.trim();
  }
}

function formatPeriodLabel(startValue, endValue) {
  if (startValue && endValue) {
    return `${formatDateForDisplay(startValue)} to ${formatDateForDisplay(endValue)}`;
  }
  return formatDateForDisplay(startValue || endValue);
}

function bindWelcomeEvents() {
  bindStaticEvents();
  document.querySelector('[data-action="start-new"]')?.addEventListener('click', () => {
    state.mode = 'new';
    state.step = 0;
    state.setupResult = null;
    state.renderPasted = false;
    state.hostingCompleted = createEmptyHostingChecklist();
    render();
  });
  document.querySelector('[data-action="start-recheck"]')?.addEventListener('click', () => {
    state.mode = 'recheck';
    state.recheckResult = null;
    render();
  });
  document.querySelector('[data-action="start-manage"]')?.addEventListener('click', async () => {
    state.mode = 'manage';
    state.manageSubscription = null;
    state.manageDeleteConfirm = '';
    state.manageSchoolSearch = '';
    state.manageHelpOpen = false;
    render();
    if (state.manageSchoolId) {
      await loadManagedSchool();
    }
  });
}

function bindNewSetupEvents() {
  bindStaticEvents();

  const schoolLabel = document.getElementById('schoolLabel');
  const projectId = document.getElementById('projectId');
  const renderUrl = document.getElementById('renderUrl');
  const siteDomain = document.getElementById('siteDomain');
  const readinessTarget = document.getElementById('readinessTarget');
  const firebaseLocation = document.getElementById('firebaseLocation');
  const serviceAccount = document.getElementById('serviceAccount');
  const starterPrice = document.getElementById('starterPrice');
  const proPrice = document.getElementById('proPrice');
  const elitePrice = document.getElementById('elitePrice');
  const savedSchoolFile = document.getElementById('serviceAccountFile');

  schoolLabel?.addEventListener('input', (event) => {
    state.form.schoolLabel = event.target.value;
  });
  projectId?.addEventListener('input', (event) => {
    state.form.projectId = event.target.value.trim();
  });
  renderUrl?.addEventListener('input', (event) => {
    state.form.renderUrl = event.target.value.trim();
  });
  siteDomain?.addEventListener('input', (event) => {
    state.form.siteDomain = event.target.value.trim();
  });
  readinessTarget?.addEventListener('change', (event) => {
    state.form.readinessTarget = event.target.value;
  });
  firebaseLocation?.addEventListener('change', (event) => {
    state.form.firebaseLocation = event.target.value;
  });
  serviceAccount?.addEventListener('input', (event) => {
    state.form.serviceAccount = event.target.value;
    state.serviceAccountSummary = null;
  });
  starterPrice?.addEventListener('input', (event) => {
    state.form.priceIds.starter = event.target.value.trim();
  });
  proPrice?.addEventListener('input', (event) => {
    state.form.priceIds.pro = event.target.value.trim();
  });
  elitePrice?.addEventListener('input', (event) => {
    state.form.priceIds.elite = event.target.value.trim();
  });

  savedSchoolFile?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.form.serviceAccount = await file.text();
    state.serviceAccountSummary = null;
    render();
  });
}

function bindRecheckEvents() {
  bindStaticEvents();
  document.getElementById('savedSchool')?.addEventListener('change', (event) => {
    state.recheckSchoolId = event.target.value;
  });
  document.getElementById('savedReadinessTarget')?.addEventListener('change', (event) => {
    state.form.readinessTarget = event.target.value;
  });
  document.getElementById('savedFirebaseLocation')?.addEventListener('change', (event) => {
    state.form.firebaseLocation = event.target.value;
  });
}

function bindManageEvents() {
  bindStaticEvents();
  document.getElementById('manageSchoolSearch')?.addEventListener('input', (event) => {
    state.manageSchoolSearch = event.target.value;
    render();
  });
  document.getElementById('manageSchool')?.addEventListener('change', (event) => {
    state.manageSchoolId = event.target.value;
    state.manageDeleteConfirm = '';
    state.manageSubscription = null;
    render();
  });
  document.querySelectorAll('[data-action="pick-manage-school"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.manageSchoolId = button.getAttribute('data-school-id') || '';
      state.manageDeleteConfirm = '';
      state.manageSubscription = null;
      render();
    });
  });
  document.querySelectorAll('[data-action="pick-manage-tier"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.manageForm.tier = button.getAttribute('data-tier') || 'pending';
      render();
    });
  });
  document.getElementById('manageStartsAt')?.addEventListener('input', (event) => {
    state.manageForm.startsAt = event.target.value;
  });
  document.getElementById('manageEndsAt')?.addEventListener('input', (event) => {
    state.manageForm.endsAt = event.target.value;
  });
  document.getElementById('manageNotes')?.addEventListener('input', (event) => {
    state.manageForm.notes = event.target.value;
  });
  document.getElementById('manageDeleteConfirm')?.addEventListener('input', (event) => {
    state.manageDeleteConfirm = event.target.value;
    syncManageDeleteButtons();
  });
  document.querySelector('[data-action="load-manage-school"]')?.addEventListener('click', loadManagedSchool);
  document.querySelector('[data-action="save-manage-subscription"]')?.addEventListener('click', saveManagedSubscription);
  document.querySelector('[data-action="reset-manual-overrides"]')?.addEventListener('click', resetManualOverrides);
  document.querySelector('[data-action="open-manage-help"]')?.addEventListener('click', () => {
    state.manageHelpOpen = true;
    render();
  });
  document.querySelectorAll('[data-action="close-manage-help"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.manageHelpOpen = false;
      render();
    });
  });
  document.querySelectorAll('[data-action="apply-days"]').forEach((button) => {
    button.addEventListener('click', () => applyManageDays(Number(button.getAttribute('data-days') || '0')));
  });
  document.querySelector('[data-action="delete-school-local"]')?.addEventListener('click', () => deleteManagedSchool(false));
  document.querySelector('[data-action="delete-school-project"]')?.addEventListener('click', () => deleteManagedSchool(true));
}

function syncManageDeleteButtons() {
  const deleteReady = state.manageDeleteConfirm.trim() === state.manageSchoolId;
  const localDeleteButton = document.querySelector('[data-action="delete-school-local"]');
  const projectDeleteButton = document.querySelector('[data-action="delete-school-project"]');
  const shouldDisable = !deleteReady || state.manageLoading;
  if (localDeleteButton) localDeleteButton.disabled = shouldDisable;
  if (projectDeleteButton) projectDeleteButton.disabled = shouldDisable;
}

function bindStaticEvents() {
  document.querySelector('[data-action="reload-page"]')?.addEventListener('click', () => window.location.reload());
  document.querySelectorAll('[data-action="start-over"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = null;
      state.step = 0;
      state.setupResult = null;
      state.recheckResult = null;
      state.manageSubscription = null;
      state.manageLoading = false;
      state.manageDeleteConfirm = '';
      state.manageSchoolSearch = '';
      state.manageHelpOpen = false;
      state.isRunning = false;
      state.renderPasted = false;
      state.hostingCompleted = createEmptyHostingChecklist();
      state.activity = null;
      render();
    });
  });
  document.querySelectorAll('[data-action="finish-quest"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = null;
      state.step = 0;
      state.setupResult = null;
      state.recheckResult = null;
      state.manageSubscription = null;
      state.manageLoading = false;
      state.manageDeleteConfirm = '';
      state.manageSchoolSearch = '';
      state.manageHelpOpen = false;
      state.renderPasted = false;
      state.hostingCompleted = createEmptyHostingChecklist();
      state.activity = null;
      render();
    });
  });
  document.querySelectorAll('[data-action="set-up-another"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = 'new';
      state.step = 0;
      state.setupResult = null;
      state.renderPasted = false;
      state.hostingCompleted = createEmptyHostingChecklist();
      state.serviceAccountSummary = null;
      state.form.schoolLabel = '';
      state.form.projectId = '';
      state.form.siteDomain = '';
      state.form.serviceAccount = '';
      render();
    });
  });
  document.querySelectorAll('[data-action="back-step"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.step = Math.max(0, state.step - 1);
      render();
    });
  });
  document.querySelector('[data-action="save-details"]')?.addEventListener('click', () => {
    const errors = detailsErrors();
    if (errors.schoolLabel || errors.projectId || errors.renderUrl) {
      render();
      return;
    }
    state.step = 1;
    render();
  });
  document.querySelector('[data-action="validate-key"]')?.addEventListener('click', validateServiceAccount);
  document.querySelectorAll('[data-action="start-bootstrap-login"]').forEach((button) => {
    button.addEventListener('click', startBootstrapLogin);
  });
  document.querySelectorAll('[data-action="refresh-bootstrap-status"]').forEach((button) => {
    button.addEventListener('click', refreshBootstrapStatus);
  });
  document.querySelectorAll('[data-action="set-bootstrap-quota-project"]').forEach((button) => {
    button.addEventListener('click', setBootstrapQuotaProject);
  });
  document.querySelector('[data-action="use-key"]')?.addEventListener('click', () => {
    if (!state.serviceAccountSummary?.matchesProject) return;
    state.step = 2;
    render();
  });
  document.querySelector('[data-action="load-saved-prices"]')?.addEventListener('click', () => {
    state.form.priceIds = {
      starter: state.bootstrap.defaults.priceIds?.starter || '',
      pro: state.bootstrap.defaults.priceIds?.pro || '',
      elite: state.bootstrap.defaults.priceIds?.elite || '',
    };
    render();
  });
  document.querySelector('[data-action="save-billing"]')?.addEventListener('click', () => {
    const errors = billingErrors();
    if (errors.starter || errors.pro || errors.elite) {
      render();
      return;
    }
    state.step = 3;
    render();
  });
  document.querySelector('[data-action="run-setup"]')?.addEventListener('click', runSetup);
  document.querySelector('[data-action="retry-setup"]')?.addEventListener('click', runSetup);
  document.querySelector('[data-action="continue-final"]')?.addEventListener('click', () => {
    state.step = 4;
    render();
  });
  document.querySelector('[data-action="run-recheck"]')?.addEventListener('click', runRecheck);
  document.querySelectorAll('[data-action="pick-hosting-provider"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.hostingProvider = button.getAttribute('data-provider') || 'netlify';
      render();
    });
  });
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const field = button.getAttribute('data-copy');
      const outputs = state.mode === 'recheck' ? state.recheckResult?.outputs : state.setupResult?.outputs;
      const selectedTarget = getSelectedHostingTarget(outputs);
      const source = field === 'hostingEnv'
        ? selectedTarget?.envText
        : outputs?.[field];
      if (!source) return;
      await navigator.clipboard.writeText(source);
      button.textContent = 'Copied';
      setTimeout(() => {
        button.textContent = field === 'renderJson'
          ? 'Copy Render Value'
          : (selectedTarget?.copyLabel || 'Copy Hosting Values');
      }, 1400);
    });
  });
  document.querySelector('[data-action="download-hosting-inline"]')?.addEventListener('click', downloadInlineHostingEnv);
  document.querySelector('[data-action="download-hosting-saved"]')?.addEventListener('click', downloadSavedHostingEnv);
  document.querySelector('[data-action="download-hosting-managed"]')?.addEventListener('click', downloadManagedHostingEnv);
  document.querySelector('[data-toggle="render-pasted"]')?.addEventListener('change', (event) => {
    state.renderPasted = event.target.checked;
    render();
  });
  document.querySelector('[data-toggle="hosting-completed"]')?.addEventListener('change', (event) => {
    state.hostingCompleted[state.hostingProvider] = event.target.checked;
    render();
  });
}

async function validateServiceAccount() {
  state.activity = {
    tone: 'info',
    title: 'Checking the Firebase key',
    description: 'Confirming that the service account is valid and belongs to the school project you typed.',
    progress: 36,
  };
  render();
  try {
    const payload = {
      projectId: state.form.projectId.trim(),
      serviceAccount: state.form.serviceAccount,
    };
    const result = await api('/api/validate-service-account', {
      method: 'POST',
      body: payload,
    });
    state.serviceAccountSummary = {
      ...result.summary,
      message: result.message,
    };
  } catch (error) {
    state.serviceAccountSummary = {
      projectId: '',
      clientEmail: '',
      looksValid: false,
      matchesProject: false,
      message: error.message || 'The key could not be checked.',
    };
  } finally {
    state.activity = null;
  }
  render();
}

async function runSetup() {
  state.isRunning = true;
  state.setupResult = null;
  state.activity = {
    tone: 'info',
    title: 'Running automatic setup',
    description: 'Working through Firebase, billing, rules, indexes, and hosting outputs for this school.',
    progress: 62,
  };
  render();
  try {
    const result = await api('/api/run-setup', {
      method: 'POST',
      body: {
        schoolLabel: state.form.schoolLabel.trim(),
        projectId: state.form.projectId.trim(),
        renderUrl: state.form.renderUrl.trim(),
        siteDomain: state.form.siteDomain.trim(),
        readinessTarget: state.form.readinessTarget,
        firebaseLocation: state.form.firebaseLocation,
        serviceAccount: state.form.serviceAccount,
        priceIds: state.form.priceIds,
      },
    });
    state.setupResult = result;
    state.bootstrap = await api('/api/bootstrap');
    state.renderPasted = false;
    state.hostingCompleted = createEmptyHostingChecklist();
  } catch (error) {
    state.setupResult = {
      finalStatus: 'needs_attention',
      summary: error.message || 'The setup could not finish.',
      tasks: [
        {
          task: 'finalHealth',
          status: 'needs_attention',
          title: 'Automatic setup',
          message: error.message || 'Something went wrong during automatic setup.',
          actionHint: 'Fix the message above, then click Try Again.',
          technicalDetails: Array.isArray(error.details) ? error.details.join('\n') : '',
        },
      ],
      outputs: {
        renderJson: '',
        hostingTargets: {},
        netlifyVars: '',
      },
    };
  } finally {
    state.isRunning = false;
    state.activity = null;
    render();
  }
}

async function startBootstrapLogin() {
  try {
    const result = await api('/api/start-bootstrap-login', {
      method: 'POST',
      body: {},
    });
    window.alert(result.message);
  } catch (error) {
    window.alert(error.message || 'Google sign-in could not be started from the tool.');
  }
}

async function refreshBootstrapStatus() {
  try {
    state.activity = {
      tone: 'info',
      title: 'Refreshing Google login status',
      description: 'Checking whether the local admin login is ready for school provisioning tasks.',
      progress: 42,
    };
    render();
    state.bootstrap = await api('/api/bootstrap');
    render();
    const status = state.bootstrap.bootstrapAdmin || {};
    window.alert(status.available
      ? 'Google admin login is ready on this machine.'
      : `${status.message || 'Google admin login is still not ready.'}${status.technicalDetails ? `\n\nDetails: ${status.technicalDetails}` : ''}`);
  } catch (error) {
    window.alert(error.message || 'Google login status could not be refreshed.');
  } finally {
    state.activity = null;
  }
}

async function setBootstrapQuotaProject() {
  const projectId = state.form.projectId?.trim() || state.bootstrap.defaults?.lastProjectId || state.recheckSchoolId;
  try {
    state.activity = {
      tone: 'info',
      title: 'Setting the Google quota project',
      description: 'Linking the local Google admin login to the school project you are working on.',
      progress: 48,
    };
    render();
    const result = await api('/api/set-bootstrap-quota-project', {
      method: 'POST',
      body: {
        projectId,
      },
    });
    window.alert(result.message);
    state.bootstrap = await api('/api/bootstrap');
    render();
  } catch (error) {
    window.alert(error.message || 'The Google login quota project could not be set.');
  } finally {
    state.activity = null;
  }
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function downloadInlineHostingEnv() {
  const projectId = state.form.projectId.trim() || 'school';
  const target = getSelectedHostingTarget(state.setupResult?.outputs);
  const content = target?.envText || '';
  if (!content) return;
  downloadTextFile(target?.envFilename || `${projectId}.${state.hostingProvider}.env`, content + '\n');
}

async function downloadSavedHostingEnv() {
  if (!state.recheckSchoolId) return;
  try {
    const response = await fetch(`/api/download-hosting-env?projectId=${encodeURIComponent(state.recheckSchoolId)}&provider=${encodeURIComponent(state.hostingProvider)}&mode=saved`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'The hosting env file could not be downloaded.');
    }
    const text = await response.text();
    const target = getSelectedHostingTarget(state.recheckResult?.outputs);
    downloadTextFile(target?.envFilename || `${state.recheckSchoolId}.${state.hostingProvider}.env`, text);
  } catch (error) {
    window.alert(error.message || 'The hosting env file could not be downloaded.');
  }
}

async function downloadManagedHostingEnv() {
  if (!state.manageSchoolId) return;
  try {
    const response = await fetch(`/api/download-hosting-env?projectId=${encodeURIComponent(state.manageSchoolId)}&provider=${encodeURIComponent(state.hostingProvider)}&mode=saved`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'The hosting env file could not be downloaded.');
    }
    const text = await response.text();
    downloadTextFile(`${state.manageSchoolId}.${state.hostingProvider}.env`, text);
  } catch (error) {
    window.alert(error.message || 'The hosting env file could not be downloaded.');
  }
}

async function runRecheck() {
  state.isRunning = true;
  state.recheckResult = null;
  state.activity = {
    tone: 'info',
    title: 'Checking the saved school',
    description: 'Rerunning the safe config, paywall, index, and hosting checks for the selected school.',
    progress: 56,
  };
  render();
  try {
    const result = await api('/api/recheck', {
      method: 'POST',
      body: {
        projectId: state.recheckSchoolId,
        readinessTarget: state.form.readinessTarget,
        firebaseLocation: state.form.firebaseLocation,
      },
    });
    state.recheckResult = result;
    state.bootstrap = await api('/api/bootstrap');
  } catch (error) {
    state.recheckResult = {
      finalStatus: 'needs_attention',
      summary: error.message || 'The school check could not finish.',
      tasks: [
        {
          task: 'finalHealth',
          status: 'needs_attention',
          title: 'School check',
          message: error.message || 'Something went wrong during the school check.',
          actionHint: 'Fix the issue above, then run the check again.',
          technicalDetails: Array.isArray(error.details) ? error.details.join('\n') : '',
        },
      ],
      outputs: {
        renderJson: '',
        hostingTargets: {},
        netlifyVars: '',
      },
    };
  } finally {
    state.isRunning = false;
    state.activity = null;
    render();
  }
}

async function loadManagedSchool() {
  if (!state.manageSchoolId) return;
  state.manageLoading = true;
  state.activity = {
    tone: 'info',
    title: 'Loading school subscription details',
    description: 'Pulling the saved access document and checking the Stripe payment history for this school.',
    progress: 44,
  };
  render();
  try {
    const result = await api(`/api/school-subscription?projectId=${encodeURIComponent(state.manageSchoolId)}`);
    state.manageSubscription = result;
    state.manageForm = {
      tier: result.subscription?.tier || 'pending',
      startsAt: formatDateForInput(result.subscription?.startsAt),
      endsAt: formatDateForInput(result.subscription?.endsAt),
      notes: result.subscription?.notes || '',
    };
    state.manageDeleteConfirm = '';
  } catch (error) {
    window.alert(error.message || 'The school details could not be loaded.');
  } finally {
    state.manageLoading = false;
    state.activity = null;
    render();
  }
}

async function saveManagedSubscription() {
  if (!state.manageSchoolId) return;
  state.manageLoading = true;
  state.activity = {
    tone: 'info',
    title: 'Saving the manual school access',
    description: 'Updating the live access document so the school app sees the new plan and dates.',
    progress: 82,
  };
  render();
  try {
    const result = await api('/api/update-school-subscription', {
      method: 'POST',
      body: {
        projectId: state.manageSchoolId,
        tier: state.manageForm.tier,
        startsAt: state.manageForm.startsAt,
        endsAt: state.manageForm.endsAt,
        notes: state.manageForm.notes,
        source: 'manual',
      },
    });
    state.manageSubscription = result;
    state.manageForm = {
      tier: result.subscription?.tier || state.manageForm.tier,
      startsAt: formatDateForInput(result.subscription?.startsAt),
      endsAt: formatDateForInput(result.subscription?.endsAt),
      notes: result.subscription?.notes || '',
    };
    window.alert(result.message || 'The subscription was saved.');
  } catch (error) {
    window.alert(error.message || 'The subscription could not be saved.');
  } finally {
    state.manageLoading = false;
    state.activity = null;
    render();
  }
}

function applyManageDays(days) {
  if (!Number.isFinite(days) || days <= 0) return;
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days);
  state.manageForm.startsAt = formatDateForInput(start.toISOString());
  state.manageForm.endsAt = formatDateForInput(end.toISOString());
  render();
}

function resetManualOverrides() {
  state.manageForm.startsAt = '';
  state.manageForm.endsAt = '';
  state.manageForm.notes = '';
  render();
}

async function deleteManagedSchool(deleteProject) {
  if (!state.manageSchoolId) return;
  const actionLabel = deleteProject ? 'delete the whole school project' : 'remove the school from your saved list';
  if (state.manageDeleteConfirm.trim() !== state.manageSchoolId) {
    window.alert(`Type ${state.manageSchoolId} first before you ${actionLabel}.`);
    return;
  }
  const confirmed = window.confirm(deleteProject
    ? `This will request deletion of the whole Google/Firebase project for ${state.manageSchoolId} and remove it from your saved list. Continue?`
    : `This will remove ${state.manageSchoolId} from your local saved list only. Continue?`);
  if (!confirmed) return;

  state.manageLoading = true;
  state.activity = {
    tone: 'warning',
    title: deleteProject ? 'Deleting the school project' : 'Removing the saved school',
    description: deleteProject
      ? 'Requesting project deletion and removing the school from your saved local list.'
      : 'Removing only the local saved school record from this machine.',
    progress: 88,
  };
  render();
  try {
    const result = await api('/api/delete-saved-school', {
      method: 'POST',
      body: {
        projectId: state.manageSchoolId,
        deleteProject,
      },
    });
    window.alert(result.message);
    state.bootstrap = await api('/api/bootstrap');
    state.manageSchoolId = state.bootstrap.schools[0]?.schoolId || '';
    state.manageSubscription = null;
    state.manageDeleteConfirm = '';
    if (state.manageSchoolId) {
      await loadManagedSchool();
      return;
    }
  } catch (error) {
    window.alert(error.message || 'The school could not be deleted.');
  } finally {
    state.manageLoading = false;
    state.activity = null;
    render();
  }
}

function detailsErrors() {
  return {
    schoolLabel: state.form.schoolLabel.trim() ? '' : 'Please give this school a friendly label.',
    projectId: /^[a-z0-9-]{4,40}$/.test(state.form.projectId.trim())
      ? ''
      : 'Please enter a Firebase project ID using lowercase letters, numbers, and hyphens.',
    renderUrl: isValidHttpUrl(state.form.renderUrl.trim())
      ? ''
      : 'Please enter the full Render billing URL.',
    siteDomain: isValidHostedDomain(state.form.siteDomain.trim())
      ? ''
      : 'Please enter the live school site domain, such as gcq-test-school.netlify.app or your-school.pages.dev.',
  };
}

function isValidHostedDomain(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host);
  } catch (error) {
    return false;
  }
}

function billingErrors() {
  return {
    starter: /^price_/i.test(state.form.priceIds.starter || '') ? '' : 'Add the Starter Stripe price ID.',
    pro: /^price_/i.test(state.form.priceIds.pro || '') ? '' : 'Add the Pro Stripe price ID.',
    elite: /^price_/i.test(state.form.priceIds.elite || '') ? '' : 'Add the Elite Stripe price ID.',
  };
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return /^https?:$/.test(parsed.protocol);
  } catch (error) {
    return false;
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Request failed.');
    error.details = payload.details;
    throw error;
  }
  return payload;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function formatDateForInput(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function formatDateForDisplay(value) {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}
