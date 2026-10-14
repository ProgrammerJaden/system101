const STORAGE = 'life-system-v2';
  const LEGACY_MIGRATION = 'life-system-cloud-migrated-v1';
  const REMEMBER_KEY = 'life-system-remember-me';
  const APPEARANCE_KEY = 'daylight-club-appearance';
  const names = ['Physical', 'Mental', 'Social', 'Financial', 'Spiritual'];
  const swotSections = ['strengths', 'weaknesses', 'opportunities', 'threats'];
  const $ = id => document.getElementById(id);

  function defaultState() {
    return {
      profile: { name: 'Jaden', level: '1', title: 'Dr', rank: 'D', motto: 'I do my best no matter what.' },
      tasks: [],
      events: {},
      diary: {},
      stats: { Physical: 0, Mental: 0, Social: 0, Financial: 0, Spiritual: 0 },
      statsResetVersion: 0,
      xp: 0,
      inventory: [
        { name: 'Laptop', category: 'Tech' },
        { name: 'Notebook', category: 'Study' },
        { name: 'Pen', category: 'Study' }
      ],
      shoppingList: [],
      notebooks: [],
      notesMigrationVersion: 1,
      skills: ['HTML', 'CSS', 'JavaScript', 'Python'],
      pomodoro: { focusMinutes: 25, breakMinutes: 5 },
      swot: {
        strengths: ['Curiosity', 'Persistence'],
        weaknesses: ['Distractions', 'Inconsistent routines'],
        opportunities: ['Build useful projects', 'Learn consistently'],
        threats: ['Burnout', 'Overcommitting']
      }
    };
  }

  function normalizeInventory(value) {
    const entries = Array.isArray(value) ? value : String(value || '').split(/[\n,]+/);
    return entries.map(entry => typeof entry === 'string'
      ? { name: entry.trim(), category: 'Other' }
      : { name: String(entry?.name || '').trim(), category: String(entry?.category || 'Other') })
      .filter(entry => entry.name);
  }

  function normalizeSkills(value) {
    const entries = Array.isArray(value) ? value : String(value || '').split(/[\n,]+/);
    return entries.map(skill => String(skill).trim()).filter(Boolean);
  }

  function createId() {
    return globalThis.crypto?.randomUUID?.()
      || `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function normalizeNotebooks(value) {
    if (!Array.isArray(value)) return [];
    return value.map(notebook => ({
      id: String(notebook?.id || createId()),
      name: String(notebook?.name || 'Untitled notebook'),
      pages: Array.isArray(notebook?.pages) ? notebook.pages.map(page => ({
        id: String(page?.id || createId()),
        title: String(page?.title || 'Untitled page'),
        content: String(page?.content || ''),
        subpages: Array.isArray(page?.subpages) ? page.subpages.map(subpage => ({
          id: String(subpage?.id || createId()),
          title: String(subpage?.title || 'Untitled subpage'),
          content: String(subpage?.content || '')
        })) : []
      })) : []
    }));
  }

  function normalizeShoppingList(value) {
    if (!Array.isArray(value)) return [];
    return value.map(item => ({
      id: String(item?.id || createId()),
      name: String(item?.name || '').trim(),
      done: Boolean(item?.done)
    })).filter(item => item.name);
  }

  function normalizeState(value) {
    const defaults = defaultState();
    const saved = value && typeof value === 'object' ? value : {};
    const notebooks = normalizeNotebooks(saved.notebooks);
    const notesMigrationVersion = Number(saved.notesMigrationVersion) || 0;
    const legacyNotes = String(saved.notifications || '').trim();
    if (!notebooks.length && notesMigrationVersion < 1
      && legacyNotes && legacyNotes !== 'No new notifications.') {
      notebooks.push({
        id: createId(),
        name: 'My Notebook',
        pages: [{
          id: createId(),
          title: 'Imported notes',
          content: legacyNotes,
          subpages: []
        }]
      });
    }
    return {
      ...defaults,
      ...saved,
      profile: { ...defaults.profile, ...(saved.profile || {}) },
      stats: { ...defaults.stats, ...(saved.stats || {}) },
      statsResetVersion: Number(saved.statsResetVersion) || 0,
      tasks: Array.isArray(saved.tasks) ? saved.tasks.map(task => ({
        ...task,
        text: String(task?.text || ''),
        date: String(task?.date || ''),
        time: String(task?.time || ''),
        notes: String(task?.notes || ''),
        done: Boolean(task?.done),
        priority: ['Low', 'Medium', 'High'].includes(task?.priority) ? task.priority : 'Medium',
        category: task?.category == null ? 'Life' : String(task.category).trim(),
        repeat: ['daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'custom'].includes(task?.repeat) ? task.repeat : 'none',
        repeatInterval: Number.isInteger(Number(task?.repeatInterval)) && Number(task.repeatInterval) >= 1 && Number(task.repeatInterval) <= 365
          ? Number(task.repeatInterval) : 1,
        repeatUnit: ['days', 'weeks', 'months'].includes(task?.repeatUnit) ? task.repeatUnit : 'days',
        stat: names.includes(task?.stat) ? task.stat : '',
        xpClaimed: Boolean(task?.xpClaimed),
        statClaimed: Boolean(task?.statClaimed),
        completedAt: String(task?.completedAt || ''),
        subtasks: Array.isArray(task?.subtasks) ? task.subtasks.map(item => typeof item === 'string'
          ? { text: item, done: false }
          : { text: String(item?.text || ''), done: Boolean(item?.done) }).filter(item => item.text) : []
      })).filter(task => task.text) : defaults.tasks,
      events: saved.events && typeof saved.events === 'object' ? saved.events : defaults.events,
      diary: saved.diary && typeof saved.diary === 'object' && !Array.isArray(saved.diary)
        ? Object.fromEntries(Object.entries(saved.diary).map(([date, entry]) => [date, {
          feeling: String(entry?.feeling || ''),
          entry: String(entry?.entry || '')
        }]).filter(([, entry]) => entry.feeling || entry.entry))
        : defaults.diary,
      xp: Number.isFinite(Number(saved.xp)) ? Math.max(0, Number(saved.xp)) : defaults.xp,
      inventory: normalizeInventory(saved.inventory ?? defaults.inventory),
      shoppingList: normalizeShoppingList(saved.shoppingList),
      notebooks,
      notesMigrationVersion: 1,
      notifications: '',
      skills: normalizeSkills(saved.skills ?? defaults.skills),
      pomodoro: {
        focusMinutes: Number.isInteger(Number(saved.pomodoro?.focusMinutes))
          && Number(saved.pomodoro.focusMinutes) >= 1 && Number(saved.pomodoro.focusMinutes) <= 180
          ? Number(saved.pomodoro.focusMinutes) : defaults.pomodoro.focusMinutes,
        breakMinutes: Number.isInteger(Number(saved.pomodoro?.breakMinutes))
          && Number(saved.pomodoro.breakMinutes) >= 1 && Number(saved.pomodoro.breakMinutes) <= 180
          ? Number(saved.pomodoro.breakMinutes) : defaults.pomodoro.breakMinutes
      },
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
  let taskFilter = 'all';
  let editingTask = null;
  let selectedNote = { notebookId: '', pageId: '', subpageId: '' };
  let selectedDate = '';
  let pomodoroMode = 'focus';
  let pomodoroRemainingSeconds = 25 * 60;
  let pomodoroDeadline = 0;
  let pomodoroInterval = null;
  let pomodoroRunning = false;
  let pomodoroAudioContext = null;
  let pomodoroSoundInterval = null;
  let viewDate = new Date();
  const iso = date => {
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  };
  const today = iso(new Date());
  selectedDate = today;

  const config = window.LIFE_SYSTEM_SUPABASE_CONFIG || {};
  const authStorage = {
    async getItem(key) {
      return localStorage.getItem(key) ?? sessionStorage.getItem(key);
    },
    async setItem(key, value) {
      const target = localStorage.getItem(REMEMBER_KEY) === 'false' ? sessionStorage : localStorage;
      const other = target === localStorage ? sessionStorage : localStorage;
      target.setItem(key, value);
      other.removeItem(key);
    },
    async removeItem(key) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  };
  localStorage.setItem(REMEMBER_KEY, localStorage.getItem(REMEMBER_KEY) ?? 'true');
  const supabaseClient = window.supabase?.createClient && config.url && config.anonKey
    ? window.supabase.createClient(config.url, config.anonKey, { auth: { storage: authStorage } })
    : null;

  function collectStateFromPage() {
    state.profile = Object.fromEntries(
      [...document.querySelectorAll('[data-save]')]
        .filter(element => ['name', 'level', 'title', 'rank', 'motto'].includes(element.dataset.save))
        .map(element => [element.dataset.save, element.value])
    );
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
    renderDiary();
    renderInventory();
    renderShoppingList();
    renderSkills();
    renderNotebooks();
    $('pomodoroFocusMinutes').value = state.pomodoro.focusMinutes;
    $('pomodoroBreakMinutes').value = state.pomodoro.breakMinutes;
    resetPomodoro('Ready when you are.');
    updateProgress();
  }

  function pomodoroDuration() {
    const minutes = pomodoroMode === 'focus'
      ? state.pomodoro.focusMinutes
      : state.pomodoro.breakMinutes;
    return minutes * 60;
  }

  function paintPomodoro() {
    const minutes = Math.floor(pomodoroRemainingSeconds / 60);
    const seconds = pomodoroRemainingSeconds % 60;
    $('pomodoroTime').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    $('pomodoroMode').textContent = pomodoroMode === 'focus' ? 'Focus session' : 'Break';
    $('pomodoroToggle').textContent = pomodoroRunning
      ? 'Pause'
      : `Start ${pomodoroMode}`;
    $('pomodoroSwitch').textContent = `Switch to ${pomodoroMode === 'focus' ? 'break' : 'focus'}`;
  }

  function resetPomodoro(message = 'Timer reset.') {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
    pomodoroRunning = false;
    pomodoroDeadline = 0;
    pomodoroRemainingSeconds = pomodoroDuration();
    paintPomodoro();
    $('pomodoroStatus').textContent = message;
  }

  function preparePomodoroAudio() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return false;
    try {
      pomodoroAudioContext ??= new AudioContextConstructor();
      if (pomodoroAudioContext.state === 'suspended') {
        void pomodoroAudioContext.resume().catch(error => {
          console.error('Could not enable the Pomodoro timer sound:', error);
        });
      }
      return true;
    } catch (error) {
      console.error('Could not initialize the Pomodoro timer sound:', error);
      return false;
    }
  }

  async function playPomodoroChime() {
    if (!pomodoroAudioContext) return false;
    if (pomodoroAudioContext.state === 'suspended') {
      await pomodoroAudioContext.resume();
    }
    if (pomodoroAudioContext.state !== 'running') return false;

    const notes = [784, 988, 1175];
    const startTime = pomodoroAudioContext.currentTime;
    notes.forEach((frequency, index) => {
      const start = startTime + index * 0.32;
      const oscillator = pomodoroAudioContext.createOscillator();
      const volume = pomodoroAudioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(0.4, start + 0.025);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      oscillator.connect(volume);
      volume.connect(pomodoroAudioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.3);
    });
    return true;
  }

  async function startPomodoroSound() {
    const played = await playPomodoroChime();
    if (!played) return false;
    $('pomodoroStopSound').hidden = false;
    pomodoroSoundInterval = setInterval(() => {
      void playPomodoroChime().catch(error => {
        console.error('Could not continue the Pomodoro timer sound:', error);
        stopPomodoroSound();
        $('pomodoroStatus').textContent = 'Sound alert could not be played.';
      });
    }, 1300);
    return true;
  }

  function stopPomodoroSound() {
    clearInterval(pomodoroSoundInterval);
    pomodoroSoundInterval = null;
    $('pomodoroStopSound').hidden = true;
  }

  function tickPomodoro() {
    pomodoroRemainingSeconds = Math.max(0, Math.ceil((pomodoroDeadline - Date.now()) / 1000));
    paintPomodoro();
    if (pomodoroRemainingSeconds === 0) {
      clearInterval(pomodoroInterval);
      pomodoroInterval = null;
      pomodoroRunning = false;
      $('pomodoroStatus').textContent = pomodoroMode === 'focus'
        ? 'Focus session complete. Take a break or reset your timer.'
        : 'Break complete. Switch back to focus when you are ready.';
      paintPomodoro();
      void startPomodoroSound().then(played => {
        if (!played) $('pomodoroStatus').textContent += ' Sound alert is unavailable in this browser.';
      }).catch(error => {
        console.error('Could not play the Pomodoro timer sound:', error);
        $('pomodoroStatus').textContent += ' Sound alert could not be played.';
      });
    }
  }

  function initializePomodoro() {
    $('pomodoroStopSound').addEventListener('click', () => {
      stopPomodoroSound();
      $('pomodoroStatus').textContent = 'Sound stopped.';
    });
    $('pomodoroToggle').addEventListener('click', () => {
      if (pomodoroRunning) {
        tickPomodoro();
        if (!pomodoroRunning) return;
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        pomodoroRunning = false;
        pomodoroRemainingSeconds = Math.max(0, Math.ceil((pomodoroDeadline - Date.now()) / 1000));
        $('pomodoroStatus').textContent = 'Timer paused.';
        paintPomodoro();
        return;
      }
      if (pomodoroRemainingSeconds === 0) pomodoroRemainingSeconds = pomodoroDuration();
      preparePomodoroAudio();
      pomodoroDeadline = Date.now() + pomodoroRemainingSeconds * 1000;
      pomodoroRunning = true;
      $('pomodoroStatus').textContent = `${pomodoroMode === 'focus' ? 'Focus' : 'Break'} session in progress.`;
      paintPomodoro();
      pomodoroInterval = setInterval(tickPomodoro, 1000);
    });
    $('pomodoroReset').addEventListener('click', () => resetPomodoro());
    $('pomodoroSwitch').addEventListener('click', () => {
      pomodoroMode = pomodoroMode === 'focus' ? 'break' : 'focus';
      resetPomodoro(`${pomodoroMode === 'focus' ? 'Focus' : 'Break'} timer ready.`);
    });
    [['pomodoroFocusMinutes', 'focusMinutes'], ['pomodoroBreakMinutes', 'breakMinutes']]
      .forEach(([id, setting]) => {
        $(id).addEventListener('change', event => {
          const input = event.currentTarget;
          if (!input.reportValidity()) {
            input.value = state.pomodoro[setting];
            return;
          }
          state.pomodoro[setting] = Number(input.value);
          save();
          resetPomodoro('Duration saved. Timer reset.');
        });
      });
    paintPomodoro();
  }

  document.querySelectorAll('[data-save]').forEach(element => {
    element.addEventListener('input', save);
  });
  swotSections.forEach(section => $(`${section}-list`).addEventListener('input', save));
  document.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => showPage(button.dataset.page));
  });

  function showPage(id) {
    const page = $(`${id}-page`);
    if (!page) return;
    if (id === 'calendar') renderCalendar();
    if (id === 'diary') {
      $('diaryDate').value = selectedDate;
      renderDiary();
    }
    if (id === 'tasks' || id === 'today') renderTasks();
    if (id === 'inventory') renderInventory();
    if (id === 'status') {
      renderSkills();
      renderStats();
    }
    if (id === 'notes') renderNotebooks();
    page.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      const visibleSections = entries.filter(entry => entry.isIntersecting);
      visibleSections.forEach(entry => entry.target.classList.add('section-arrived'));
      const currentSection = visibleSections.sort((a, b) =>
        Math.abs(a.boundingClientRect.top - window.innerHeight * 0.2)
        - Math.abs(b.boundingClientRect.top - window.innerHeight * 0.2)
      )[0];
      if (currentSection) {
        const pageId = currentSection.target.id.replace('-page', '');
        document.querySelectorAll('.main-nav [data-page]').forEach(button => {
          button.classList.toggle('active', button.dataset.page === pageId);
        });
      }
    }, { rootMargin: '-15% 0px -65% 0px' });
    document.querySelectorAll('.page').forEach(page => sectionObserver.observe(page));
  }

  function updateProgress() {
    const level = Math.floor(state.xp / 60) + 1;
    const rank = level >= 10 ? 'A' : level >= 7 ? 'B' : level >= 4 ? 'C' : 'D';
    state.profile.level = String(level);
    state.profile.rank = rank;
    $('level').value = state.profile.level;
    $('rank').value = state.profile.rank;
    $('levelLabel').textContent = `Level ${level} · Rank ${rank}`;
    $('xpLabel').textContent = `${state.xp % 60} / 60 XP`;
    $('xpBar').style.width = `${state.xp % 60 / 60 * 100}%`;
    const completed = state.tasks.filter(task => task.done).length;
    $('taskSummary').textContent = `${completed}/${state.tasks.length}`;
    $('taskBar').style.width = state.tasks.length ? `${completed / state.tasks.length * 100}%` : '0%';
  }

  function toggleTask(index, done) {
    const task = state.tasks[index];
    if (!task) return;
    const wasDone = task.done;
    task.done = done;
    task.completedAt = done ? today : '';
    if (done && !wasDone && task.repeat !== 'none') {
      const [year, month, day] = (task.date || today).split('-').map(Number);
      const nextDate = new Date(year, month - 1, day);
      const repeatDay = nextDate.getDate();
      const advanceMonth = () => {
        nextDate.setDate(1);
        nextDate.setMonth(nextDate.getMonth() + 1);
        const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(repeatDay, lastDay));
      };
      const advanceRepeat = () => {
        if (task.repeat === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        if (task.repeat === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        if (task.repeat === 'monthly') advanceMonth();
        if (task.repeat === 'weekdays' || task.repeat === 'weekends') {
          do {
            nextDate.setDate(nextDate.getDate() + 1);
          } while (task.repeat === 'weekdays'
            ? nextDate.getDay() === 0 || nextDate.getDay() === 6
            : nextDate.getDay() !== 0 && nextDate.getDay() !== 6);
        }
        if (task.repeat === 'custom') {
          const interval = task.repeatInterval || 1;
          if (task.repeatUnit === 'days') nextDate.setDate(nextDate.getDate() + interval);
          if (task.repeatUnit === 'weeks') nextDate.setDate(nextDate.getDate() + interval * 7);
          if (task.repeatUnit === 'months') {
            for (let step = 0; step < interval; step++) advanceMonth();
          }
        }
      };
      advanceRepeat();
      while (iso(nextDate) <= today) advanceRepeat();
      state.tasks.push({
        ...task,
        date: iso(nextDate),
        done: false,
        xpClaimed: false,
        statClaimed: false,
        completedAt: '',
        subtasks: task.subtasks.map(subtask => ({ ...subtask, done: false }))
      });
    }
    if (done && !task.xpClaimed) {
      state.xp += 10;
      task.xpClaimed = true;
    }
    if (done && !task.statClaimed && task.stat) {
      state.stats[task.stat] = (state.stats[task.stat] || 0) + 1;
      task.statClaimed = true;
    }
    save();
    renderTasks();
    renderStats();
    renderCalendar();
    updateProgress();
  }

  function visibleTasks() {
    return state.tasks.map((task, index) => ({ task, index })).filter(({ task }) => {
      if (taskFilter === 'today') return !task.done && task.date === today;
      if (taskFilter === 'upcoming') return !task.done && task.date > today;
      if (taskFilter === 'completed') return task.done;
      return true;
    });
  }

  function renderTasks() {
    updateTaskCategorySuggestions();
    const list = $('taskList');
    list.replaceChildren();
    visibleTasks().forEach(({ task, index }) => {
      const item = document.createElement('li');
      item.className = 'task-item';
      const overdue = task.date && task.date < today && !task.done;
      if (task === editingTask) {
        item.classList.add('task-is-editing');
        const form = document.createElement('form');
        form.className = 'task-edit-form';
        form.innerHTML = `<div class="task-edit-title"><label>Task name<input name="text" value="${escapeHtml(task.text)}" required></label></div><div><label>Due date<input name="date" type="date" value="${escapeHtml(task.date)}"></label></div><div><label>Time<input name="time" type="time" value="${escapeHtml(task.time)}"></label></div><div><label>Priority<select name="priority">${['Low', 'Medium', 'High'].map(value => `<option${task.priority === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div><div><label>Category<input name="category" list="taskCategories" value="${escapeHtml(task.category)}" placeholder="Name a category"></label></div><div><label>Repeat<select name="repeat">${[['none', 'Does not repeat'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekends', 'Weekends'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['custom', 'Custom interval']].map(([value, label]) => `<option value="${value}"${task.repeat === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div><div class="task-edit-custom-repeat" ${task.repeat === 'custom' ? '' : 'hidden'}><label>Every<input name="repeatInterval" type="number" min="1" max="365" step="1" value="${task.repeatInterval}" required ${task.repeat === 'custom' ? '' : 'disabled'}></label><label>Unit<select name="repeatUnit" ${task.repeat === 'custom' ? '' : 'disabled'}>${[['days', 'Days'], ['weeks', 'Weeks'], ['months', 'Months']].map(([value, label]) => `<option value="${value}"${task.repeatUnit === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div><div><label>Reward stat<select name="stat"><option value="">No stat</option>${names.map(value => `<option${task.stat === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div><div class="task-edit-notes"><label>Notes<textarea name="notes" placeholder="Add notes…">${escapeHtml(task.notes)}</textarea></label></div><div class="task-edit-actions"><button type="submit">Save</button><button type="button" class="task-edit-cancel">Cancel</button></div>`;
        item.appendChild(form);
        form.elements.repeat.onchange = () => {
          const isCustom = form.elements.repeat.value === 'custom';
          const customFields = form.querySelector('.task-edit-custom-repeat');
          customFields.hidden = !isCustom;
          customFields.querySelectorAll('input, select').forEach(field => { field.disabled = !isCustom; });
        };
        form.onsubmit = event => {
          event.preventDefault();
          const text = form.elements.text.value.trim();
          if (!text) return;
          task.text = text;
          task.date = form.elements.date.value;
          task.time = form.elements.time.value;
          task.notes = form.elements.notes.value.trim();
          task.priority = form.elements.priority.value;
          task.category = form.elements.category.value.trim();
          task.repeat = form.elements.repeat.value;
          task.repeatInterval = Number(form.elements.repeatInterval.value);
          task.repeatUnit = form.elements.repeatUnit.value;
          task.stat = form.elements.stat.value;
          editingTask = null;
          save();
          updateTaskCategorySuggestions();
          renderTasks();
          renderCalendar();
        };
        form.querySelector('.task-edit-cancel').onclick = () => {
          editingTask = null;
          renderTasks();
        };
        list.appendChild(item);
        return;
      }
      const repeatLabels = { daily: 'Daily', weekdays: 'Weekdays', weekends: 'Weekends', weekly: 'Weekly', monthly: 'Monthly' };
      const repeatLabel = task.repeat === 'custom'
        ? `Every ${task.repeatInterval} ${task.repeatUnit.replace(/s$/, task.repeatInterval === 1 ? '' : 's')}`
        : repeatLabels[task.repeat];
      item.innerHTML = `<div class="task-main"><input class="task-check" type="checkbox" ${task.done ? 'checked' : ''} aria-label="Complete ${escapeHtml(task.text)}"><div class="task-content"><div class="task-title ${task.done ? 'completed' : ''}">${escapeHtml(task.text)}${task.date ? `<small class="task-date ${overdue ? 'overdue' : ''}">${overdue ? 'Overdue · ' : ''}${escapeHtml(task.date)}${task.time ? ` · ${escapeHtml(task.time)}` : ''}</small>` : task.time ? `<small class="task-date">${escapeHtml(task.time)}</small>` : ''}</div><div class="task-badges"><span class="badge priority-${task.priority.toLowerCase()}">${escapeHtml(task.priority)}</span>${task.category ? `<span class="badge category-tag">${escapeHtml(task.category)}</span>` : ''}${repeatLabel ? `<span class="badge">${escapeHtml(repeatLabel)}</span>` : ''}${task.stat ? `<span class="badge stat-badge">+1 ${escapeHtml(task.stat)}</span>` : ''}</div>${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ''}<div class="subtask-list">${task.subtasks.map((subtask, subIndex) => `<label class="subtask"><input type="checkbox" data-subtask="${subIndex}" ${subtask.done ? 'checked' : ''}><span class="${subtask.done ? 'completed' : ''}">${escapeHtml(subtask.text)}</span></label>`).join('')}<form class="subtask-form"><input name="subtask" placeholder="Add checklist item" aria-label="Add checklist item"><button type="submit" aria-label="Add checklist item">+</button></form></div></div></div><div class="task-actions"><button class="icon task-edit" type="button" aria-label="Edit ${escapeHtml(task.text)}" title="Edit task">✎</button><button class="icon task-delete" type="button" aria-label="Delete ${escapeHtml(task.text)}">×</button></div>`;
      item.querySelector('.task-check').onchange = event => toggleTask(index, event.target.checked);
      item.querySelector('.task-edit').onclick = () => {
        editingTask = task;
        renderTasks();
        $('taskList').querySelector('.task-edit-form [name="text"]').focus();
      };
      item.querySelector('.task-delete').onclick = () => {
        state.tasks.splice(index, 1);
        save();
        renderTasks();
        renderCalendar();
        updateProgress();
      };
      item.querySelectorAll('[data-subtask]').forEach(input => {
        input.onchange = () => {
          task.subtasks[Number(input.dataset.subtask)].done = input.checked;
          save();
          renderTasks();
        };
      });
      item.querySelector('.subtask-form').onsubmit = event => {
        event.preventDefault();
        const input = event.currentTarget.elements.subtask;
        const text = input.value.trim();
        if (!text) return;
        task.subtasks.push({ text, done: false });
        save();
        renderTasks();
      };
      list.appendChild(item);
    });
    const quickTasks = $('quickTasks');
    quickTasks.replaceChildren(...state.tasks.map((task, index) => ({ task, index })).filter(({ task }) => !task.done).slice(0, 5).map(({ task, index }) => {
      const item = document.createElement('li');
      item.className = 'quick-task';
      item.innerHTML = `<input class="task-check" type="checkbox" aria-label="Complete ${escapeHtml(task.text)}"><span>${escapeHtml(task.text)}</span>`;
      item.querySelector('input').onchange = event => toggleTask(index, event.target.checked);
      return item;
    }));
    updateProgress();
  }

  document.querySelectorAll('[data-task-filter]').forEach(button => {
    button.onclick = () => {
      taskFilter = button.dataset.taskFilter;
      document.querySelectorAll('[data-task-filter]').forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
      renderTasks();
    };
  });

  function updateTaskCategorySuggestions() {
    const categories = [...new Set(state.tasks.map(task => task.category).filter(Boolean))];
    $('taskCategories').innerHTML = categories.map(category => `<option value="${escapeHtml(category)}"></option>`).join('');
  }

  updateTaskCategorySuggestions();

  const updateCustomRepeatVisibility = () => {
    const isCustom = $('taskRepeat').value === 'custom';
    $('taskCustomRepeat').hidden = !isCustom;
    $('taskCustomRepeat').querySelectorAll('input, select').forEach(field => { field.disabled = !isCustom; });
  };
  $('taskRepeat').addEventListener('change', updateCustomRepeatVisibility);
  updateCustomRepeatVisibility();

  $('addTask').onclick = () => {
    const text = $('taskInput').value.trim();
    if (!text) return;
    const repeatInterval = Number($('taskRepeatInterval').value);
    if ($('taskRepeat').value === 'custom'
      && (!Number.isInteger(repeatInterval) || repeatInterval < 1 || repeatInterval > 365)) {
      $('taskRepeatInterval').focus();
      return;
    }
    state.tasks.push({
      text,
      date: $('taskDate').value,
      time: $('taskTime').value,
      notes: $('taskNotes').value.trim(),
      done: false,
      priority: $('taskPriority').value,
      category: $('taskCategory').value.trim(),
      repeat: $('taskRepeat').value,
      repeatInterval,
      repeatUnit: $('taskRepeatUnit').value,
      stat: $('taskStat').value,
      xpClaimed: false,
      statClaimed: false,
      completedAt: '',
      subtasks: []
    });
    $('taskInput').value = '';
    $('taskTime').value = '';
    $('taskNotes').value = '';
    $('taskCategory').value = '';
    $('taskRepeat').value = 'none';
    $('taskRepeatInterval').value = '1';
    $('taskRepeatUnit').value = 'days';
    updateCustomRepeatVisibility();
    save();
    updateTaskCategorySuggestions();
    renderTasks();
  };
  $('taskInput').onkeydown = event => {
    if (event.key === 'Enter') $('addTask').click();
  };
  $('clearCompleted').onclick = () => {
    state.tasks = state.tasks.filter(task => !task.done);
    editingTask = null;
    save();
    renderTasks();
  };

  function renderStats() {
    $('stats').innerHTML = names.map(name => `<div class="stat-row"><span>${name}</span><div class="bar"><i id="bar-${name}"></i></div><strong>${state.stats[name] || 0}</strong></div>`).join('');
    names.forEach(name => {
      $(`bar-${name}`).style.width = `${Math.min((state.stats[name] || 0) * 10, 100)}%`;
    });
  }

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
      const taskCount = state.tasks.filter(task => task.date === key).length;
      const hasDiary = Boolean(state.diary[key]?.feeling || state.diary[key]?.entry);
      const count = events.length + taskCount + Number(hasDiary);
      const day = document.createElement('div');
      day.className = `day ${date.getMonth() !== month ? 'other ' : ''}${key === today ? 'today ' : ''}${key === selectedDate ? 'selected' : ''}`;
      day.innerHTML = `<button aria-label="${date.toLocaleDateString(undefined, { dateStyle: 'full' })}${count ? `, ${count} items` : ''}${hasDiary ? ', diary logged' : ''}"><span class="day-number">${date.getDate()}</span>${count ? `<span class="day-indicator">${events.length ? `<i class="event-indicator">${events.length}</i>` : ''}${taskCount ? `<i class="task-indicator">${taskCount}</i>` : ''}${hasDiary ? '<i class="diary-indicator" aria-label="Diary logged">✓</i>' : ''}</span>` : ''}</button>`;
      day.onclick = () => {
        selectedDate = key;
        renderCalendar();
      };
      grid.appendChild(day);
    }
    $('selectedDateLabel').textContent = `Selected date: ${new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}`;
    const events = state.events[selectedDate] || [];
    const tasks = state.tasks.map((task, index) => ({ task, index })).filter(({ task }) => task.date === selectedDate);
    const diaryEntry = state.diary[selectedDate];
    $('diaryCalendarStatus').textContent = diaryEntry?.feeling || diaryEntry?.entry
      ? `Diary: Logged${diaryEntry.feeling ? ` · Feeling ${diaryEntry.feeling.toLowerCase()}` : ''}`
      : 'Diary: Not logged yet';
    $('eventList').replaceChildren();
    if (diaryEntry?.feeling || diaryEntry?.entry) {
      const item = document.createElement('li');
      item.className = 'calendar-diary';
      const details = document.createElement('span');
      const feeling = document.createElement('strong');
      feeling.textContent = `Diary${diaryEntry.feeling ? ` · Feeling ${diaryEntry.feeling.toLowerCase()}` : ''}`;
      const entry = document.createElement('span');
      entry.textContent = diaryEntry.entry;
      details.append(feeling, entry);
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.dataset.page = 'diary';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => showPage('diary'));
      item.append(details, editButton);
      $('eventList').appendChild(item);
    }
    events.forEach((event, index) => {
      const item = document.createElement('li');
      item.innerHTML = `<span>${escapeHtml(event)} <span class="badge event-badge">Event</span></span><button class="icon" aria-label="Delete event">×</button>`;
      item.querySelector('button').onclick = () => deleteEvent(index);
      $('eventList').appendChild(item);
    });
    tasks.forEach(({ task, index }) => {
      const item = document.createElement('li');
      item.className = 'calendar-task';
      item.innerHTML = `<label class="calendar-task-label"><input class="task-check" type="checkbox" ${task.done ? 'checked' : ''} aria-label="Complete ${escapeHtml(task.text)}"><span class="${task.done ? 'completed' : ''}">${escapeHtml(task.text)}</span></label><span class="badge priority-${task.priority.toLowerCase()}">${escapeHtml(task.priority)}</span>`;
      item.querySelector('input').onchange = event => toggleTask(index, event.target.checked);
      $('eventList').appendChild(item);
    });
    if (!events.length && !tasks.length && !diaryEntry?.feeling && !diaryEntry?.entry) {
      const empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = 'No events or tasks on this date.';
      $('eventList').appendChild(empty);
    }
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

  function renderDiary() {
    const date = $('diaryDate').value || selectedDate;
    const entry = state.diary[date] || { feeling: '', entry: '' };
    $('diaryDate').value = date;
    $('diaryDateLabel').textContent = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' });
    $('diaryFeeling').value = entry.feeling;
    $('diaryEntry').value = entry.entry;
    $('diaryStatus').textContent = entry.feeling && entry.entry
      ? 'Entry saved'
      : entry.feeling || entry.entry ? 'Draft saved' : 'No entry saved for this date';
  }

  function autosaveDiaryDraft() {
    const date = $('diaryDate').value;
    if (!date) return;
    const draft = {
      feeling: $('diaryFeeling').value,
      entry: $('diaryEntry').value
    };
    if (draft.feeling || draft.entry) {
      state.diary[date] = draft;
    } else {
      delete state.diary[date];
    }
    save();
    $('diaryStatus').textContent = draft.feeling && draft.entry
      ? 'Saved automatically'
      : draft.feeling || draft.entry ? 'Draft saved automatically' : 'Draft cleared';
  }

  $('diaryDate').addEventListener('change', () => {
    selectedDate = $('diaryDate').value || today;
    viewDate = new Date(`${selectedDate}T12:00:00`);
    renderDiary();
    renderCalendar();
  });
  $('diaryFeeling').addEventListener('change', autosaveDiaryDraft);
  $('diaryEntry').addEventListener('input', autosaveDiaryDraft);
  $('diaryForm').addEventListener('submit', event => {
    event.preventDefault();
    const date = $('diaryDate').value;
    state.diary[date] = {
      feeling: $('diaryFeeling').value,
      entry: $('diaryEntry').value.trim()
    };
    selectedDate = date;
    viewDate = new Date(`${date}T12:00:00`);
    save();
    renderDiary();
    renderCalendar();
  });

  function renderInventory() {
    const list = $('inventoryList');
    list.replaceChildren(...state.inventory.map((entry, index) => {
      const item = document.createElement('li');
      item.className = 'inventory-item';
      item.innerHTML = `<div><strong>${escapeHtml(entry.name)}</strong><span class="badge category-${entry.category.toLowerCase()}">${escapeHtml(entry.category)}</span></div><button class="icon" aria-label="Remove ${escapeHtml(entry.name)}">×</button>`;
      item.querySelector('button').onclick = () => {
        state.inventory.splice(index, 1);
        save();
        renderInventory();
      };
      return item;
    }));
    $('inventoryCount').textContent = `${state.inventory.length} ${state.inventory.length === 1 ? 'item' : 'items'}`;
  }

  $('addInventoryItem').onclick = () => {
    const name = $('inventoryInput').value.trim();
    if (!name) return;
    state.inventory.push({ name, category: $('inventoryCategory').value });
    $('inventoryInput').value = '';
    save();
    renderInventory();
  };
  $('inventoryInput').onkeydown = event => {
    if (event.key === 'Enter') $('addInventoryItem').click();
  };

  function renderShoppingList() {
    const list = $('shoppingList');
    list.replaceChildren(...state.shoppingList.map((entry, index) => {
      const item = document.createElement('li');
      item.className = `shopping-item${entry.done ? ' completed' : ''}`;
      const label = document.createElement('label');
      label.className = 'shopping-check';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = entry.done;
      checkbox.setAttribute('aria-label', `Mark ${entry.name} ${entry.done ? 'not bought' : 'bought'}`);
      const name = document.createElement('span');
      name.textContent = entry.name;
      label.append(checkbox, name);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon';
      remove.setAttribute('aria-label', `Remove ${entry.name} from shopping list`);
      remove.textContent = '×';
      checkbox.addEventListener('change', () => {
        entry.done = checkbox.checked;
        save();
        renderShoppingList();
      });
      remove.addEventListener('click', () => {
        state.shoppingList.splice(index, 1);
        save();
        renderShoppingList();
      });
      item.append(label, remove);
      return item;
    }));
    $('shoppingCount').textContent = `${state.shoppingList.filter(item => !item.done).length} to buy`;
  }

  $('shoppingForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('shoppingInput').value.trim();
    if (!name) return;
    state.shoppingList.push({ id: createId(), name, done: false });
    $('shoppingInput').value = '';
    save();
    renderShoppingList();
  });

  function renderSkills() {
    const list = $('skillList');
    list.replaceChildren(...state.skills.map((skill, index) => {
      const item = document.createElement('li');
      item.innerHTML = `<span>${escapeHtml(skill)}</span><button class="icon" aria-label="Remove ${escapeHtml(skill)}">×</button>`;
      item.querySelector('button').onclick = () => {
        state.skills.splice(index, 1);
        save();
        renderSkills();
      };
      return item;
    }));
  }

  $('addSkill').onclick = () => {
    const skill = $('skillInput').value.trim();
    if (!skill) return;
    state.skills.push(skill);
    $('skillInput').value = '';
    save();
    renderSkills();
  };
  $('skillInput').onkeydown = event => {
    if (event.key === 'Enter') $('addSkill').click();
  };

  function getSelectedNote() {
    const notebook = state.notebooks.find(entry => entry.id === selectedNote.notebookId);
    const page = notebook?.pages.find(entry => entry.id === selectedNote.pageId);
    const note = selectedNote.subpageId
      ? page?.subpages.find(entry => entry.id === selectedNote.subpageId)
      : page;
    return { notebook, page, note };
  }

  function renderNotebooks() {
    const tree = $('notebookTree');
    tree.replaceChildren();
    if (!state.notebooks.some(notebook => notebook.id === selectedNote.notebookId)) {
      selectedNote = { notebookId: state.notebooks[0]?.id || '', pageId: '', subpageId: '' };
    }
    const selectedNotebook = state.notebooks.find(notebook => notebook.id === selectedNote.notebookId);
    if (!selectedNotebook?.pages.some(page => page.id === selectedNote.pageId)) {
      selectedNote.pageId = selectedNotebook?.pages[0]?.id || '';
      selectedNote.subpageId = '';
    }
    const selectedPage = selectedNotebook?.pages.find(page => page.id === selectedNote.pageId);
    if (!selectedPage?.subpages.some(page => page.id === selectedNote.subpageId)) {
      selectedNote.subpageId = '';
    }

    state.notebooks.forEach(notebook => {
      const group = document.createElement('section');
      group.className = 'notebook-group';
      const header = document.createElement('div');
      header.className = 'notebook-heading';
      const name = document.createElement('input');
      name.value = notebook.name;
      name.setAttribute('aria-label', 'Notebook name');
      name.addEventListener('change', () => {
        notebook.name = name.value.trim() || 'Untitled notebook';
        save();
      });
      const addPage = document.createElement('button');
      addPage.type = 'button';
      addPage.className = 'icon';
      addPage.textContent = '+';
      addPage.title = 'Add page';
      addPage.setAttribute('aria-label', `Add page to ${notebook.name}`);
      addPage.addEventListener('click', () => {
        const page = { id: createId(), title: 'Untitled page', content: '', subpages: [] };
        notebook.pages.push(page);
        selectedNote = { notebookId: notebook.id, pageId: page.id, subpageId: '' };
        save();
        renderNotebooks();
      });
      const removeNotebook = document.createElement('button');
      removeNotebook.type = 'button';
      removeNotebook.className = 'icon';
      removeNotebook.textContent = '×';
      removeNotebook.title = 'Delete notebook';
      removeNotebook.setAttribute('aria-label', `Delete ${notebook.name}`);
      removeNotebook.addEventListener('click', () => {
        if (!window.confirm(`Delete "${notebook.name}" and all of its pages?`)) return;
        state.notebooks = state.notebooks.filter(entry => entry.id !== notebook.id);
        if (selectedNote.notebookId === notebook.id) {
          selectedNote = { notebookId: '', pageId: '', subpageId: '' };
        }
        save();
        renderNotebooks();
      });
      header.append(name, addPage, removeNotebook);
      group.appendChild(header);

      notebook.pages.forEach(page => {
        const row = document.createElement('div');
        row.className = 'note-tree-row';
        const selectPage = document.createElement('button');
        selectPage.type = 'button';
        selectPage.className = `note-tree-select${selectedNote.pageId === page.id && !selectedNote.subpageId ? ' active' : ''}`;
        selectPage.dataset.noteId = page.id;
        selectPage.textContent = page.title;
        selectPage.addEventListener('click', () => {
          selectedNote = { notebookId: notebook.id, pageId: page.id, subpageId: '' };
          renderNotebooks();
        });
        const addSubpage = document.createElement('button');
        addSubpage.type = 'button';
        addSubpage.className = 'icon';
        addSubpage.textContent = '+';
        addSubpage.title = 'Add subpage';
        addSubpage.setAttribute('aria-label', `Add subpage to ${page.title}`);
        addSubpage.addEventListener('click', () => {
          const subpage = { id: createId(), title: 'Untitled subpage', content: '' };
          page.subpages.push(subpage);
          selectedNote = { notebookId: notebook.id, pageId: page.id, subpageId: subpage.id };
          save();
          renderNotebooks();
        });
        const removePage = document.createElement('button');
        removePage.type = 'button';
        removePage.className = 'icon';
        removePage.textContent = '×';
        removePage.title = 'Delete page';
        removePage.setAttribute('aria-label', `Delete ${page.title}`);
        removePage.addEventListener('click', () => {
          if (!window.confirm(`Delete "${page.title}" and its subpages?`)) return;
          notebook.pages = notebook.pages.filter(entry => entry.id !== page.id);
          if (selectedNote.pageId === page.id) {
            selectedNote = { notebookId: notebook.id, pageId: '', subpageId: '' };
          }
          save();
          renderNotebooks();
        });
        row.append(selectPage, addSubpage, removePage);
        group.appendChild(row);

        page.subpages.forEach(subpage => {
          const subpageRow = document.createElement('div');
          subpageRow.className = 'note-tree-row note-subpage-row';
          const selectSubpage = document.createElement('button');
          selectSubpage.type = 'button';
          selectSubpage.className = `note-tree-select${selectedNote.subpageId === subpage.id ? ' active' : ''}`;
          selectSubpage.dataset.noteId = subpage.id;
          selectSubpage.textContent = `↳ ${subpage.title}`;
          selectSubpage.addEventListener('click', () => {
            selectedNote = { notebookId: notebook.id, pageId: page.id, subpageId: subpage.id };
            renderNotebooks();
          });
          const removeSubpage = document.createElement('button');
          removeSubpage.type = 'button';
          removeSubpage.className = 'icon';
          removeSubpage.textContent = '×';
          removeSubpage.title = 'Delete subpage';
          removeSubpage.setAttribute('aria-label', `Delete ${subpage.title}`);
          removeSubpage.addEventListener('click', () => {
            if (!window.confirm(`Delete "${subpage.title}"?`)) return;
            page.subpages = page.subpages.filter(entry => entry.id !== subpage.id);
            if (selectedNote.subpageId === subpage.id) selectedNote.subpageId = '';
            save();
            renderNotebooks();
          });
          subpageRow.append(selectSubpage, removeSubpage);
          group.appendChild(subpageRow);
        });
      });
      tree.appendChild(group);
    });

    const { notebook, page, note } = getSelectedNote();
    const editor = $('noteEditor');
    editor.hidden = !note;
    $('noteEmpty').hidden = Boolean(note);
    if (!note) return;
    $('noteBreadcrumb').textContent = [notebook.name, page.title, selectedNote.subpageId ? note.title : ''].filter(Boolean).join(' / ');
    $('noteTitle').value = note.title;
    $('noteContent').value = note.content;
  }

  $('notebookForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('notebookInput').value.trim();
    if (!name) return;
    const notebook = { id: createId(), name, pages: [] };
    state.notebooks.push(notebook);
    $('notebookInput').value = '';
    selectedNote = { notebookId: notebook.id, pageId: '', subpageId: '' };
    save();
    renderNotebooks();
  });
  $('noteTitle').addEventListener('change', () => {
    const { note } = getSelectedNote();
    if (!note) return;
    note.title = $('noteTitle').value.trim() || (selectedNote.subpageId ? 'Untitled subpage' : 'Untitled page');
    save();
    const treeButton = [...$('notebookTree').querySelectorAll('[data-note-id]')]
      .find(button => button.dataset.noteId === note.id);
    if (treeButton) {
      treeButton.textContent = selectedNote.subpageId ? `↳ ${note.title}` : note.title;
      const deleteButton = treeButton.parentElement.querySelector('[title^="Delete"]');
      deleteButton.title = `Delete ${note.title}`;
      deleteButton.setAttribute('aria-label', `Delete ${note.title}`);
    }
    const { notebook, page } = getSelectedNote();
    $('noteBreadcrumb').textContent = [notebook.name, page.title, selectedNote.subpageId ? note.title : ''].filter(Boolean).join(' / ');
  });
  $('noteContent').addEventListener('input', () => {
    const { note } = getSelectedNote();
    if (!note) return;
    note.content = $('noteContent').value;
    save();
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[character]);
  }

  function setAuthMessage(message) {
    $('authMessage').textContent = message;
  }

  function updateProfileAvatar(user) {
    const image = $('profileAvatarImage');
    const initials = $('profileInitials');
    const email = String(user?.email || '').trim();
    const photoUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
    initials.textContent = email ? email[0].toUpperCase() : 'D';
    image.hidden = true;
    initials.hidden = false;
    image.onerror = () => {
      image.hidden = true;
      initials.hidden = false;
    };
    if (photoUrl) {
      image.onload = () => {
        image.hidden = false;
        initials.hidden = true;
      };
      image.src = photoUrl;
    } else {
      image.removeAttribute('src');
    }
  }

  function initializeAppearance() {
    const theme = $('themeSelect');
    const font = $('fontSelect');
    const textSize = $('textSize');
    const textSizeValue = $('textSizeValue');
    const settingsMenu = $('settingsMenu');
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || '{}') || {};
    } catch (error) {
      console.warn('Could not read appearance settings:', error);
    }

    theme.value = ['paper', 'garden', 'night'].includes(saved.theme) ? saved.theme : 'paper';
    font.value = ['friendly', 'classic', 'typewriter'].includes(saved.font) ? saved.font : 'friendly';
    textSize.value = String(Math.min(20, Math.max(14, Number(saved.textSize) || 16)));

    const applyAppearance = () => {
      document.documentElement.dataset.theme = theme.value;
      document.documentElement.dataset.font = font.value;
      document.documentElement.style.setProperty('--text-size', `${textSize.value}px`);
      textSizeValue.value = `${textSize.value} px`;
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify({
        theme: theme.value,
        font: font.value,
        textSize: Number(textSize.value)
      }));
    };

    theme.addEventListener('change', applyAppearance);
    font.addEventListener('change', applyAppearance);
    textSize.addEventListener('input', applyAppearance);
    document.addEventListener('click', event => {
      if (!settingsMenu.contains(event.target)) settingsMenu.open = false;
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') settingsMenu.open = false;
    });
    applyAppearance();
  }

  function initializePwa() {
    const installButton = $('installAppButton');
    let installPrompt = null;

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      installPrompt = event;
      installButton.hidden = false;
    });
    installButton.addEventListener('click', async () => {
      if (!installPrompt) return;
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      installButton.hidden = true;
    });
    window.addEventListener('appinstalled', () => {
      installPrompt = null;
      installButton.hidden = true;
    });

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js?v=13')
          .catch(error => console.warn('Could not register the app service worker:', error));
      });
    }
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
    }

    let shouldSave = !row?.data;
    if (state.statsResetVersion < 1) {
      state.stats = { ...defaultState().stats };
      state.statsResetVersion = 1;
      shouldSave = true;
    }
    if (shouldSave) {
      const { error: saveError } = await supabaseClient.from('life_states').upsert({
        user_id: user.id,
        data: JSON.parse(JSON.stringify(state)),
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
      updateProfileAvatar(null);
      return;
    }
    if (loadedUserId === user.id) return;
    if (loadingUserId === user.id) return;

    currentUser = user;
    updateProfileAvatar(user);
    loadingUserId = user.id;
    $('app-panel').hidden = true;
    $('auth-panel').hidden = false;
    $('authSignOutButton').hidden = false;
    setAuthMessage('Loading your saved workspace…');
    try {
      const loaded = await loadUserState(user);
      if (!loaded || currentUser?.id !== user.id) return;
      loadedUserId = user.id;
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
    localStorage.setItem(REMEMBER_KEY, String($('rememberMe').checked));
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
    localStorage.setItem(REMEMBER_KEY, String($('rememberMe').checked));
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
    initializeAppearance();
    initializePwa();
    initializePomodoro();
    $('todayLabel').textContent = new Date().toLocaleDateString(undefined, { dateStyle: 'medium' });
    $('rememberMe').checked = localStorage.getItem(REMEMBER_KEY) !== 'false';
    applyStateToPage();
    showPage('today');
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