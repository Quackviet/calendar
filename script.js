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
const offlineGate = document.createElement('div');
offlineGate.className = 'offline-gate hidden';
offlineGate.innerHTML = '<div><span>📶</span><h1>Cần kết nối Internet</h1><p>Hãy kết nối Wi‑Fi hoặc Internet để tiếp tục dùng lịch.</p><button type="button">Thử lại</button></div>';
document.body.append(offlineGate);
function updateConnectionGate() { offlineGate.classList.toggle('hidden', navigator.onLine); }
window.addEventListener('online', updateConnectionGate);
window.addEventListener('offline', updateConnectionGate);
offlineGate.querySelector('button').onclick = updateConnectionGate;
updateConnectionGate();
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
const todayLabel = document.createElement('p');
todayLabel.id = 'today-label';
todayLabel.className = 'today-label';
todayLabel.style.cssText = 'margin:0;color:#243047;font-size:22px;font-weight:900;letter-spacing:-.35px;line-height:1.25';
document.querySelector('.topbar .eyebrow').after(todayLabel);
document.querySelector('.topbar h1').style.display = 'none';
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
const startDateInput = document.querySelector('#event-date'),
  startTimeInput = document.querySelector('#event-time');
startDateInput.closest('label').firstChild.nodeValue = 'Ngày bắt đầu';
startTimeInput.closest('label').firstChild.nodeValue = 'Giờ bắt đầu';
startTimeInput.closest('label').insertAdjacentHTML(
  'afterend',
  '<label>Ngày kết thúc<input id="event-end-date" type="date" required></label><label>Giờ kết thúc<input id="event-end-time" type="time" value="10:00" required></label>'
);
const endDateInput = document.querySelector('#event-end-date'),
  endTimeInput = document.querySelector('#event-end-time');
const addButton = document.querySelector('#add-event'),
  filterButton = document.querySelector('#filter-button'),
  headerActions = document.createElement('div');
