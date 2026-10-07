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
      xp: 0,
      inventory: [
        { name: 'Laptop', category: 'Tech' },
        { name: 'Notebook', category: 'Study' },
        { name: 'Pen', category: 'Study' }
      ],
      skills: ['HTML', 'CSS', 'JavaScript', 'Python'],
      notifications: 'No new notifications.',
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

  function normalizeState(value) {
    const defaults = defaultState();
    const saved = value && typeof value === 'object' ? value : {};
    return {
      ...defaults,
      ...saved,
      profile: { ...defaults.profile, ...(saved.profile || {}) },
      stats: { ...defaults.stats, ...(saved.stats || {}) },
      tasks: Array.isArray(saved.tasks) ? saved.tasks.map(task => ({
        ...task,
        text: String(task?.text || ''),
        date: String(task?.date || ''),
        done: Boolean(task?.done),
        priority: ['Low', 'Medium', 'High'].includes(task?.priority) ? task.priority : 'Medium',
        category: ['School', 'Work', 'Life'].includes(task?.category) ? task.category : 'Life',
        stat: names.includes(task?.stat) ? task.stat : '',
        xpClaimed: Boolean(task?.xpClaimed),
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
      skills: normalizeSkills(saved.skills ?? defaults.skills),
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
  let selectedDate = '';
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
    const notificationsField = $('notifications');
    state.notifications = notificationsField ? notificationsField.value : state.notifications ?? 'No new notifications.';
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
    const notificationsField = $('notifications');
    if (notificationsField) {
      notificationsField.value = state.notifications ?? 'No new notifications.';
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
    renderSkills();
    updateProgress();
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
    if (id === 'tasks' || id === 'status') renderTasks();
    if (id === 'inventory') renderInventory();
    if (id === 'skills') renderSkills();
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
    task.done = done;
    task.completedAt = done ? today : '';
    if (done && !task.xpClaimed) {
      state.xp += 10;
      task.xpClaimed = true;
      if (task.stat) state.stats[task.stat] = (state.stats[task.stat] || 0) + 1;
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
        form.innerHTML = `<div class="task-edit-title"><label>Task name<input name="text" value="${escapeHtml(task.text)}" required></label></div><div><label>Due date<input name="date" type="date" value="${escapeHtml(task.date)}"></label></div><div><label>Priority<select name="priority">${['Low', 'Medium', 'High'].map(value => `<option${task.priority === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div><div><label>Category<select name="category">${['Life', 'School', 'Work'].map(value => `<option${task.category === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div><div><label>Reward stat<select name="stat"><option value="">No stat</option>${names.map(value => `<option${task.stat === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div><div class="task-edit-actions"><button type="submit">Save</button><button type="button" class="task-edit-cancel">Cancel</button></div>`;
        item.appendChild(form);
        form.onsubmit = event => {
          event.preventDefault();
          const text = form.elements.text.value.trim();
          if (!text) return;
          task.text = text;
          task.date = form.elements.date.value;
          task.priority = form.elements.priority.value;
          task.category = form.elements.category.value;
          task.stat = form.elements.stat.value;
          editingTask = null;
          save();
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
      item.innerHTML = `<div class="task-main"><input class="task-check" type="checkbox" ${task.done ? 'checked' : ''} aria-label="Complete ${escapeHtml(task.text)}"><div class="task-content"><div class="task-title ${task.done ? 'completed' : ''}">${escapeHtml(task.text)}${task.date ? `<small class="task-date ${overdue ? 'overdue' : ''}">${overdue ? 'Overdue · ' : ''}${escapeHtml(task.date)}</small>` : ''}</div><div class="task-badges"><span class="badge priority-${task.priority.toLowerCase()}">${escapeHtml(task.priority)}</span><span class="badge category-${task.category.toLowerCase()}">${escapeHtml(task.category)}</span>${task.stat ? `<span class="badge stat-badge">+1 ${escapeHtml(task.stat)}</span>` : ''}</div><div class="subtask-list">${task.subtasks.map((subtask, subIndex) => `<label class="subtask"><input type="checkbox" data-subtask="${subIndex}" ${subtask.done ? 'checked' : ''}><span class="${subtask.done ? 'completed' : ''}">${escapeHtml(subtask.text)}</span></label>`).join('')}<form class="subtask-form"><input name="subtask" placeholder="Add checklist item" aria-label="Add checklist item"><button type="submit" aria-label="Add checklist item">+</button></form></div></div></div><div class="task-actions"><button class="icon task-edit" type="button" aria-label="Edit ${escapeHtml(task.text)}" title="Edit task">✎</button><button class="icon task-delete" type="button" aria-label="Delete ${escapeHtml(task.text)}">×</button></div>`;
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

  $('addTask').onclick = () => {
    const text = $('taskInput').value.trim();
    if (!text) return;
    state.tasks.push({
      text,
      date: $('taskDate').value,
      done: false,
      priority: $('taskPriority').value,
      category: $('taskCategory').value,
      stat: $('taskStat').value,
      xpClaimed: false,
      completedAt: '',
      subtasks: []
    });
    $('taskInput').value = '';
    save();
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
    $('diaryStatus').textContent = entry.feeling && entry.entry ? 'Entry saved' : 'No entry saved for this date';
  }

  $('diaryDate').addEventListener('change', () => {
    selectedDate = $('diaryDate').value || today;
    viewDate = new Date(`${selectedDate}T12:00:00`);
    renderDiary();
    renderCalendar();
  });
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
        navigator.serviceWorker.register('./service-worker.js')
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
    $('todayLabel').textContent = new Date().toLocaleDateString(undefined, { dateStyle: 'medium' });
    $('rememberMe').checked = localStorage.getItem(REMEMBER_KEY) !== 'false';
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