import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const firebaseApp = initializeApp({
  apiKey: 'AIzaSyCnwDa8FTh8i37zzRiPuFExAVer8rYSZts',
  authDomain: 'my-calendar-app-b767f.firebaseapp.com',
  projectId: 'my-calendar-app-b767f',
  storageBucket: 'my-calendar-app-b767f.firebasestorage.app',
  messagingSenderId: '1020446559226'
});
const auth = getAuth(firebaseApp), db = getFirestore(firebaseApp), provider = new GoogleAuthProvider();
let cloudUser = null, loadingCloud = false;
const nowDate = new Date();
const STORAGE_KEYS = { events: 'my-calendar-events-v1', schedule: 'my-calendar-schedule-v1', app: 'my-calendar-app-v1' };
function readSavedData(key, fallback = []) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return Array.isArray(data) ? data : fallback;
  } catch {
    return fallback;
  }
}
function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); if (!loadingCloud) queueCloudSave(); }
function readSavedObject(key, fallback) {
  try { return { ...fallback, ...(JSON.parse(localStorage.getItem(key)) || {}) }; } catch { return fallback; }
}
const state = readSavedObject(STORAGE_KEYS.app, { year: nowDate.getFullYear(), month: nowDate.getMonth(), day: nowDate.getDate(), view: 'month' });
function saveAppState() { saveData(STORAGE_KEYS.app, state); }
let events = readSavedData(STORAGE_KEYS.events);
let activeArea = 'calendar';
const areaNames = { calendar: 'Lịch', gaming: 'Giải trí', work: 'Công việc' };
const months = ['THÁNG 1', 'THÁNG 2', 'THÁNG 3', 'THÁNG 4', 'THÁNG 5', 'THÁNG 6', 'THÁNG 7', 'THÁNG 8', 'THÁNG 9', 'THÁNG 10', 'THÁNG 11', 'THÁNG 12'];
const vietnamHolidays = {
  '01-01': 'Tết Dương lịch',
  '02-03': 'Ngày thành lập Đảng Cộng sản Việt Nam',
  '02-27': 'Ngày Thầy thuốc Việt Nam',
  '03-08': 'Ngày Quốc tế Phụ nữ',
  '03-26': 'Ngày thành lập Đoàn TNCS Hồ Chí Minh',
  '04-30': 'Ngày Giải phóng miền Nam',
  '05-01': 'Ngày Quốc tế Lao động',
  '05-19': 'Ngày sinh Chủ tịch Hồ Chí Minh',
  '06-01': 'Ngày Quốc tế Thiếu nhi',
  '06-28': 'Ngày Gia đình Việt Nam',
  '07-27': 'Ngày Thương binh Liệt sĩ',
  '08-19': 'Ngày Cách mạng tháng Tám',
  '09-02': 'Quốc khánh Việt Nam',
  '10-01': 'Ngày Quốc tế Người cao tuổi',
  '10-20': 'Ngày Phụ nữ Việt Nam',
  '11-20': 'Ngày Nhà giáo Việt Nam',
  '12-22': 'Ngày thành lập Quân đội Nhân dân Việt Nam'
};
const lunarHolidays2026 = {
  '2026-02-10': 'Ngày ông Táo chầu trời',
  '2026-02-17': 'Tết Nguyên Đán',
  '2026-02-18': 'Tết Nguyên Đán',
  '2026-02-19': 'Tết Nguyên Đán',
  '2026-02-20': 'Tết Nguyên Đán',
  '2026-02-21': 'Tết Nguyên Đán',
  '2026-03-03': 'Tết Nguyên Tiêu',
  '2026-04-19': 'Tết Hàn Thực',
  '2026-04-26': 'Giỗ Tổ Hùng Vương',
  '2026-05-31': 'Lễ Phật Đản',
  '2026-06-19': 'Tết Đoan Ngọ',
  '2026-08-27': 'Lễ Vu Lan',
  '2026-09-25': 'Tết Trung Thu',
  '2026-10-19': 'Tết Trùng Cửu',
  '2026-11-20': 'Giỗ tổ nghề sân khấu'
};

function holidayFor(key) {
  const [, month, day] = key.split('-');
  return vietnamHolidays[`${month}-${day}`] || lunarHolidays2026[key] || '';
}

const weekdays = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const colors = ['mint', 'pink', 'purple'],
  grid = document.querySelector('#calendar-grid'),
  monthView = document.querySelector('#month-view'),
  weekView = document.querySelector('#week-view'),
  dayView = document.querySelector('#day-view'),
  agenda = document.querySelector('#agenda-view'),
  dialog = document.querySelector('#event-dialog');
const addButton = document.querySelector('#add-event'),
  filterButton = document.querySelector('#filter-button'),
  headerActions = document.createElement('div');
