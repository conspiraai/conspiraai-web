const REFLECTION_STORAGE_KEY = 'conspiraDailyReflectionVotes';

const REFLECTION_PROMPTS = [
  'What outcome would make you break your plan today?',
  'Are you seeking confirmation — or information?',
  'What would “doing nothing” look like if you were disciplined?',
  'What is the clearest invalidation for your current bias?',
  'If volatility expands, where do you usually overreact?',
  'What would make a solid setup feel “too boring” to follow?',
  'Are you following your system — or your mood?',
  'What is one risk you are currently underestimating?',
  'What is the one thing you must protect today: capital, clarity, or patience?',
  'What would you do if you could not check the chart for four hours?',
  'Where are you most likely to chase?',
  'What is your default mistake in choppy regimes?',
  'What would staying neutral protect you from today?',
  'Which assumption feels most fragile right now?',
  'What is the smallest action that would still feel aligned?'
];

const memoryVotes = {};

function storageAvailable() {
  try {
    const testKey = '__conspira_reflection_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    console.warn('Reflection storage unavailable:', error);
    return false;
  }
}

const canUseStorage = storageAvailable();

function readVotes() {
  if (!canUseStorage) return { ...memoryVotes };
  const raw = localStorage.getItem(REFLECTION_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Unable to parse reflection votes:', error);
    return {};
  }
}

function writeVotes(votes) {
  if (!canUseStorage) {
    Object.assign(memoryVotes, votes);
    return;
  }
  try {
    localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify(votes));
  } catch (error) {
    console.warn('Unable to save reflection votes:', error);
  }
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash + value.charCodeAt(index) * (index + 1)) % 2147483647;
  }
  return hash;
}

function getDailyIndex(dateKey, total) {
  if (!total) return 0;
  return Math.abs(hashString(dateKey)) % total;
}

function calculateStreak(votes, today) {
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  while (true) {
    const key = getDateKey(cursor);
    if (votes[key] === 'up') {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

function initReflectionPanel() {
  const questionEl = document.getElementById('reflection-question');
  const upBtn = document.getElementById('reflection-up');
  const downBtn = document.getElementById('reflection-down');
  const streakEl = document.getElementById('reflection-streak');
  const swapBtn = document.getElementById('reflection-swap');

  if (!questionEl || !upBtn || !downBtn || !streakEl || !swapBtn) return;

  if (!REFLECTION_PROMPTS.length) {
    questionEl.textContent = '—';
    upBtn.disabled = true;
    downBtn.disabled = true;
    swapBtn.disabled = true;
    return;
  }

  const todayKey = getDateKey();
  const dailyIndex = getDailyIndex(todayKey, REFLECTION_PROMPTS.length);
  let sessionOffset = 0;

  const renderQuestion = () => {
    const index =
      (dailyIndex + sessionOffset + REFLECTION_PROMPTS.length) %
      REFLECTION_PROMPTS.length;
    questionEl.textContent = REFLECTION_PROMPTS[index] || '—';
  };

  const renderStreak = () => {
    const votes = readVotes();
    const streak = calculateStreak(votes, new Date());
    streakEl.textContent = `Streak: ${streak} day${streak === 1 ? '' : 's'}`;
  };

  const renderVoteState = () => {
    const votes = readVotes();
    const vote = votes[todayKey];
    const isUp = vote === 'up';
    const isDown = vote === 'down';

    upBtn.classList.toggle('is-selected', isUp);
    downBtn.classList.toggle('is-selected', isDown);
    upBtn.setAttribute('aria-pressed', String(isUp));
    downBtn.setAttribute('aria-pressed', String(isDown));
  };

  const saveVote = (value) => {
    const votes = readVotes();
    votes[todayKey] = value;
    writeVotes(votes);
    renderVoteState();
    renderStreak();
  };

  upBtn.addEventListener('click', () => {
    saveVote('up');
  });

  downBtn.addEventListener('click', () => {
    saveVote('down');
  });

  swapBtn.addEventListener('click', () => {
    sessionOffset = (sessionOffset + 1) % REFLECTION_PROMPTS.length;
    renderQuestion();
  });

  renderQuestion();
  renderVoteState();
  renderStreak();
}

initReflectionPanel();
