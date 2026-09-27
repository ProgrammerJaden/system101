  const STORAGE = 'life-system-v2';
  const LEGACY_MIGRATION = 'life-system-cloud-migrated-v1';
  const names = ['Physical', 'Mental', 'Social', 'Financial', 'Spiritual'];
  const swotSections = ['strengths', 'weaknesses', 'opportunities', 'threats'];
  const $ = id => document.getElementById(id);

  function defaultState() {
    return {
      profile: { name: 'Jaden', level: '1', title: 'Dr', rank: 'D', motto: 'I do my best no matter what.' },
      tasks: [],
      events: {},
      stats: { Physical: 0, Mental: 0, Social: 0, Financial: 0, Spiritual: 0 },
      inventory: 'Laptop, Notebook, Pen',
      skills: 'HTML, CSS, JavaScript, Python',
      notifications: 'No new notifications.',
      swot: {
        strengths: ['Curiosity', 'Persistence'],
        weaknesses: ['Distractions', 'Inconsistent routines'],
        opportunities: ['Build useful projects', 'Learn consistently'],
        threats: ['Burnout', 'Overcommitting']
      }
    };
  }

  function normalizeState(value) {
    const defaults = defaultState();
    const saved = value && typeof value === 'object' ? value : {};
    return {
      ...defaults,
      ...saved,
      profile: { ...defaults.profile, ...(saved.profile || {}) },
      stats: { ...defaults.stats, ...(saved.stats || {}) },
      tasks: Array.isArray(saved.tasks) ? saved.tasks : defaults.tasks,
      events: saved.events && typeof saved.events === 'object' ? saved.events : defaults.events,
      swot: Object.fromEntries(swotSections.map(section => [
        section,
        Array.isArray(saved.swot?.[section]) ? saved.swot[section] : defaults.swot[section]
      ]))
    };
  }

  function readLocalState() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    } catch (error) {
      console.warn('Could not read saved browser data:', error);
    }
    const localState = normalizeState(saved);
    for (const field of ['name', 'level', 'title', 'rank', 'motto']) {
      const value = localStorage.getItem(`life-${field}`);
      if (value !== null && (!saved?.profile || saved.profile[field] === undefined)) {
        localState.profile[field] = value;
      }
    }
    return localState;
  }

  const legacyImportState = readLocalState();
  let state = normalizeState(legacyImportState);
  let currentUser = null;
  let loadedUserId = null;
  let loadingUserId = null;
  let saveTimer = null;
  let selectedDate = '';
  let viewDate = new Date();
  const iso = date => {
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  };
  const today = iso(new Date());
  selectedDate = today;

  const config = window.LIFE_SYSTEM_SUPABASE_CONFIG || {};
  const supabaseClient = window.supabase?.createClient && config.url && config.anonKey
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

  function collectStateFromPage() {
    state.profile = Object.fromEntries(
      [...document.querySelectorAll('[data-save]')]
        .filter(element => ['name', 'level', 'title', 'rank', 'motto'].includes(element.dataset.save))
        .map(element => [element.dataset.save, element.value])
    );
    for (const field of ['inventory', 'skills', 'notifications']) {
      state[field] = $(field).value;
    }
    state.swot = Object.fromEntries(swotSections.map(section => [
      section,
      [...$(`${section}-list`).querySelectorAll('li')]
        .map(item => item.textContent.trim())
        .filter(Boolean)
    ]));
    return state;
  }

  function persistLocalState() {
    localStorage.setItem(STORAGE, JSON.stringify(state));
  }

  function save() {
    collectStateFromPage();
    persistLocalState();
    scheduleCloudSave();
  }

  function scheduleCloudSave() {
    if (!currentUser || !supabaseClient) return;
    clearTimeout(saveTimer);
    $('syncStatus').textContent = 'Saving changes…';
    saveTimer = setTimeout(() => { void saveUserState(); }, 700);
  }

  async function saveUserState() {
    if (!currentUser || !supabaseClient) return;
    const userId = currentUser.id;
    const snapshot = JSON.parse(JSON.stringify(collectStateFromPage()));
    persistLocalState();
    const { error } = await supabaseClient.from('life_states').upsert({
      user_id: userId,
      data: snapshot,
      updated_at: new Date().toISOString()
    });
    if (currentUser?.id !== userId) return;
    $('syncStatus').textContent = error
      ? 'Cloud save failed. Your latest changes remain in this browser.'
      : 'All changes synced.';
    if (error) console.error('Could not save data to Supabase:', error);
  }

  function applyStateToPage() {
    for (const field of ['name', 'level', 'title', 'rank', 'motto']) {
      $(`${field}`).value = state.profile[field] ?? '';
    }
    for (const field of ['inventory', 'skills', 'notifications']) {
      $(field).value = state[field] ?? '';
    }
    for (const section of swotSections) {
      const list = $(`${section}-list`);
      list.replaceChildren(...state.swot[section].map(text => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }));
    }
    renderStats();
    renderTasks();
    renderCalendar();
  }

  document.querySelectorAll('[data-save]').forEach(element => {
    element.addEventListener('input', save);
  });
  swotSections.forEach(section => $(`${section}-list`).addEventListener('input', save));
  document.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => showPage(button.dataset.page));
  });

  function showPage(id) {
    document.querySelectorAll('.page').forEach(page => {
      page.classList.toggle('active', page.id === `${id}-page`);
    });
    document.querySelectorAll('.main-nav button').forEach(button => {
      button.classList.toggle('active', button.dataset.page === id);
    });
    if (id === 'calendar') renderCalendar();
    if (id === 'tasks' || id === 'status') renderTasks();
  }

  function renderTasks() {
    const list = $('taskList');
    list.replaceChildren();
    state.tasks.forEach((task, index) => {
      const item = document.createElement('li');
      item.innerHTML = `<input type="checkbox" ${task.done ? 'checked' : ''} aria-label="Complete task"><span class="${task.done ? 'completed' : ''}">${escapeHtml(task.text)} ${task.date ? '<small>· ' + escapeHtml(task.date) + '</small>' : ''}</span><button class="icon" aria-label="Delete task">×</button>`;
      item.querySelector('input').onchange = event => {
        task.done = event.target.checked;
        save();
        renderTasks();
      };
      item.querySelector('button').onclick = () => {
        state.tasks.splice(index, 1);
        save();
        renderTasks();
      };
      list.appendChild(item);
    });
    const quickTasks = $('quickTasks');
    quickTasks.replaceChildren(...state.tasks.filter(task => !task.done).slice(0, 5).map(task => {
      const item = document.createElement('li');
      item.innerHTML = `<span>${escapeHtml(task.text)}</span>`;
      return item;
    }));
    const completed = state.tasks.filter(task => task.done).length;
    $('taskSummary').textContent = `${completed}/${state.tasks.length}`;
    $('taskBar').style.width = state.tasks.length ? `${completed / state.tasks.length * 100}%` : '0%';
  }

  $('addTask').onclick = () => {
    const text = $('taskInput').value.trim();
    if (!text) return;
    state.tasks.push({ text, date: $('taskDate').value, done: false });
    $('taskInput').value = '';
    save();
    renderTasks();
  };
  $('taskInput').onkeydown = event => {
    if (event.key === 'Enter') $('addTask').click();
  };
  $('clearCompleted').onclick = () => {
    state.tasks = state.tasks.filter(task => !task.done);
    save();
    renderTasks();
  };

  function renderStats() {
    $('stats').innerHTML = names.map(name => `<div class="stat-row"><span>${name}</span><div class="bar"><i id="bar-${name}"></i></div><button class="icon" data-stat="${name}">${state.stats[name] || 0} +</button></div>`).join('');
    names.forEach(name => {
      $(`bar-${name}`).style.width = `${Math.min((state.stats[name] || 0) * 10, 100)}%`;
    });
  }
  $('stats').addEventListener('click', event => {
    const button = event.target.closest('[data-stat]');
    if (!button) return;
    const name = button.dataset.stat;
    state.stats[name] = (state.stats[name] || 0) + 1;
    renderStats();
    save();
  });

  function renderCalendar() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    $('monthLabel').textContent = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const grid = $('calendarGrid');
    grid.innerHTML = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      .map(day => `<div class="day-name">${day}</div>`).join('');
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    for (let index = 0; index < 42; index++) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = iso(date);
      const events = state.events[key] || [];
      const day = document.createElement('div');
      day.className = `day ${date.getMonth() !== month ? 'other ' : ''}${key === today ? 'today ' : ''}${key === selectedDate ? 'selected' : ''}`;
      day.innerHTML = `<button><span class="day-number">${date.getDate()}</span>${events.slice(0, 2).map(event => `<span class="event-dot">• ${escapeHtml(event)}</span>`).join('')}</button>`;
      day.onclick = () => {
        selectedDate = key;
        renderCalendar();
      };
      grid.appendChild(day);
    }
    $('selectedDateLabel').textContent = `Selected date: ${new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}`;
    const events = state.events[selectedDate] || [];
    $('eventList').innerHTML = events.map((event, index) => `<li><span>${escapeHtml(event)}</span><button class="icon" onclick="deleteEvent(${index})" aria-label="Delete event">×</button></li>`).join('') || '<li class="muted">No events on this date.</li>';
  }
  $('prevMonth').onclick = () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    renderCalendar();
  };
  $('nextMonth').onclick = () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar();
  };
  $('addEvent').onclick = () => {
    const event = $('eventInput').value.trim();
    if (!event) return;
    (state.events[selectedDate] ??= []).push(event);
    $('eventInput').value = '';
    save();
    renderCalendar();
  };
  function deleteEvent(index) {
    state.events[selectedDate].splice(index, 1);
    save();
    renderCalendar();
  }
  window.deleteEvent = deleteEvent;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[character]);
  }

  function setAuthMessage(message) {
    $('authMessage').textContent = message;
  }

  async function loadUserState(user) {
    const { data: row, error } = await supabaseClient
      .from('life_states')
      .select('data')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (currentUser?.id !== user.id) return false;

    if (row?.data) {
      state = normalizeState(row.data);
    } else {
      const hasImportedLegacyData = localStorage.getItem(LEGACY_MIGRATION) === 'true';
      state = normalizeState(hasImportedLegacyData ? defaultState() : legacyImportState);
      const { error: saveError } = await supabaseClient.from('life_states').upsert({
        user_id: user.id,
        data: state,
        updated_at: new Date().toISOString()
      });
      if (saveError) throw saveError;
      if (currentUser?.id !== user.id) return false;
    }

    localStorage.setItem(LEGACY_MIGRATION, 'true');
    persistLocalState();
    applyStateToPage();
    $('syncStatus').textContent = 'All changes synced.';
    return true;
  }

  async function activateSession(session) {
    const user = session?.user;
    if (!user) {
      currentUser = null;
      loadedUserId = null;
      clearTimeout(saveTimer);
      $('app-panel').hidden = true;
      $('auth-panel').hidden = false;
      $('authSignOutButton').hidden = true;
      $('currentUser').textContent = '';
      return;
    }
    if (loadedUserId === user.id) return;
    if (loadingUserId === user.id) return;

    currentUser = user;
    loadingUserId = user.id;
    $('app-panel').hidden = true;
    $('auth-panel').hidden = false;
    $('authSignOutButton').hidden = false;
    setAuthMessage('Loading your saved workspace…');
    try {
      const loaded = await loadUserState(user);
      if (!loaded || currentUser?.id !== user.id) return;
      loadedUserId = user.id;
      $('currentUser').textContent = user.email || 'Signed in';
      $('auth-panel').hidden = true;
      $('app-panel').hidden = false;
      setAuthMessage('');
    } catch (error) {
      console.error('Could not load user data:', error);
      const details = error instanceof Error ? error.message : String(error);
      setAuthMessage(`Could not load your cloud data: ${details}`);
    } finally {
      if (loadingUserId === user.id) loadingUserId = null;
    }
  }

  async function signOut() {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) setAuthMessage(error.message);
  }

  $('authForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabaseClient) return;
    $('signInButton').disabled = true;
    setAuthMessage('Signing in…');
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: $('email').value.trim(),
      password: $('password').value
    });
    $('signInButton').disabled = false;
    setAuthMessage(error ? error.message : 'Signed in. Loading your workspace…');
  });
  $('signUpButton').addEventListener('click', async () => {
    if (!supabaseClient) return;
    if (!$('authForm').reportValidity()) return;
    $('signUpButton').disabled = true;
    setAuthMessage('Creating your account…');
    const { data, error } = await supabaseClient.auth.signUp({
      email: $('email').value.trim(),
      password: $('password').value
    });
    $('signUpButton').disabled = false;
    setAuthMessage(error
      ? error.message
      : data.session ? 'Account created. Loading your workspace…' : 'Account created. Check your email to confirm your address.');
  });
  $('signOutButton').addEventListener('click', signOut);
  $('authSignOutButton').addEventListener('click', signOut);

  async function initializeAuthentication() {
    $('todayLabel').textContent = new Date().toLocaleDateString(undefined, { dateStyle: 'medium' });
    applyStateToPage();
    showPage('status');
    if (!supabaseClient) {
      $('signInButton').disabled = true;
      $('signUpButton').disabled = true;
      setAuthMessage('Add your Supabase project URL and publishable key to supabase-config.js to enable sign-in.');
      return;
    }
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => { void activateSession(session); });
    });
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      setAuthMessage(error.message);
      return;
    }
    await activateSession(data.session);
  }

  void initializeAuthentication();