headerActions.className = 'header-actions';
filterButton.before(headerActions);
headerActions.append(addButton, filterButton);
const themeTitle = document.createElement('div');
themeTitle.className = 'theme-title hidden';
document.querySelector('.topbar').after(themeTitle);
filterButton.setAttribute('aria-expanded', 'false');
const quickMenu = document.createElement('div');
quickMenu.className = 'quick-menu';
quickMenu.innerHTML = `<button type="button" data-section="schedule"><span>🎓</span><div><strong>Thời khóa biểu</strong><small>Đi học / đi làm</small></div></button><button type="button" data-section="gaming"><span>🎮</span><div><strong>Giải trí</strong><small>Thư giãn và sở thích</small></div></button><button type="button" data-section="work"><span>💼</span><div><strong>Công việc</strong><small>Việc cần hoàn thành</small></div></button>`;
headerActions.append(quickMenu);
filterButton.addEventListener('click', event => {
  event.stopPropagation();
  const open = quickMenu.classList.toggle('open');
  filterButton.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', event => {
  if (!headerActions.contains(event.target)) {
    quickMenu.classList.remove('open');
    filterButton.setAttribute('aria-expanded', 'false');
  }
});
const scheduleView = document.createElement('section');
scheduleView.id = 'schedule-view';
scheduleView.className = 'schedule-view hidden';
document.querySelector('#agenda-view').after(scheduleView);
const scanDialog = document.createElement('dialog');
scanDialog.className = 'scan-dialog';
scanDialog.innerHTML = `<section><button type="button" class="scan-close" aria-label="Đóng">×</button><p class="eyebrow">QUÉT THỜI KHÓA BIỂU</p><h2>Đọc môn học từ ảnh</h2><p class="scan-note">Ảnh chỉ được xử lý trong trình duyệt của bạn. Hãy chụp rõ toàn bộ bảng thời khóa biểu.</p><label class="scan-upload">📷 Chọn ảnh<input id="schedule-image" type="file" accept="image/*"></label><img id="schedule-preview" class="hidden" alt="Ảnh thời khóa biểu đã chọn"><p id="scan-status" class="scan-status"></p><div id="scan-result" class="scan-result hidden"></div><button type="button" id="apply-scan" class="scan-apply hidden">Áp dụng vào thời khóa biểu</button></section>`;
document.body.append(scanDialog);
let scannedEntries = [];
const scheduleEntries = readSavedData(STORAGE_KEYS.schedule);
let cloudSaveTimer;
function queueCloudSave() {
  if (!cloudUser || loadingCloud) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    try {
      await setDoc(doc(db, 'userCalendars', cloudUser.uid), { events, scheduleEntries, appState: state, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.warn('Không thể đồng bộ Firebase:', error);
    }
  }, 350);
}
const scheduleDays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
function loadOcr() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error('Không tải được công cụ OCR'));
    document.head.append(script);
  });
}
function isScheduleLabel(text) {
  return /^(thu|thứ|sang|sáng|chieu|chiều|tiet|tiết|mon|môn|monday|tuesday|wednesday|thursday|friday|saturday|[1-7])$/i.test(text.trim());
}
function mapOcrToSchedule(lines, width, height) {
  const content = lines.filter(line => line.text.trim().length > 1 && !isScheduleLabel(line.text));
  return content.map(line => {
    const centerX = line.bbox.x0 + (line.bbox.x1 - line.bbox.x0) / 2;
    const centerY = line.bbox.y0 + (line.bbox.y1 - line.bbox.y0) / 2;
    const dayIndex = Math.max(0, Math.min(5, Math.floor((centerX / width) * 6)));
    const rowIndex = Math.max(0, Math.min(7, Math.floor((centerY / height) * 8)));
    return { day: scheduleDays[dayIndex], session: rowIndex < 4 ? 'morning' : 'afternoon', period: (rowIndex % 4) + 1, subject: line.text.trim() };
  });
}
async function scanScheduleFile(file) {
  const preview = document.querySelector('#schedule-preview'), status = document.querySelector('#scan-status'), result = document.querySelector('#scan-result'), apply = document.querySelector('#apply-scan');
  preview.src = URL.createObjectURL(file); preview.classList.remove('hidden'); result.classList.add('hidden'); apply.classList.add('hidden'); status.textContent = 'Đang đọc ảnh…';
  try {
    const Tesseract = await loadOcr();
    const { data } = await Tesseract.recognize(file, 'vie+eng', { logger: message => { if (message.status === 'recognizing text') status.textContent = `Đang dò chữ… ${Math.round(message.progress * 100)}%`; } });
    scannedEntries = mapOcrToSchedule(data.lines || [], data.width || preview.naturalWidth, data.height || preview.naturalHeight);
    status.textContent = scannedEntries.length ? `Đã tìm thấy ${scannedEntries.length} mục. Kiểm tra trước khi áp dụng.` : 'Chưa đọc được môn học rõ ràng. Hãy thử ảnh sáng hơn, chụp thẳng bảng.';
    result.innerHTML = scannedEntries.map(entry => `<p><b>${entry.day} · ${entry.session === 'morning' ? 'Sáng' : 'Chiều'} · Tiết ${entry.period}</b>${safe(entry.subject)}</p>`).join('');
    result.classList.toggle('hidden', !scannedEntries.length); apply.classList.toggle('hidden', !scannedEntries.length);
  } catch (error) { status.textContent = 'Không thể quét ảnh. Hãy kiểm tra kết nối mạng rồi thử lại.'; console.warn(error); }
}
document.querySelector('.scan-close').onclick = () => scanDialog.close();
document.querySelector('#schedule-image').onchange = event => { if (event.target.files[0]) scanScheduleFile(event.target.files[0]); };
document.querySelector('#apply-scan').onclick = () => { scannedEntries.forEach(entry => { const old = scheduleEntries.find(item => item.day === entry.day && item.session === entry.session && item.period === entry.period); if (old) old.subject = entry.subject; else scheduleEntries.push(entry); }); saveData(STORAGE_KEYS.schedule, scheduleEntries); scanDialog.close(); renderSchedule(); };
function renderSchedule() {
  const cell = (day, session, period) => {
    const entry = scheduleEntries.find(item => item.day === day && item.session === session && item.period === period);
    return `<div class="schedule-cell ${entry ? 'filled' : ''}" title="${entry ? safe(entry.subject) : 'Trống'}">${entry ? safe(entry.subject) : ''}</div>`;
  };
  scheduleView.innerHTML = `<div class="schedule-title"><button id="close-schedule" aria-label="Đóng thời khóa biểu">‹</button><div><p class="eyebrow">LỊCH CÁ NHÂN</p><h2>Thời khóa biểu</h2></div><button id="scan-schedule" class="scan-button" type="button">📷 Quét ảnh</button></div><section class="schedule-card"><div class="schedule-table"><div class="schedule-corner"></div>${scheduleDays.map((day, index) => `<div class="schedule-day day-${index + 2}">${day}</div>`).join('')}<div class="session-label morning">Sáng</div>${[1, 2, 3, 4].flatMap(period => scheduleDays.map(day => cell(day, 'morning', period))).join('')}<div class="session-label afternoon">Chiều</div>${[1, 2, 3, 4].flatMap(period => scheduleDays.map(day => cell(day, 'afternoon', period))).join('')}</div></section><form class="schedule-form" id="schedule-form"><label>Thứ<select id="schedule-day">${scheduleDays.map(day => `<option>${day}</option>`).join('')}</select></label><label>Buổi<select id="schedule-session"><option value="morning">Sáng</option><option value="afternoon">Chiều</option></select></label><label>Tiết<select id="schedule-period"><option value="1">Tiết 1</option><option value="2">Tiết 2</option><option value="3">Tiết 3</option><option value="4">Tiết 4</option></select></label><label class="subject-field">Môn học / công việc<input id="schedule-subject" placeholder="Ví dụ: Toán, Họp nhóm" required></label><button type="submit">Thêm vào bảng</button></form><p class="schedule-hint">Chọn thông tin rồi thêm vào ô tương ứng trong thời khóa biểu.</p>`;
  scheduleView.querySelector('#close-schedule').onclick = closeSchedule;
  scheduleView.querySelector('#scan-schedule').onclick = () => scanDialog.showModal();
  scheduleView.querySelector('#schedule-form').onsubmit = event => {
    event.preventDefault();
    const day = scheduleView.querySelector('#schedule-day').value, session = scheduleView.querySelector('#schedule-session').value, period = Number(scheduleView.querySelector('#schedule-period').value), subject = scheduleView.querySelector('#schedule-subject').value.trim();
    const old = scheduleEntries.find(item => item.day === day && item.session === session && item.period === period);
    if (old) old.subject = subject; else scheduleEntries.push({ day, session, period, subject });
    saveData(STORAGE_KEYS.schedule, scheduleEntries);
    renderSchedule();
  };
}
function resetThemeToHome() {
  activeArea = 'calendar';
  document.querySelector('.app-shell').classList.remove('gaming-theme', 'work-theme');
  themeStickers.innerHTML = '';
  document.querySelectorAll('.zone-sticker').forEach(sticker => sticker.remove());
  document.querySelector('.topbar .eyebrow').textContent = 'LỊCH CỦA TÔI';
  themeTitle.classList.add('hidden'); themeTitle.innerHTML = '';
}
function openSchedule() { resetThemeToHome(); utilityView.classList.add('hidden'); monthView.classList.add('hidden'); weekView.classList.add('hidden'); dayView.classList.add('hidden'); agenda.classList.add('hidden'); viewTabs.classList.add('hidden'); scheduleView.classList.remove('hidden'); quickMenu.classList.remove('open'); renderSchedule(); animateScreen('forward'); }
function closeSchedule() { scheduleView.classList.add('hidden'); viewTabs.classList.remove('hidden'); setView(state.view); animateScreen('back'); }
quickMenu.querySelector('[data-section="schedule"]').onclick = openSchedule;
const themeStickers = document.createElement('div');
themeStickers.className = 'theme-stickers';
document.querySelector('.app-shell').prepend(themeStickers);
function placeThemeStickers(theme) {
  document.querySelectorAll('.zone-sticker').forEach(sticker => sticker.remove());
  const set = theme === 'gaming' ? ['🎮','🕹️','👾','🔥','📺','🎧','🎬','⚡','🏆','🚀'] : ['💼','📌','📈','👩‍💼','📊','📝','💡','✅','📂','⌨️'];
  const add = (parent, emoji, corner) => {
    const sticker = document.createElement('span');
    sticker.className = `zone-sticker ${corner}`;
    sticker.textContent = emoji;
    parent.append(sticker);
  };
  const calendar = document.querySelector('.calendar-card'), today = document.querySelector('.agenda');
  ['top-left','top-right','bottom-left','bottom-right'].forEach((corner, index) => add(calendar, set[index], corner));
  ['top-left','top-right','bottom-left','bottom-right'].forEach((corner, index) => add(today, set[index + 4], corner));
  add(viewTabs, set[8], 'tabs-left');
  add(viewTabs, set[9], 'tabs-right');
}
function openThemeCalendar(theme) {
  activeArea = theme;
  scheduleView.classList.add('hidden'); utilityView.classList.add('hidden'); viewTabs.classList.remove('hidden');
  document.querySelector('.app-shell').classList.remove('gaming-theme', 'work-theme');
  document.querySelector('.app-shell').classList.add(`${theme}-theme`);
  themeStickers.innerHTML = '';
  document.querySelector('.topbar .eyebrow').textContent = theme === 'gaming' ? 'KHU GIẢI TRÍ' : 'KHÔNG GIAN CÔNG VIỆC';
  themeTitle.classList.remove('hidden');
  themeTitle.innerHTML = `<button type="button" aria-label="Quay về Trang chủ">‹</button><div><p class="eyebrow">${theme === 'gaming' ? 'GIẢI TRÍ' : 'CÔNG VIỆC'}</p><h2>${theme === 'gaming' ? 'Lịch giải trí' : 'Lịch công việc'}</h2></div>`;
  themeTitle.querySelector('button').onclick = () => { resetThemeToHome(); utilityView.classList.add('hidden'); viewTabs.classList.remove('hidden'); setView(state.view); animateScreen('back'); };
  quickMenu.classList.remove('open'); setView(state.view); placeThemeStickers(theme); animateScreen('forward');
}
quickMenu.querySelector('[data-section="gaming"]').onclick = () => openThemeCalendar('gaming');
quickMenu.querySelector('[data-section="work"]').onclick = () => openThemeCalendar('work');
const viewTabs = document.querySelector('.view-tabs');
const utilityView = document.createElement('section');
utilityView.id = 'utility-view';
utilityView.className = 'utility-view hidden';
agenda.after(utilityView);
const allTasksNav = document.createElement('button');
allTasksNav.className = 'nav-item';
allTasksNav.innerHTML = '<span>☷</span>Danh sách';
document.querySelector('.bottom-nav').insertBefore(allTasksNav, document.querySelector('.bottom-nav .nav-item:last-child'));
const navButtons = [...document.querySelectorAll('.bottom-nav .nav-item')];
const viewOrder = ['month', 'list', 'week', 'day'];
function animateScreen(direction) {
  const shell = document.querySelector('.app-shell');
  shell.classList.remove('screen-forward', 'screen-back');
  void shell.offsetWidth;
  shell.classList.add(direction === 'forward' ? 'screen-forward' : 'screen-back');
  setTimeout(() => shell.classList.remove('screen-forward', 'screen-back'), 380);
}
function animateCalendarContent(direction) {
  document.querySelectorAll('#month-view:not(.hidden),#week-view:not(.hidden),#day-view:not(.hidden),#agenda-view:not(.hidden)').forEach(element => {
    element.classList.remove('calendar-forward', 'calendar-back');
    void element.offsetWidth;
    element.classList.add(direction === 'forward' ? 'calendar-forward' : 'calendar-back');
  });
}
function bottomDirection(nextIndex) {
  const currentIndex = navButtons.findIndex(button => button.classList.contains('selected'));
  return nextIndex >= currentIndex ? 'forward' : 'back';
}