const quickDatePicker = document.createElement('div');
quickDatePicker.className = 'quick-date-picker';
quickDatePicker.innerHTML = '<label>Chọn nhanh ngày<input id="quick-date" type="date" aria-label="Chọn nhanh ngày"></label><button type="button" id="go-today">Hôm nay</button>';
quickDatePicker.style.cssText = 'display:flex;align-items:end;gap:8px;margin:0 2px 11px;padding:8px 9px;border-radius:12px;background:#f7faf9;border:1px solid #e2eee9';
quickDatePicker.querySelector('label').style.cssText = 'display:grid;gap:3px;flex:1;color:#718092;font-size:9px;font-weight:800';
quickDatePicker.querySelector('input').style.cssText = 'width:100%;border:0;background:transparent;color:#243047;font:800 12px Nunito,Arial,sans-serif;outline:0';
quickDatePicker.querySelector('button').style.cssText = 'padding:8px 10px;border-radius:9px;background:#55d0aa;color:#fff;font:800 10px Nunito,Arial,sans-serif;white-space:nowrap';
document.querySelector('.calendar-header').before(quickDatePicker);
const quickDateInput = quickDatePicker.querySelector('#quick-date');
quickDateInput.onchange = () => { if (quickDateInput.value) select(quickDateInput.value); };
quickDatePicker.querySelector('#go-today').onclick = () => select(`${nowDate.getFullYear()}-${pad(nowDate.getMonth() + 1)}-${pad(nowDate.getDate())}`);
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
const scheduleDays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const scheduleSubjects = ['Toán', 'Văn', 'Anh', 'Sử', 'Địa lí', 'Sinh học', 'Hóa học', 'Vật lý', 'Tin học', 'GDKTPL', 'HĐTN-HN', 'GDTC', 'TABN', 'GDQP', 'TANC', 'Tự học', 'CLB'];
let extraStudy = readSavedData('my-calendar-extra-study-v1');
const extraStudyDialog = document.createElement('dialog');
extraStudyDialog.className = 'extra-study-dialog';
extraStudyDialog.innerHTML = `<form method="dialog" class="dialog-content" id="extra-study-form"><button class="close" type="button" aria-label="Đóng">×</button><p class="eyebrow">HỌC THÊM · T2 → CN</p><h2>Thêm lịch học</h2><label>Nội dung / lớp học<input id="extra-study-title" placeholder="Ví dụ: Học thêm Toán" required></label><label>Thứ<select id="extra-study-day">${scheduleDays.map(day => `<option>${day}</option>`).join('')}</select></label><label>Giờ bắt đầu<input id="extra-study-start-time" type="time" value="18:00" required></label><label>Giờ kết thúc<input id="extra-study-end-time" type="time" value="20:00" required></label><button class="save" type="submit">Lưu lịch học</button></form>`;
document.body.append(extraStudyDialog);
extraStudyDialog.querySelector('.close').onclick = () => extraStudyDialog.close();
extraStudyDialog.querySelector('#extra-study-form').onsubmit = event => {
  event.preventDefault();
  const title = extraStudyDialog.querySelector('#extra-study-title').value.trim(), day = extraStudyDialog.querySelector('#extra-study-day').value, startTime = extraStudyDialog.querySelector('#extra-study-start-time').value, endTime = extraStudyDialog.querySelector('#extra-study-end-time').value;
  if (!title || !day || !startTime || !endTime || endTime <= startTime) return alert('Khoảng thời gian chưa hợp lệ.');
  extraStudy.push({ title, day, startTime, endTime });
  saveData('my-calendar-extra-study-v1', extraStudy); extraStudyDialog.close(); renderSchedule();
};
const decorateConfirm = document.createElement('dialog');
decorateConfirm.className = 'decorate-confirm';
decorateConfirm.innerHTML = `<div class="dialog-content"><span class="decorate-confirm-icon">🎨</span><h2>Trang trí thời khóa biểu</h2><p>Bạn sẽ được chuyển đến mục trang trí thời khóa biểu. Bạn muốn xác nhận?</p><div><button type="button" class="cancel-decorate">Hủy</button><button type="button" class="approve-decorate">Đồng ý</button></div></div>`;
document.body.append(decorateConfirm);
decorateConfirm.querySelector('.cancel-decorate').onclick = () => decorateConfirm.close();
const decorView = document.createElement('section');
decorView.className = 'decor-view hidden';
document.querySelector('.app-shell').append(decorView);
const spotifyConnect = document.createElement('dialog');
spotifyConnect.className = 'spotify-connect';
spotifyConnect.innerHTML = `<div class="dialog-content"><span>🎧</span><p class="eyebrow">NGHE NHẠC CÙNG NHẬT KÍ</p><h2>Kết nối Spotify</h2><p>Mở ứng dụng Spotify trên thiết bị để chọn và phát trọn vẹn bài hát bạn yêu thích.</p><div><button type="button" id="cancel-spotify">Hủy</button><button type="button" id="open-spotify">Mở Spotify</button></div></div>`;
document.body.append(spotifyConnect);
spotifyConnect.querySelector('#cancel-spotify').onclick = () => spotifyConnect.close();
spotifyConnect.querySelector('#open-spotify').onclick = () => { window.location.href = 'spotify:search:'; spotifyConnect.close(); };
function renderSchedule() {
  const cell = (day, session, period) => {
    const entry = scheduleEntries.find(item => item.day === day && item.session === session && item.period === period);
    return `<div class="schedule-cell ${entry ? 'filled' : ''}" role="button" tabindex="0" data-schedule-day="${day}" data-schedule-session="${session}" data-schedule-period="${period}" title="Chạm để chọn môn học">${entry ? safe(entry.subject) : ''}</div>`;
  };
  const extraByDay = scheduleDays.map(day => ({ day, items: extraStudy.filter(item => item.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)) })).filter(group => group.items.length);
  scheduleView.innerHTML = `<div class="schedule-title"><button id="close-schedule" aria-label="Đóng thời khóa biểu">‹</button><div><p class="eyebrow">LỊCH CÁ NHÂN</p><h2>Thời khóa biểu</h2></div></div><section class="schedule-card"><div class="schedule-table"><div class="schedule-corner"></div>${scheduleDays.map((day, index) => `<div class="schedule-day day-${index + 2}">${day}</div>`).join('')}<div class="session-label">Sáng</div>${[1, 2, 3, 4].flatMap(period => scheduleDays.map(day => cell(day, 'morning', period))).join('')}<div class="session-label">Chiều</div>${[1, 2, 3, 4].flatMap(period => scheduleDays.map(day => cell(day, 'afternoon', period))).join('')}</div></section><section class="extra-study"><div><p class="eyebrow">T2 → CN</p><h3>Học thêm</h3></div><button type="button" id="add-extra-study">+ Thêm lịch học</button><div class="extra-study-list">${extraByDay.length ? extraByDay.map(group => `<section class="extra-day-box"><h4>${group.day}</h4>${group.items.map(item => `<article><span>📚</span><div><strong>${safe(item.title)}</strong><small>${safe(item.startTime)} → ${safe(item.endTime)}</small></div><button type="button" data-remove-extra="${extraStudy.indexOf(item)}">×</button></article>`).join('')}</section>`).join('') : '<p>Chưa có lịch học thêm.</p>'}</div></section>`;
  const scheduleTable = scheduleView.querySelector('.schedule-table');
  scheduleTable.style.gridTemplateColumns = '47px repeat(7, minmax(0, 1fr))';
  scheduleTable.style.gridTemplateRows = '29px repeat(8, 34px)';
  scheduleView.querySelector('#close-schedule').onclick = closeSchedule;
  scheduleView.querySelectorAll('[data-schedule-day]').forEach(cellElement => {
    const beginEdit = () => {
      if (cellElement.querySelector('input')) return;
      const day = cellElement.dataset.scheduleDay,
        session = cellElement.dataset.scheduleSession,
        period = Number(cellElement.dataset.schedulePeriod),
        old = scheduleEntries.find(item => item.day === day && item.session === session && item.period === period),
        input = document.createElement('input');
      input.type = 'text'; input.value = old?.subject || ''; input.placeholder = 'Nhập môn';
      input.setAttribute('aria-label', `Nhập môn học ${day}, ${session}, tiết ${period}`);
      input.style.cssText = 'width:100%;height:100%;padding:2px;border:0;border-radius:4px;background:#fff8eb;color:#73564a;text-align:center;font:800 8px Nunito,Arial,sans-serif;outline:2px solid #e68a52';
      cellElement.replaceChildren(input); input.focus(); input.select();
      let committed = false;
      const saveCell = () => {
        if (committed) return; committed = true;
        const subject = input.value.trim(), index = scheduleEntries.indexOf(old);
        if (subject) { if (old) old.subject = subject; else scheduleEntries.push({ day, session, period, subject }); }
        else if (index >= 0) scheduleEntries.splice(index, 1);
        saveData(STORAGE_KEYS.schedule, scheduleEntries); renderSchedule();
      };
      input.onkeydown = event => { if (event.key === 'Enter') saveCell(); if (event.key === 'Escape') { committed = true; renderSchedule(); } };
      input.onblur = saveCell;
    };
    cellElement.onclick = beginEdit;
    cellElement.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); beginEdit(); } };
  });
  scheduleView.querySelector('#add-extra-study').onclick = () => {
    extraStudyDialog.querySelector('#extra-study-title').value = '';
    extraStudyDialog.showModal();
  };
  scheduleView.querySelectorAll('[data-remove-extra]').forEach(button => button.onclick = () => { extraStudy.splice(Number(button.dataset.removeExtra), 1); saveData('my-calendar-extra-study-v1', extraStudy); renderSchedule(); });
}
function openDecorateSchedule() {
  decorateConfirm.close();
  scheduleView.classList.add('hidden');
  document.querySelector('.bottom-nav').classList.add('hidden');
  const drawCell = (day, session, period) => safe(scheduleEntries.find(item => item.day === day && item.session === session && item.period === period)?.subject || '');
  const stickerSeeds = ['flower','star','rainbow','bear','butterfly','gamer','music','book','cat','planet','robot','rocket','fox','unicorn','sun','cloud','heart','tiger','magic','artist','panda','ocean','cake','soccer'];
  decorView.innerHTML = `<header class="decor-head"><button type="button" id="close-decor">‹</button><div><p class="eyebrow">KHÔNG GIAN SÁNG TẠO</p><h2>Trang trí thời khóa biểu</h2></div></header><main class="decor-stage"><div class="decor-paper" id="decor-paper"><div class="decor-table"><div></div>${scheduleDays.map(day => `<b>${day.replace('Thứ ', 'T')}</b>`).join('')}<strong>Sáng</strong>${[1,2,3,4].flatMap(period => scheduleDays.map(day => `<span>${drawCell(day,'morning',period)}</span>`)).join('')}<strong>Chiều</strong>${[1,2,3,4].flatMap(period => scheduleDays.map(day => `<span>${drawCell(day,'afternoon',period)}</span>`)).join('')}</div><canvas id="decor-canvas"></canvas><div class="sticker-layer" id="sticker-layer"></div></div></main><div class="pen-drawer hidden" id="pen-drawer"><button type="button" data-pen="pen">✏️ Bút màu</button><button type="button" data-pen="glitter">✨ Bút kim tuyến</button><label><input id="brush-color" type="color" value="#ef7091"><span>Màu</span></label><label><span>Kích cỡ</span><input id="brush-size" type="range" min="1" max="22" value="3"></label><label><span>Độ đậm</span><input id="brush-alpha" type="range" min="10" max="100" value="100"></label></div><div class="sticker-drawer hidden" id="sticker-drawer">${stickerSeeds.map(seed => `<button type="button" data-sticker="${seed}"><img src="https://api.dicebear.com/10.x/notionists/svg?seed=${seed}&backgroundColor=fff1e7" alt="Sticker ${seed}"></button>`).join('')}</div><nav class="decor-tools"><button type="button" id="pen-tool">✏️<small>Bút</small></button><button type="button" data-tool="eraser">⌫<small>Tẩy</small></button><button type="button" id="undo-decor">↶<small>Hoàn tác</small></button><button type="button" id="clear-decor">🗑️<small>Xóa</small></button><button type="button" id="sticker-tool">😀<small>Sticker</small></button></nav>`;
  const paper = decorView.querySelector('#decor-paper'), canvas = decorView.querySelector('#decor-canvas'), ctx = canvas.getContext('2d');
  let scale = 1, rotation = 0, drawing = false, tool = 'pen', color = '#ef7091', brushSize = 3, alpha = 1, history = [];
  const resizeCanvas = () => { const rect = paper.getBoundingClientRect(); canvas.width = rect.width * devicePixelRatio; canvas.height = rect.height * devicePixelRatio; canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`; ctx.scale(devicePixelRatio, devicePixelRatio); };
  resizeCanvas();
  const applyTransform = () => { paper.style.transform = `scale(${scale}) rotate(${rotation}deg)`; };
  const point = event => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale }; };
  const fingers = new Map(); let pinch = null;
  const distance = ([a,b]) => Math.hypot(a.x-b.x,a.y-b.y), angle = ([a,b]) => Math.atan2(b.y-a.y,b.x-a.x) * 180 / Math.PI;
  canvas.onpointerdown = event => { canvas.setPointerCapture(event.pointerId); fingers.set(event.pointerId, {x:event.clientX,y:event.clientY}); if (fingers.size === 2) { const pair=[...fingers.values()]; pinch={distance:distance(pair),angle:angle(pair),scale,rotation}; drawing=false; return; } drawing=true; const p=point(event); history.push(ctx.getImageData(0,0,canvas.width,canvas.height)); ctx.beginPath(); ctx.moveTo(p.x,p.y); };
  canvas.onpointermove = event => { if (!fingers.has(event.pointerId)) return; fingers.set(event.pointerId,{x:event.clientX,y:event.clientY}); if (fingers.size === 2 && pinch) { const pair=[...fingers.values()]; scale=Math.max(.65,Math.min(1.7,pinch.scale*distance(pair)/pinch.distance)); rotation=pinch.rotation+(angle(pair)-pinch.angle); applyTransform(); return; } if (!drawing) return; const p=point(event); ctx.lineTo(p.x,p.y); ctx.lineWidth=tool==='eraser'?Math.max(14,brushSize*3):brushSize; ctx.lineCap='round'; ctx.strokeStyle=tool==='eraser'?'#fffaf0':color; ctx.globalAlpha=alpha; ctx.stroke(); if (tool==='glitter') { for(let i=0;i<4;i++){ctx.fillStyle='#fff';ctx.globalAlpha=.9;ctx.fillRect(p.x+(Math.random()-.5)*brushSize*5,p.y+(Math.random()-.5)*brushSize*5,2,2);} } ctx.globalAlpha=1; };
  const stopPointer = event => { fingers.delete(event.pointerId); if (fingers.size < 2) pinch=null; drawing=false; }; canvas.onpointerup=stopPointer; canvas.onpointercancel=stopPointer;
  decorView.querySelectorAll('[data-tool]').forEach(button => button.onclick = () => tool = button.dataset.tool);
  const penDrawer = decorView.querySelector('#pen-drawer');
  decorView.querySelector('#pen-tool').onclick = () => penDrawer.classList.toggle('hidden');
  penDrawer.querySelectorAll('[data-pen]').forEach(button => button.onclick = () => { tool = button.dataset.pen; penDrawer.classList.add('hidden'); });
  penDrawer.querySelector('#brush-color').oninput = event => color = event.target.value;
  penDrawer.querySelector('#brush-size').oninput = event => brushSize = Number(event.target.value);
  penDrawer.querySelector('#brush-alpha').oninput = event => alpha = Number(event.target.value) / 100;
  decorView.querySelector('#undo-decor').onclick = () => { const previous = history.pop(); if (previous) ctx.putImageData(previous,0,0); };
  decorView.querySelector('#clear-decor').onclick = () => ctx.clearRect(0,0,canvas.width,canvas.height);
  const drawer = decorView.querySelector('#sticker-drawer');
  decorView.querySelector('#sticker-tool').onclick = () => drawer.classList.toggle('hidden');
  drawer.querySelectorAll('[data-sticker]').forEach(button => button.onclick = () => { const sticker = document.createElement('img'); sticker.src = `https://api.dicebear.com/10.x/notionists/svg?seed=${button.dataset.sticker}&backgroundColor=fff1e7`; sticker.alt = 'Sticker'; sticker.style.cssText = `position:absolute;left:${35 + Math.random()*30}%;top:${35 + Math.random()*25}%;width:38px;height:38px;z-index:5`; paper.querySelector('#sticker-layer').append(sticker); drawer.classList.add('hidden'); });
  decorView.querySelector('#close-decor').onclick = () => { decorView.classList.add('hidden'); document.querySelector('.bottom-nav').classList.remove('hidden'); scheduleView.classList.remove('hidden'); renderSchedule(); };
  decorView.classList.remove('hidden');
}
decorateConfirm.querySelector('.approve-decorate').onclick = openDecorateSchedule;
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
const diaryNav = document.createElement('button');
diaryNav.className = 'nav-item';
diaryNav.innerHTML = '<span>✎</span>Nhật kí';
document.querySelector('.bottom-nav').insertBefore(diaryNav, document.querySelector('.bottom-nav .nav-item:last-child'));
const navButtons = [...document.querySelectorAll('.bottom-nav .nav-item')];
const diarySignatures = ['Nơi mỗi dòng chữ làm dịu một góc tâm hồn.', 'Lắng nghe chính mình, từng ngày một.', 'Ghi lại hôm nay để trân trọng ngày mai.', 'Nơi những suy nghĩ tìm thấy câu trả lời.', 'Viết cho bản thân của hiện tại và tương lai.', 'Giữ lại những khoảnh khắc thời gian không thể xóa nhòa.', 'Thước phim cuộc đời qua từng trang viết.', 'Nơi kỷ niệm trở thành tài sản vô giá.', 'Mỗi ngày một dòng, một đời một cuốn sách.', 'Gói gọn ngày hôm nay vào một góc nhớ.', 'Chuyện hôm nay, giữ lại đây.', 'Không gian của riêng bạn.', 'Nghĩ gì, viết nấy.', 'Ghi chép nhỏ, giá trị lớn.', 'Tháo gỡ những suy nghĩ bộn bề.', 'Write today. Remember tomorrow.', 'Your thoughts, your space.', 'Capturing moments, creating memories.', 'A safe place for your mind.', 'Dear Diary, today was...'];
const diaryPrompts = ['Hôm nay của bạn thế nào? Chia sẻ với tôi nhé...', 'Hãy để những suy nghĩ của bạn tự do trút xuống đây...', 'Không gian này là của riêng bạn, hãy cứ là chính mình...', 'Viết ra những điều hôm nay bạn chưa thể nói thành lời...', 'Trút bỏ mọi bộn bề, trang giấy này luôn sẵn sàng lắng nghe bạn...', 'Điều tuyệt vời nhất xảy ra với bạn hôm nay là gì?', 'Ghi lại một khoảnh khắc bạn muốn lưu giữ mãi mãi...', 'Hôm nay bạn cảm thấy biết ơn điều gì nhất?', 'Nhật ký ơi, hôm nay là một ngày...', 'Lưu lại một mảnh ghép ý nghĩa của ngày hôm nay...', "What's on your mind today?...", 'Pour your heart out...', 'Collect moments, write them down...', 'Dear future self, today I...'];
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
function journalEmoji(title, content) {
  const t = `${title} ${content}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const feeling = [[/vui|hanh phuc|tuyet voi|yeu|cuoi/, '😊'], [/buon|khoc|co don|met moi/, '😔'], [/tuc gian|gian|that vong/, '😤'], [/lo lang|so hai|cang thang/, '😟'], [/cam on|biet on/, '🙏'], [/nho|ky niem/, '💭'], [/hy vong|uoc mo/, '🌟']].find(([rule]) => rule.test(t));
  return feeling ? feeling[1] : emoji(title, content);
}

const areaOf = event => event.area || 'calendar';
const endDateOf = event => event.endDate || event.date;
const endTimeOf = event => event.endTime || event.time;
const happensOn = (event, date) => event.date <= date && endDateOf(event) >= date;
const forDate = date => events.filter(event => happensOn(event, date) && areaOf(event) === activeArea).sort((a, b) => a.time.localeCompare(b.time));
const allForDate = date => events.filter(event => happensOn(event, date)).sort((a, b) => a.time.localeCompare(b.time));
function timeRange(event) {
  const start = `${event.time} · ${pad(Number(event.date.slice(8)))}/${pad(Number(event.date.slice(5, 7)))}/${event.date.slice(0, 4)}`;
  const end = `${endTimeOf(event)} · ${pad(Number(endDateOf(event).slice(8)))}/${pad(Number(endDateOf(event).slice(5, 7)))}/${endDateOf(event).slice(0, 4)}`;
  return `${start} → ${end}`;
}
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
            )}</h3><p>${timeRange(e)}<br>${safe(e.description || 'Không có mô tả.')}</p></div><span class="event-icon">${e.icon}</span><button class="delete-event" type="button" data-delete-index="${events.indexOf(e)}" aria-label="Xóa ${safe(e.title)}">×</button></article>`
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
  todayLabel.textContent = `${weekdays[nowDate.getDay()]}, ngày ${pad(nowDate.getDate())}/${pad(nowDate.getMonth() + 1)}/${nowDate.getFullYear()}`;
  quickDateInput.value = `${state.year}-${pad(state.month + 1)}-${pad(state.day)}`;
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
    const isToday = inMonth && state.year === nowDate.getFullYear() && state.month === nowDate.getMonth() && day === nowDate.getDate();
    button.className = `date ${inMonth ? '' : 'muted'} ${inMonth && day === state.day ? 'selected' : ''} ${isToday ? 'today' : ''} ${inMonth && conflictsForDate(key) ? 'time-conflict' : ''}`;
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
      .map(hour => {
        const matches = items.filter(event => Number(event.time.slice(0, 2)) === hour);
        return `<div class="timeline-row"><time>${pad(hour)}:00</time><div class="timeline-slot">${matches
          .map(
            event =>
              `<article class="timeline-event ${event.color}"><span>${event.time} → ${endTimeOf(event)}</span><strong>${event.icon} ${safe(
                event.title
              )}</strong><small>${safe(event.description || 'Không có mô tả.')}</small></article>`
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
  return new Date(`${endDateOf(event)}T${endTimeOf(event)}`) < new Date() ? 'overdue' : 'pending';
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
  navButtons.forEach((button, index) => button.classList.toggle('selected', index === { tasks: 1, stats: 2, all: 3, diary: 4, profile: 5 }[kind]));
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
  if (kind === 'diary') {
    const saved = readSavedData('my-calendar-diary-v1');
    const showList = () => {
      utilityView.innerHTML = `<section class="diary-page"><div class="utility-heading"><p class="eyebrow">KHÔNG GIAN RIÊNG</p><h2>Nhật kí</h2></div><button class="diary-add" id="diary-add">＋ Thêm nhật kí</button><div class="diary-saved">${saved.length ? saved.slice().reverse().map((item, index) => `<button class="diary-entry" data-diary-entry="${saved.length - 1 - index}"><small>${new Date(item.date).toLocaleDateString('vi-VN')}</small><strong>${safe(item.title)}</strong></button>`).join('') : '<p class="empty">Chưa có trang nhật kí nào. Hãy viết một điều cho riêng bạn.</p>'}</div></section>`;
      utilityView.querySelector('#diary-add').onclick = showEditor;
      utilityView.querySelectorAll('[data-diary-entry]').forEach(button => button.onclick = () => showEntry(saved[Number(button.dataset.diaryEntry)]));
    };
    const showEntry = item => {
      utilityView.innerHTML = `<section class="diary-page diary-editor-drop"><button class="diary-back" id="diary-back">‹ Quay về</button><div class="utility-heading"><p class="eyebrow">${new Date(item.date).toLocaleDateString('vi-VN')}</p><h2>${item.icon} ${safe(item.title)}</h2></div><article class="diary-reading">${safe(item.content).replace(/\n/g, '<br>')}</article></section>`;
      utilityView.querySelector('#diary-back').onclick = showList;
    };
    const showEditor = () => {
      const signature = diarySignatures[Math.floor(Math.random() * diarySignatures.length)], prompt = diaryPrompts[Math.floor(Math.random() * diaryPrompts.length)];
      const musicMoods = ['Mượn nhạc khơi dòng cảm xúc.', 'Giai điệu bật lối cảm xúc.', 'Để âm nhạc dẫn lối trang viết.', 'Nhạc thăng hoa, chữ đong đầy.', 'Bật nhạc, mở lòng, viết nên câu chuyện.', 'Nhạc lên, chữ tuôn.', 'Nhạc khơi nguồn, bút dẫn lối.'];
      const musicMood = musicMoods[Math.floor(Math.random() * musicMoods.length)];
      utilityView.innerHTML = `<section class="diary-page diary-editor-drop"><button class="diary-back" id="diary-back">‹ Quay về</button><div class="utility-heading"><p class="eyebrow">KHÔNG GIAN RIÊNG</p><h2>Nhật kí</h2></div><p class="diary-signature">“${signature}”</p><form id="diary-form"><label>Tiêu đề <div class="diary-title-line"><input id="diary-title" placeholder="Đặt tiêu đề cho hôm nay..." required><span id="diary-emoji">✨</span></div></label><label>Nội dung <div class="diary-content-head"><span>Viết cho riêng bạn</span><div class="diary-disc-wrap"><em class="music-mood">${musicMood}</em><button type="button" id="diary-music" title="Kết nối Spotify">💿</button><i class="music-notes" id="music-notes">♪ ♫ ♬</i></div></div><textarea id="diary-content" placeholder="${prompt}" required></textarea></label><button class="save" type="submit">Lưu trang nhật kí</button></form></section>`;
      const titleInput = utilityView.querySelector('#diary-title'), emojiSpot = utilityView.querySelector('#diary-emoji');
      titleInput.oninput = () => emojiSpot.textContent = journalEmoji(titleInput.value, '');
      utilityView.querySelector('#diary-back').onclick = showList;
      utilityView.querySelector('#diary-music').onclick = () => spotifyConnect.showModal();
      utilityView.querySelector('#diary-form').onsubmit = event => { event.preventDefault(); const title = titleInput.value.trim(), content = utilityView.querySelector('#diary-content').value.trim(); if (!title || !content) return; saved.push({ title, content, icon: journalEmoji(title, content), date: new Date().toISOString() }); saveData('my-calendar-diary-v1', saved); showList(); };
    };
    showList();
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
  startDateInput.value = dateKey();
  endDateInput.value = dateKey();
  startTimeInput.value = '09:00';
  endTimeInput.value = '10:00';
  dialog.showModal();
};
document.querySelector('#close-dialog').onclick = () => dialog.close();
document.querySelector('#event-form').onsubmit = e => {
  e.preventDefault();
  const title = document.querySelector('#event-name').value.trim(),
    date = startDateInput.value,
    time = startTimeInput.value,
    endDate = endDateInput.value,
    endTime = endTimeInput.value,
    description = document.querySelector('#event-description').value.trim();
  if (!title || !date || !time || !endDate || !endTime) return;
  if (new Date(`${endDate}T${endTime}`) < new Date(`${date}T${time}`)) {
    alert('Thời điểm kết thúc phải sau thời điểm bắt đầu.');
    return;
  }
  const conflictingEvent = events.find(event => event.date === date && event.time === time && areaOf(event) !== activeArea);
  events.push({ title, date, time, endDate, endTime, description, area: activeArea, icon: emoji(title, description), color: colors[events.length % colors.length] });
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
navButtons[4].onclick = () => { const direction = bottomDirection(4); renderUtility('diary'); animateScreen(direction); };
navButtons[5].onclick = () => { const direction = bottomDirection(5); renderUtility('profile'); animateScreen(direction); };

renderAll();
