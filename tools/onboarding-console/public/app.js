const app = document.getElementById('app');

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
  isRunning: false,
  renderPasted: false,
  netlifyPasted: false,
};

const taskIcons = {
  saveSchool: 'fa-book-open',
  copyKey: 'fa-key',
  bootstrapLogin: 'fa-user-shield',
  grantServiceUsageRoles: 'fa-id-badge',
  checkFirebase: 'fa-plug-circle-check',
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
  netlifyOutput: 'fa-globe',
  finalHealth: 'fa-heart-circle-check',
  savedSchool: 'fa-folder-open',
  subscriptionCheck: 'fa-receipt',
};

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
  const data = await api('/api/bootstrap');
  state.bootstrap = data;
  state.form.schoolLabel = data.defaults.lastSchoolLabel || '';
  state.form.projectId = data.defaults.lastProjectId || '';
  state.form.renderUrl = data.defaults.renderUrl || '';
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
  render();
}

function render() {
  if (state.loading) {
    app.innerHTML = `
      <div class="loading-card">
        <div class="spinner"></div>
        <p>Loading your onboarding console...</p>
      </div>
    `;
    return;
  }

  if (!state.mode) {
    app.innerHTML = renderWelcome();
    bindWelcomeEvents();
    return;
  }

  if (state.mode === 'recheck') {
    app.innerHTML = renderRecheck();
    bindRecheckEvents();
    return;
  }

  if (state.mode === 'manage') {
    app.innerHTML = renderManageSchools();
    bindManageEvents();
    return;
  }

  app.innerHTML = renderNewSetup();
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
            <p>Use the guided wizard, let the console do the automatic checks, then paste the final values into Render and Netlify.</p>
            <button class="primary-btn" data-action="start-new">Start Setup</button>
          </article>

          <article class="choice-card">
            <h3>Check an existing school</h3>
            <p>Choose a saved school and rerun the safe checks to make sure its config, paywall, and indexes still look right.</p>
            <button class="secondary-btn" data-action="start-recheck">Check an Existing School</button>
          </article>

          <article class="choice-card">
            <h3>Manage saved schools</h3>
            <p>Open a school from your saved list, view its current subscription, and manually grant Starter, Pro, Elite, Pending, or Expired with an optional date range.</p>
            <button class="secondary-btn" data-action="start-manage">Manage Saved Schools</button>
          </article>
        </div>
      </div>
    </section>
  `;
}

function renderNewSetup() {
  return `
    <section class="step-layout">
      <aside class="progress-card panel">
        <p class="eyebrow">Setup path</p>
        <h2 class="panel-title">One clear step at a time</h2>
        <p class="small-note">You can go back safely at any point before the automatic setup step.</p>
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
      <p class="step-subtitle">Tell me which school you are preparing, and where your billing server lives.</p>
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
            <label for="readinessTarget">What are you preparing today?</label>
            <select id="readinessTarget">
              <option value="starter" ${state.form.readinessTarget === 'starter' ? 'selected' : ''}>Starter / paywall only</option>
              <option value="pro" ${state.form.readinessTarget === 'pro' ? 'selected' : ''}>Pro / Elite ready</option>
            </select>
            <p class="field-hint">Starter keeps things lighter. Pro / Elite ready also prepares Firebase Storage for image features.</p>
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
      ${state.setupResult ? renderTaskList(state.setupResult.tasks) : `
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
  const ready = result?.finalStatus === 'ready' && state.renderPasted && state.netlifyPasted;
  const bannerStatus = result?.finalStatus === 'ready' ? 'ready' : 'needs_attention';
  return `
    ${stepHeader}
    <p class="step-subtitle">These are the last two things you need to do. Copy each block exactly as shown, paste it in the right place, then deploy.</p>

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
            <h3>Step 2: Paste these into Netlify</h3>
            <p>Open the school site in Netlify -> Site configuration -> Environment variables, then add these values and deploy the site.</p>
          </div>
          <div class="button-row">
            <button class="copy-btn" data-copy="netlifyVars" ${!result?.outputs?.netlifyVars ? 'disabled' : ''}>Copy Netlify Values</button>
            <button class="secondary-btn" data-action="download-netlify-inline" ${!result?.outputs?.netlifyVars ? 'disabled' : ''}>Download .env File</button>
          </div>
        </div>
        <pre class="output-box">${escapeHtml(result?.outputs?.netlifyVars || 'The Netlify values will appear here after automatic setup runs.')}</pre>
        <label class="checkline">
          <input type="checkbox" data-toggle="netlify-pasted" ${state.netlifyPasted ? 'checked' : ''}>
          I pasted these into Netlify
        </label>
      </section>
    </div>

    ${ready ? `
      <section class="quest-complete">
        <div class="quest-complete-glow"></div>
        <div class="quest-complete-copy">
          <p class="eyebrow">Quest Complete</p>
          <h3>This school is fully ready.</h3>
          <p>Render is updated, Netlify is prepared, and this onboarding run is complete. You can move on to the next school whenever you want.</p>
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
              </select>
              <p class="field-hint">Use Pro / Elite ready later when an existing school upgrades and now needs Storage image features.</p>
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
                  <h3>Netlify values</h3>
                  <p>This is the current set of values for the school site in Netlify.</p>
                </div>
                <div class="button-row">
                  <button class="copy-btn" data-copy="netlifyVars" ${!state.recheckResult.outputs.netlifyVars ? 'disabled' : ''}>Copy Netlify Values</button>
                  <button class="secondary-btn" data-action="download-netlify-saved" ${!state.recheckResult.outputs.netlifyVars ? 'disabled' : ''}>Download .env File</button>
                </div>
              </div>
              <pre class="output-box">${escapeHtml(state.recheckResult.outputs.netlifyVars || 'No Netlify values available yet.')}</pre>
            </section>
          </div>
        </div>
      ` : ''}
    </section>
  `;
}

function renderManageSchools() {
  const details = state.manageSubscription;
  const subscription = details?.subscription || null;
  const currentTier = subscription?.tier || 'missing';
  const effectiveTier = subscription?.effectiveTier || 'pending';
  const deleteReady = state.manageDeleteConfirm.trim() === state.manageSchoolId;
  return `
    <section class="welcome-grid">
      <div class="panel">
        <p class="eyebrow">Saved school admin</p>
        <h2 class="panel-title">Manage a saved school subscription</h2>
        <p class="panel-subtitle">Use this when you want to grant Starter, Pro, or Elite manually, lock a school back to Pending, or give access for a specific date range.</p>

        ${state.bootstrap.schools.length === 0 ? `
          <div class="empty-box">
            You do not have any saved schools yet. Run the new school setup first, then this screen will let you manage them.
          </div>
        ` : `
          <div class="field-grid">
            <div class="field-wrap">
              <label for="manageSchool">Saved school</label>
              <select id="manageSchool">
                ${state.bootstrap.schools.map((school) => `
                  <option value="${escapeHtml(school.schoolId)}" ${state.manageSchoolId === school.schoolId ? 'selected' : ''}>
                    ${escapeHtml(school.schoolLabel || school.schoolId)} (${escapeHtml(school.schoolId)})
                  </option>
                `).join('')}
              </select>
              <p class="field-hint">Choose the school you want to manage from your local saved list.</p>
            </div>

            <div class="button-row">
              <button class="secondary-btn" data-action="load-manage-school" ${state.manageLoading ? 'disabled' : ''}>${state.manageLoading ? 'Loading...' : 'Load School Details'}</button>
              <button class="ghost-btn" data-action="start-over">Back to Home</button>
            </div>
          </div>
        `}
      </div>

      <div class="panel">
        <div class="helper-cards">
          <article class="helper-card">
            <h4>What does this change?</h4>
            <p>This writes the school’s <strong>appConfig/subscription</strong> document in Firestore using the same tier presets the app already understands.</p>
          </article>
          <article class="helper-card">
            <h4>What do the dates mean?</h4>
            <p>If you add a start date in the future, the app will treat the school as Pending until that date. If you add an end date, the app will treat the school as Expired after that date.</p>
          </article>
          <article class="helper-card">
            <h4>Will the tool remember my schools?</h4>
            <p>Yes. The list comes from your saved local billing records, so you can reopen the same school later and manage it again.</p>
          </article>
        </div>
      </div>

      ${details ? `
        <div class="result-card" style="grid-column: 1 / -1;">
          <div class="summary-card subscription-hero" style="margin-bottom:18px;">
            <div>
              <h3 class="mini-label">Current subscription snapshot</h3>
              <p class="field-hint" style="margin-top:10px;">School: <strong>${escapeHtml(details.school.schoolLabel || details.school.schoolId)}</strong> (${escapeHtml(details.school.schoolId)})</p>
            </div>
            <div class="button-row">
              <button class="secondary-btn" data-action="download-netlify-managed">Download Netlify .env</button>
            </div>
            <div class="summary-grid">
              <div class="summary-pill">
                <div class="pill-label">Saved tier</div>
                <div class="pill-value">${escapeHtml(capitalize(currentTier))}</div>
              </div>
              <div class="summary-pill">
                <div class="pill-label">Effective right now</div>
                <div class="pill-value">${escapeHtml(capitalize(effectiveTier))}</div>
              </div>
              <div class="summary-pill">
                <div class="pill-label">Starts</div>
                <div class="pill-value">${escapeHtml(formatDateForDisplay(subscription?.startsAt))}</div>
              </div>
              <div class="summary-pill">
                <div class="pill-label">Ends</div>
                <div class="pill-value">${escapeHtml(formatDateForDisplay(subscription?.endsAt))}</div>
              </div>
            </div>
            <p class="field-hint" style="margin-top:14px;">${escapeHtml(subscription?.message || '')}</p>
          </div>

          ${state.manageLoading ? `
            <div class="loading-inline">
              <div class="spinner"></div>
              <p>Working on this school now...</p>
            </div>
          ` : ''}

          <div class="grid-two">
            <div class="field-grid">
              <div class="field-wrap">
                <label for="manageTier">Grant this tier</label>
                <select id="manageTier">
                  ${['pending', 'starter', 'pro', 'elite', 'expired'].map((tier) => `
                    <option value="${tier}" ${state.manageForm.tier === tier ? 'selected' : ''}>${capitalize(tier)}</option>
                  `).join('')}
                </select>
                <p class="field-hint">Pick the plan or locked state you want the school to have.</p>
              </div>

              <div class="field-wrap">
                <label for="manageStartsAt">Start date (optional)</label>
                <input id="manageStartsAt" type="date" value="${escapeHtml(state.manageForm.startsAt)}">
                <p class="field-hint">Leave empty to start immediately.</p>
              </div>

              <div class="field-wrap">
                <label for="manageEndsAt">End date (optional)</label>
                <input id="manageEndsAt" type="date" value="${escapeHtml(state.manageForm.endsAt)}">
                <p class="field-hint">Leave empty for no automatic end date.</p>
              </div>

              <div class="field-wrap">
                <label>Quick grant buttons</label>
                <div class="button-row">
                  <button class="secondary-btn" data-action="apply-days" data-days="30">Grant 30 Days</button>
                  <button class="secondary-btn" data-action="apply-days" data-days="60">Grant 60 Days</button>
                  <button class="secondary-btn" data-action="apply-days" data-days="90">Grant 90 Days</button>
                </div>
                <p class="field-hint">These set the start date to today and the end date automatically.</p>
              </div>

              <div class="field-wrap">
                <label for="manageNotes">Notes for yourself (optional)</label>
                <textarea id="manageNotes" placeholder="e.g. Gifted Pro until summer exams.">${escapeHtml(state.manageForm.notes)}</textarea>
                <p class="field-hint">This is stored in the subscription doc so you can remember why you changed it.</p>
              </div>

              <div class="button-row">
                <button class="primary-btn" data-action="save-manage-subscription" ${state.manageLoading ? 'disabled' : ''}>${state.manageLoading ? 'Saving...' : 'Save Subscription'}</button>
                <button class="ghost-btn" data-action="reset-manual-overrides" ${state.manageLoading ? 'disabled' : ''}>Clear Manual Dates/Notes</button>
              </div>
            </div>

            <div class="helper-cards">
              <article class="helper-card">
                <h4>Examples</h4>
                <p>Set <strong>Elite</strong> with an end date for a temporary gift. Set <strong>Pending</strong> to lock the school until payment. Set <strong>Expired</strong> if access should end immediately.</p>
              </article>
              <article class="helper-card">
                <h4>What happens in the app?</h4>
                <p>The live school app will read this Firestore document. If the start date is in the future it behaves like Pending; if the end date is in the past it behaves like Expired.</p>
              </article>
              <article class="helper-card danger-card">
                <h4>Danger zone</h4>
                <p>Type <strong>${escapeHtml(state.manageSchoolId)}</strong> below before using either delete button.</p>
                <div class="field-wrap">
                  <label for="manageDeleteConfirm">Type the school ID to confirm</label>
                  <input id="manageDeleteConfirm" type="text" value="${escapeHtml(state.manageDeleteConfirm)}" placeholder="${escapeHtml(state.manageSchoolId)}">
                </div>
                <div class="button-row">
                  <button class="danger-btn" data-action="delete-school-local" ${deleteReady && !state.manageLoading ? '' : 'disabled'}>Remove From Saved List Only</button>
                  <button class="danger-btn" data-action="delete-school-project" ${deleteReady && !state.manageLoading ? '' : 'disabled'}>Delete Whole School Project</button>
                </div>
                <p class="field-hint">Remove from saved list only keeps the Firebase project alive. Delete whole school project requests deletion of the actual Google/Firebase project and also removes it from your saved list.</p>
              </article>
            </div>
          </div>
        </div>
      ` : ''}
    </section>
  `;
}

function bindWelcomeEvents() {
  bindStaticEvents();
  document.querySelector('[data-action="start-new"]')?.addEventListener('click', () => {
    state.mode = 'new';
    state.step = 0;
    state.setupResult = null;
    state.renderPasted = false;
    state.netlifyPasted = false;
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
  document.getElementById('manageSchool')?.addEventListener('change', (event) => {
    state.manageSchoolId = event.target.value;
    state.manageDeleteConfirm = '';
  });
  document.getElementById('manageTier')?.addEventListener('change', (event) => {
    state.manageForm.tier = event.target.value;
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
  });
  document.querySelector('[data-action="load-manage-school"]')?.addEventListener('click', loadManagedSchool);
  document.querySelector('[data-action="save-manage-subscription"]')?.addEventListener('click', saveManagedSubscription);
  document.querySelector('[data-action="reset-manual-overrides"]')?.addEventListener('click', resetManualOverrides);
  document.querySelector('[data-action="download-netlify-managed"]')?.addEventListener('click', downloadManagedNetlifyEnv);
  document.querySelectorAll('[data-action="apply-days"]').forEach((button) => {
    button.addEventListener('click', () => applyManageDays(Number(button.getAttribute('data-days') || '0')));
  });
  document.querySelector('[data-action="delete-school-local"]')?.addEventListener('click', () => deleteManagedSchool(false));
  document.querySelector('[data-action="delete-school-project"]')?.addEventListener('click', () => deleteManagedSchool(true));
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
      state.isRunning = false;
      state.renderPasted = false;
      state.netlifyPasted = false;
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
      state.renderPasted = false;
      state.netlifyPasted = false;
      render();
    });
  });
  document.querySelectorAll('[data-action="set-up-another"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = 'new';
      state.step = 0;
      state.setupResult = null;
      state.renderPasted = false;
      state.netlifyPasted = false;
      state.serviceAccountSummary = null;
      state.form.schoolLabel = '';
      state.form.projectId = '';
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
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const field = button.getAttribute('data-copy');
      const source = state.mode === 'recheck' ? state.recheckResult?.outputs?.[field] : state.setupResult?.outputs?.[field];
      if (!source) return;
      await navigator.clipboard.writeText(source);
      button.textContent = 'Copied';
      setTimeout(() => {
        button.textContent = field === 'renderJson' ? 'Copy Render Value' : 'Copy Netlify Values';
      }, 1400);
    });
  });
  document.querySelector('[data-action="download-netlify-inline"]')?.addEventListener('click', downloadInlineNetlifyEnv);
  document.querySelector('[data-action="download-netlify-saved"]')?.addEventListener('click', downloadSavedNetlifyEnv);
  document.querySelector('[data-toggle="render-pasted"]')?.addEventListener('change', (event) => {
    state.renderPasted = event.target.checked;
    render();
  });
  document.querySelector('[data-toggle="netlify-pasted"]')?.addEventListener('change', (event) => {
    state.netlifyPasted = event.target.checked;
    render();
  });
}

async function validateServiceAccount() {
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
  }
  render();
}

async function runSetup() {
  state.isRunning = true;
  state.setupResult = null;
  render();
  try {
    const result = await api('/api/run-setup', {
      method: 'POST',
      body: {
        schoolLabel: state.form.schoolLabel.trim(),
        projectId: state.form.projectId.trim(),
        renderUrl: state.form.renderUrl.trim(),
        readinessTarget: state.form.readinessTarget,
        firebaseLocation: state.form.firebaseLocation,
        serviceAccount: state.form.serviceAccount,
        priceIds: state.form.priceIds,
      },
    });
    state.setupResult = result;
    state.bootstrap = await api('/api/bootstrap');
    state.renderPasted = false;
    state.netlifyPasted = false;
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
        netlifyVars: '',
      },
    };
  } finally {
    state.isRunning = false;
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
    state.bootstrap = await api('/api/bootstrap');
    render();
    const status = state.bootstrap.bootstrapAdmin || {};
    window.alert(status.available
      ? 'Google admin login is ready on this machine.'
      : `${status.message || 'Google admin login is still not ready.'}${status.technicalDetails ? `\n\nDetails: ${status.technicalDetails}` : ''}`);
  } catch (error) {
    window.alert(error.message || 'Google login status could not be refreshed.');
  }
}

async function setBootstrapQuotaProject() {
  const projectId = state.form.projectId?.trim() || state.bootstrap.defaults?.lastProjectId || state.recheckSchoolId;
  try {
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

async function downloadInlineNetlifyEnv() {
  const projectId = state.form.projectId.trim() || 'school';
  const content = state.setupResult?.outputs?.netlifyVars || '';
  if (!content) return;
  downloadTextFile(`${projectId}.netlify.env`, content + '\n');
}

async function downloadSavedNetlifyEnv() {
  if (!state.recheckSchoolId) return;
  try {
    const response = await fetch(`/api/download-netlify-env?projectId=${encodeURIComponent(state.recheckSchoolId)}&mode=saved`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'The Netlify env file could not be downloaded.');
    }
    const text = await response.text();
    downloadTextFile(`${state.recheckSchoolId}.netlify.env`, text);
  } catch (error) {
    window.alert(error.message || 'The Netlify env file could not be downloaded.');
  }
}

async function downloadManagedNetlifyEnv() {
  if (!state.manageSchoolId) return;
  try {
    const response = await fetch(`/api/download-netlify-env?projectId=${encodeURIComponent(state.manageSchoolId)}&mode=saved`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'The Netlify env file could not be downloaded.');
    }
    const text = await response.text();
    downloadTextFile(`${state.manageSchoolId}.netlify.env`, text);
  } catch (error) {
    window.alert(error.message || 'The Netlify env file could not be downloaded.');
  }
}

async function runRecheck() {
  state.isRunning = true;
  state.recheckResult = null;
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
        netlifyVars: '',
      },
    };
  } finally {
    state.isRunning = false;
    render();
  }
}

async function loadManagedSchool() {
  if (!state.manageSchoolId) return;
  state.manageLoading = true;
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
    render();
  }
}

async function saveManagedSubscription() {
  if (!state.manageSchoolId) return;
  state.manageLoading = true;
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
  };
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