const pad = n => String(n).padStart(2, '0'),
  dateKey = () => `${state.year}-${pad(state.month + 1)}-${pad(state.day)}`,
  fromKey = k => new Date(`${k}T00:00:00`),
  keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const safe = s => s.replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

function emoji(title, desc) {
  const t = `${title} ${desc}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
    rules = [
      [/hop|meeting|gap|khach hang|client/, '👥'],
      [/email|thu|mail/, '📨'],
      [/hoc|bai tap|on thi|study|doc sach/, '📚'],
      [/an |trua|toi|sang|cafe|ca phe|nha hang/, '🍽️'],
      [/tap|gym|chay|yoga|the thao|bong/, '🏃'],
      [/goi|dien thoai|call/, '📞'],
      [/mua|sieu thi|shopping|dat hang/, '🛒'],
      [/sinh nhat|birthday|tiec/, '🎂'],
      [/du lich|di choi|may bay|ve xe/, '✈️'],
      [/bac si|kham|benh vien|nha khoa/, '🩺'],
      [/code|lap trinh|bug|website|du an/, '💻'],
      [/thanh toan|hoa don|tien|ngan hang/, '💳'],
      [/deadline|bao cao|nop|report/, '📌']
    ];
  return (rules.find(([r]) => r.test(t)) || [, '✨'])[1];
}

const areaOf = event => event.area || 'calendar';
const forDate = date => events.filter(event => event.date === date && areaOf(event) === activeArea).sort((a, b) => a.time.localeCompare(b.time));
const allForDate = date => events.filter(event => event.date === date).sort((a, b) => a.time.localeCompare(b.time));
function conflictsForDate(date) {
  const slots = new Map();
  events.filter(event => event.date === date).forEach(event => {
    const list = slots.get(event.time) || [];
    list.push(event); slots.set(event.time, list);
  });
  return [...slots.values()].some(list => new Set(list.map(areaOf)).size > 1);
}
function showConflict(otherArea) {
  document.querySelector('.conflict-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'conflict-toast';
  toast.innerHTML = `⚠️ <span>Bạn đã đặt công việc ở khung giờ này trùng với công việc ở <b>${areaNames[otherArea]}</b>.</span>`;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 4800);
}

function eventCards(list) {
  return list.length
    ? list
        .map(
          e =>
            `<article class="event"><time class="event-time">${e.time}</time><span class="event-bar ${e.color}"></span><div><h3>${safe(
              e.title
            )}</h3><p>${safe(e.description || 'Không có mô tả.')}</p></div><span class="event-icon">${e.icon}</span><button class="delete-event" type="button" data-delete-index="${events.indexOf(e)}" aria-label="Xóa ${safe(e.title)}">×</button></article>`
        )
        .join('')
    : '<p class="empty">Chưa có công việc nào. Nhấn dấu + để thêm.</p>';
}
function bindDeleteButtons() {
  document.querySelectorAll('[data-delete-index]').forEach(button => {
    button.onclick = () => {
      const index = Number(button.dataset.deleteIndex);
      if (!Number.isInteger(index) || !events[index]) return;
      events.splice(index, 1);
      saveData(STORAGE_KEYS.events, events);
      renderAll();
    };
  });
}

function renderCalendar() {
  document.querySelector('#calendar-title').textContent = `${months[state.month]}, ${state.year}`;
  document.querySelector('h1').textContent = `${months[state.month].replace('THÁNG', 'Tháng')}, ${state.year}`;
  const leading = (new Date(state.year, state.month, 1).getDay() + 6) % 7,
    total = new Date(state.year, state.month + 1, 0).getDate(),
    prev = new Date(state.year, state.month, 0).getDate();
  grid.innerHTML = '';
  for (let i = 0; i < 42; i++) {
    const day = i - leading + 1,
      inMonth = day > 0 && day <= total,
      shown = inMonth ? day : day <= 0 ? prev + day : day - total,
      key = inMonth ? `${state.year}-${pad(state.month + 1)}-${pad(day)}` : '',
      items = inMonth ? forDate(key) : [],
      button = document.createElement('button');
    button.className = `date ${inMonth ? '' : 'muted'} ${inMonth && day === state.day ? 'selected' : ''} ${inMonth && conflictsForDate(key) ? 'time-conflict' : ''}`;
    button.innerHTML = `<span>${shown}</span><i class="event-markers">${items
      .slice(0, 3)
      .map(e => `<b class="${e.color}"></b>`)
      .join('')}</i>`;
    if (inMonth) button.onclick = () => select(key);
    grid.append(button);
  }
}

function markHolidays() {
  grid.querySelectorAll('.date:not(.muted)').forEach(button => {
    const day = pad(Number(button.querySelector('span').textContent)),
      key = `${state.year}-${pad(state.month + 1)}-${day}`,
      holiday = holidayFor(key);
    if (holiday) {
      button.classList.add('holiday');
      button.title = holiday;
      button.querySelector('.event-markers').insertAdjacentHTML('beforeend', '<b class="holiday-marker">✨</b>');
    }
  });
}

function renderAgenda() {
  const d = fromKey(dateKey()),
    holiday = holidayFor(dateKey());
  document.querySelector('#agenda-date').textContent = `${weekdays[d.getDay()].toUpperCase()}, ${pad(state.day)} ${months[state.month]}, ${state.year}`;
  document.querySelector('#events').innerHTML = `${
    holiday ? `<article class="holiday-card">✨ <div><strong>${holiday}</strong><small>Ngày đặc biệt tại Việt Nam</small></div></article>` : ''
  }${eventCards(forDate(dateKey()))}`;
  bindDeleteButtons();
}

function renderWeek() {
  const start = fromKey(dateKey());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const activeDays = days.map((date, index) => ({ date, index, items: forDate(keyOf(date)) })).filter(item => item.items.length);
  weekView.innerHTML = `<div class="week-header"><strong>Tuần này</strong><span>${pad(days[0].getDate())}/${pad(days[0].getMonth() + 1)} — ${pad(
    days[6].getDate()
  )}/${pad(days[6].getMonth() + 1)}</span></div><div class="week-days">${days
    .map(
      (d, i) =>
        `<button class="week-day ${keyOf(d) === dateKey() ? 'today' : ''}" data-date="${keyOf(d)}">${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][i]}<b>${pad(
          d.getDate()
        )}</b></button>`
    )
    .join('')}</div><div class="week-schedule">${
    activeDays.length
      ? activeDays
          .map(({ date, index, items }) => {
            const k = keyOf(date);
            return `<section class="week-column"><button data-date="${k}"><strong>${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index]} / ${pad(
              date.getDate()
            )}</strong></button>${items
              .map(e => `<div class="week-event ${e.color}"><span>${e.time}</span>${e.icon} ${safe(e.title)}</div>`)
              .join('')}</section>`;
          })
          .join('')
      : '<p class="empty">Tuần này chưa có công việc.</p>'
  }</div>`;
  weekView.querySelectorAll('[data-date]').forEach(el => (el.onclick = () => select(el.dataset.date)));
}

function renderDay() {
  const items = forDate(dateKey()),
    hours = Array.from({ length: 13 }, (_, i) => i + 8),
    rows = hours
      .map(h => {
        const matches = items.filter(e => Number(e.time.slice(0, 2)) === h);
        return `<div class="timeline-row"><time>${pad(h)}:00</time><div class="timeline-slot">${matches
          .map(
            e =>
              `<article class="timeline-event ${e.color}"><span>${e.time}</span><strong>${e.icon} ${safe(e.title)}</strong><small>${safe(
                e.description || 'Không có mô tả.'
              )}</small></article>`
          )
          .join('')}</div></div>`;
      })
      .join('');
  dayView.innerHTML = `<div class="day-hero">${weekdays[fromKey(dateKey()).getDay()]}, ${pad(state.day)} ${
    months[state.month]
  }<strong>Lịch theo thời gian</strong></div><div class="timeline">${items.length ? rows : '<p class="empty">Chưa có công việc trong ngày này.</p>'}</div>`;
}

function statusOf(event) {
  if (event.done) return 'completed';
  return new Date(`${event.date}T${event.time}`) < new Date() ? 'overdue' : 'pending';
}

function dailyList(title, items, status) {
  return `<section class="daily-group"><h3><i class="${status}"></i>${title}<span>${items.length}</span></h3>${
    items.length
      ? items
          .map(
            event =>
              `<article><span>${event.icon}</span><div><strong>${safe(event.title)}</strong><small>${event.time}</small></div></article>`
          )
          .join('')
      : '<p>Không có công việc.</p>'
  }</section>`;
}

function streakCount() {
  let day = fromKey(dateKey()),
    count = 0;
  for (let index = 0; index < 365; index++) {
    const list = allForDate(keyOf(day));
    if (!list.length || !list.some(event => event.done)) break;
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

function renderProfile() {
  const today = allForDate(dateKey()),
    completed = today.filter(event => statusOf(event) === 'completed'),
    pending = today.filter(event => statusOf(event) === 'pending'),
    overdue = today.filter(event => statusOf(event) === 'overdue'),
    streak = streakCount();
  utilityView.innerHTML = `<div class="profile-card"><div class="profile-avatar">NT</div><div><h2>Người dùng</h2><p>Công việc ngày ${pad(
    state.day
  )}/${pad(state.month + 1)}</p></div></div><section class="streak-card"><span>🔥</span><div><strong>${streak} ngày chuỗi</strong><p>Hoàn thành tất cả việc trong ngày để duy trì chuỗi.</p></div></section><div class="daily-tasks">${dailyList(
    'Đã hoàn thành',
    completed,
    'completed'
  )}${dailyList('Chưa hoàn thành', pending, 'pending')}${dailyList('Bị trễ hẹn', overdue, 'overdue')}</div>`;
}

/* === HÀM HIỆU ỨNG ĐÃ ĐƯỢC CẬP NHẬT TẠI ĐÂY === */
function statsEffect(percent, total) {
  document.querySelector('.mood-effect')?.remove();
  if (!total) return;

  if (percent > 50) {
    if (typeof confetti === 'function') {
      // Confetti bay từ dưới đáy màn hình lên và rớt xuống
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 70,
        origin: { x: 0.1, y: 1 }, // Bay từ góc dưới bên trái
        startVelocity: 65,
        gravity: 0.9
      });
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 70,
        origin: { x: 0.9, y: 1 }, // Bay từ góc dưới bên phải
        startVelocity: 65,
        gravity: 0.9
      });
    }
  } else {
    const effect = document.createElement('div');
    effect.className = 'mood-effect angry';
    effect.textContent = '😠';
    document.body.append(effect);
    setTimeout(() => effect.remove(), 2000);
  }
}

function renderStats(date = dateKey()) {
  const items = allForDate(date),
    completed = items.filter(event => event.done).length,
    overdue = 0,
    pending = items.length - completed,
    total = items.length,
    completePercent = total ? Math.round((completed / total) * 100) : 0,
    pendingPercent = total ? 100 - completePercent : 0,
    overduePercent = 0,
    pie = total ? `conic-gradient(#55d0aa 0 ${completePercent}%,#9b7cf7 ${completePercent}% 100%)` : '#e8ecf1';
  utilityView.innerHTML = `<div class="utility-heading"><p class="eyebrow">THỐNG KÊ TRONG NGÀY</p><h2>Tiến độ công việc</h2></div><label class="stats-date">Chọn ngày <input id="stats-date" type="date" value="${date}"></label><section class="pie-card"><div class="pie-chart" style="background:${pie}"><span>${total}</span><small>công việc</small></div><div class="pie-legend"><p><i class="complete"></i>Đã hoàn thành <b>${completePercent}%</b></p><p><i class="pending"></i>Chưa hoàn thành <b>${pendingPercent}%</b></p><p><i class="overdue"></i>Bị trễ <b>${overduePercent}%</b></p></div></section>`;
  document.querySelector('#stats-date').onchange = event => renderStats(event.target.value);
  statsEffect(completePercent, total);
}

function renderUtility(kind) {
  navButtons.forEach((button, index) => button.classList.toggle('selected', index === { tasks: 1, stats: 2, all: 3, profile: 4 }[kind]));
  scheduleView.classList.add('hidden');
  viewTabs.classList.add('hidden');
  utilityView.classList.remove('hidden');
  monthView.classList.add('hidden');
  weekView.classList.add('hidden');
  dayView.classList.add('hidden');
  agenda.classList.add('hidden');
  if (kind === 'stats') {
    renderStats();
    return;
  }
  if (kind === 'profile') {
    renderProfile();
    return;
  }
  if (kind === 'all') {
    const grouped = events.slice().sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).reduce((groups, event) => {
      (groups[event.date] ||= []).push(event); return groups;
    }, {});
    utilityView.innerHTML = `<div class="utility-heading"><p class="eyebrow">TỔNG HỢP</p><h2>Danh sách công việc</h2><span>${events.length} công việc từ Lịch, Giải trí và Công việc</span></div><div class="all-task-list">${Object.keys(grouped).length ? Object.entries(grouped).map(([date, list]) => `<section class="all-date-group"><h3>${date.split('-').reverse().join('/')}</h3>${list.map(event => `<article><time>${event.time}</time><span>${event.icon}</span><div><strong>${safe(event.title)}</strong><small>${areaNames[areaOf(event)]}</small></div>${event.done ? '<b>✓</b>' : ''}</article>`).join('')}</section>`).join('') : '<p class="empty">Chưa có công việc nào.</p>'}</div>`;
    return;
  }
  if (kind === 'tasks') {
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    utilityView.innerHTML = `<div class="utility-heading"><p class="eyebrow">QUẢN LÝ CÁ NHÂN</p><h2>Công việc</h2><span>${
      sorted.filter(event => event.done).length
    }/${sorted.length} hoàn thành</span></div><div class="task-list">${
      sorted.length
        ? sorted
            .map(
              (event, index) =>
                `<button class="task-card ${event.done ? 'done' : ''}" data-task="${events.indexOf(event)}"><i>${
                  event.done ? '✓' : ''
                }</i><div><strong>${event.icon} ${safe(event.title)}</strong><small>${event.time} · ${event.date
                  .split('-')
                  .reverse()
                  .join('/')}</small></div></button>`
            )
            .join('')
        : '<p class="empty">Chưa có công việc. Hãy thêm từ mục Lịch.</p>'
    }</div>`;
    utilityView.querySelectorAll('[data-task]').forEach(
      button =>
        (button.onclick = () => {
          events[Number(button.dataset.task)].done = !events[Number(button.dataset.task)].done;
          saveData(STORAGE_KEYS.events, events);
          renderUtility('tasks');
        })
    );
  }
}

function setView(view) {
  state.view = view;
  saveAppState();
  scheduleView.classList.add('hidden');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  monthView.classList.toggle('hidden', view !== 'month');
  weekView.classList.toggle('hidden', view !== 'week');
  dayView.classList.toggle('hidden', view !== 'day');
  agenda.classList.toggle('hidden', view === 'week' || view === 'day');
  if (view === 'list') {
    document.querySelector('#agenda-heading').textContent = 'Tất cả công việc';
    document.querySelector('#agenda-date').textContent = `DANH SÁCH ${months[state.month]}`;
    document.querySelector('#events').innerHTML = eventCards(
      events
        .filter(e => e.date.startsWith(`${state.year}-${pad(state.month + 1)}`) && areaOf(e) === activeArea)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    );
  } else {
    document.querySelector('#agenda-heading').textContent = 'Lịch hôm nay';
    renderAgenda();
  }
  if (view === 'week') renderWeek();
  if (view === 'day') renderDay();
  bindDeleteButtons();
}

function select(key) {
  const d = fromKey(key);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  state.day = d.getDate();
  saveAppState();
  renderAll();
}

function renderAll() {
  renderCalendar();
  markHolidays();
  renderAgenda();
  renderWeek();
  renderDay();
  setView(state.view);
}

document.querySelectorAll('.tab').forEach(
  t =>
    (t.onclick = () => {
      const direction = viewOrder.indexOf(t.dataset.view) >= viewOrder.indexOf(state.view) ? 'forward' : 'back';
      utilityView.classList.add('hidden');
      viewTabs.classList.remove('hidden');
      setView(t.dataset.view);
      animateCalendarContent(direction);
    })
);
document.querySelector('#previous').onclick = () => {
  if (--state.month < 0) {
    state.month = 11;
    state.year--;
  }
  state.day = 1;
  saveAppState();
  renderAll();
};
document.querySelector('#next').onclick = () => {
  if (++state.month > 11) {
    state.month = 0;
    state.year++;
  }
  state.day = 1;
  saveAppState();
  renderAll();
};
addButton.onclick = () => {
  document.querySelector('#event-date').value = dateKey();
  dialog.showModal();
};
document.querySelector('#close-dialog').onclick = () => dialog.close();
document.querySelector('#event-form').onsubmit = e => {
  e.preventDefault();
  const title = document.querySelector('#event-name').value.trim(),
    date = document.querySelector('#event-date').value,
    time = document.querySelector('#event-time').value,
    description = document.querySelector('#event-description').value.trim();
  if (!title || !date || !time) return;
  const conflictingEvent = events.find(event => event.date === date && event.time === time && areaOf(event) !== activeArea);
  events.push({ title, date, time, description, area: activeArea, icon: emoji(title, description), color: colors[events.length % colors.length] });
  saveData(STORAGE_KEYS.events, events);
  if (conflictingEvent) showConflict(areaOf(conflictingEvent));
  dialog.close();
  e.target.reset();
  select(date);
};
navButtons[0].onclick = () => {
  const direction = bottomDirection(0);
  scheduleView.classList.add('hidden');
  utilityView.classList.add('hidden');
  viewTabs.classList.remove('hidden');
  setView(state.view);
  navButtons.forEach((button, index) => button.classList.toggle('selected', index === 0));
  animateScreen(direction);
};
navButtons[1].onclick = () => { const direction = bottomDirection(1); renderUtility('tasks'); animateScreen(direction); };
navButtons[2].onclick = () => { const direction = bottomDirection(2); renderUtility('stats'); animateScreen(direction); };
navButtons[3].onclick = () => { const direction = bottomDirection(3); renderUtility('all'); animateScreen(direction); };
navButtons[4].onclick = () => { const direction = bottomDirection(4); renderUtility('profile'); animateScreen(direction); };

renderAll();
