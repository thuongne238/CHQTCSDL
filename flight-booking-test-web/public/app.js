import { createConfirmDialog } from '/components/confirm-dialog.js';

const confirmDialog = createConfirmDialog();
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
const date = value => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
const time = value => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
const cities = { SGN: 'TP. Hồ Chí Minh', HAN: 'Hà Nội', DAD: 'Đà Nẵng', PQC: 'Phú Quốc', CXR: 'Nha Trang', HPH: 'Hải Phòng', VCA: 'Cần Thơ', HUI: 'Huế' };
const city = (code, fallback) => cities[code] || fallback || code;

const paths = {
  plane: 'M22 2 9 15M22 2l-8 20-5-7-7-5 20-8Z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  ticket: 'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Zm13 0v3m0 3v2m0 3v3',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  bolt: 'm13 2-8 12h6l-1 8 9-13h-7l1-7Z',
  flask: 'M9 3h6m-5 0v6l-6 10a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M7 15h10',
  refresh: 'M20 11a8 8 0 0 0-14-5L3 9m0-6v6h6M4 13a8 8 0 0 0 14 5l3-3m0 6v-6h-6',
  logout: 'M9 4H4v16h5m5-12 4 4-4 4m-6-4h12',
  shield: 'm12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Zm-4 10 3 3 5-6',
  check: 'm5 12 4 4L19 6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  seat: 'M7 3v9h10V3M5 12v7h14v-7M7 19v3m10-3v3',
  database: 'M20 5c0 2-16 2-16 0s16-2 16 0Zm0 0v14c0 3-16 3-16 0V5m0 7c0 3 16 3 16 0',
  users: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m21 0v-2a4 4 0 0 0-3-4M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm5-4a4 4 0 0 1 0 8',
  alert: 'M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zm6-3v15m6-12v15',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-2.5a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.02 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.5Z',
  lotus: 'M12 3c2.5 3.2 4 6.2 4 9a4 4 0 0 1-8 0c0-2.8 1.5-5.8 4-9Zm0 13c3.5 0 7-2.2 8-6-2.5.4-5 2-8 6Zm0 0c-3.5 0-7-2.2-8-6 2.5.4 5 2 8 6Zm-6 3h12',
  swap: 'M7 16V4m0 0L3 8m4-4 4 4m6 0v12m0 0 4-4m-4 4-4-4',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-9.9 10h19.8M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z',
  close: 'M18 6 6 18M6 6l12 12',
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.plane}"/></svg>`;

const state = {
  user: null,
  portal: 'customer', // 'customer' or 'admin'
  view: 'flights',
  airports: [], flights: [], sales: [], holds: [], tickets: [], passengers: [],
  overview: {}, seats: [], scheduleId: null, seatId: null, saleId: null, mode: 'PESSIMISTIC',
  origin: '', destination: '', register: false,
  lab: null, labReport: null, activity: [], planName: null,
  verifiedTicket: null,
  lastViolation: null,
  adminFlightsData: null,
  adminAirports: [],
  adminUsers: [],
  userFilter: 'ALL',
  selectedUserHistory: null,
  adminViolations: [],
  loading: false
};

const views = {
  flights: ['Đặt vé máy bay', 'Tìm chuyến & đặt vé'],
  holds: ['Giữ chỗ của tôi', 'Giữ chỗ đang hoạt động'],
  tickets: ['Vé điện tử', 'Vé bạn đã đặt'],
  sales: ['Săn vé Flash Sale', 'Flash sale đang mở'],
  passengers: ['Hồ sơ hành khách', 'Quản lý hành khách'],
  'admin-flights': ['Quản trị chuyến bay', 'Quản trị tuyến bay & lịch khởi hành'],
  'admin-airports': ['Quản trị sân bay', 'Danh mục sân bay khai thác'],
  'admin-fares': ['Quản lý loại vé', 'Bảng giá từng loại vé theo chuyến bay'],
  'admin-users': ['Quản lý người dùng', 'Thông tin tài khoản & lịch sử mua vé'],
  'admin-violations': ['Cảnh báo lỗi nghiệp vụ', 'Giám sát trường hợp người dùng thao tác sai'],
  lab: ['Kiểm thử nghiệp vụ', 'Phòng kiểm thử']
};

const adminViews = ['admin-flights', 'admin-airports', 'admin-fares', 'admin-users', 'admin-violations', 'lab'];
const customerViews = ['flights', 'holds', 'tickets', 'sales', 'passengers'];

const names = {
  ATOMIC_CHECKOUT: 'Giữ ghế, thanh toán & xuất vé',
  OPTIMISTIC_CAS: 'Phiên bản ghế và optimistic locking',
  OWNER_AND_AMOUNT: 'Chủ sở hữu và số tiền thanh toán',
  EXPIRED_HOLD: 'Giữ chỗ hết hạn và giải phóng ghế',
  FINAL_QUOTA_AND_FREE_TICKET: 'Suất flash sale cuối & giá vé 0 đồng',
  SALE_TIME_WINDOW: 'Flash sale chưa mở / đã kết thúc',
  DEPARTED_FLIGHT: 'Từ chối chuyến bay đã khởi hành',
  CAPACITY_AND_FK: 'Sức chứa và liên kết lịch bay',
  UNIQUE_TICKET_AND_REOPEN: 'Chặn vé trùng & mở lại ghế đã bán',
  INVALID_USER_ROLLBACK: 'Rollback khi người dùng không tồn tại',
  SKIP_LOCKED_AUTO_ALLOCATE: 'Tự cấp một ghế trống',
  SALE_SCHEDULE_AND_NEGATIVE_VALUES: 'Sai lịch sale và hạn ngạch âm'
};

const integrityNames = {
  DUPLICATE_TICKET_SEAT: 'Vé trùng trên một ghế',
  DUPLICATE_ACTIVE_HOLD: 'Nhiều giữ chỗ cho cùng ghế',
  RESERVATION_SEAT_MISMATCH: 'Giữ chỗ sai trạng thái / lịch bay',
  TICKET_SEAT_NOT_BOOKED: 'Vé có ghế chưa đánh dấu đã bán',
  CAPACITY_EXCEEDED: 'Vượt sức chứa máy bay',
  SALE_TICKET_COUNT_MISMATCH: 'Hạn ngạch lệch với số vé sale',
  PAYMENT_AMOUNT_MISMATCH: 'Thanh toán lệch với đơn đặt',
  BOOKED_SEAT_WITHOUT_TICKET: 'Ghế đã bán nhưng không có vé'
};

function toast(message, error = false, sqlstate, scenario) {
  const element = document.createElement('div');
  element.className = 'toast' + (error ? ' error' : '');
  element.textContent = message;
  if (sqlstate) {
    const code = document.createElement('code');
    code.textContent = 'SQLSTATE ' + sqlstate + (scenario ? ' · ' + scenario : '');
    element.append(code);
  }
  $('#notifications').append(element);
  while ($('#notifications').children.length > 3) $('#notifications').firstElementChild.remove();
  element.addEventListener('click', () => element.remove());
  setTimeout(() => element.remove(), 5500);
}

async function api(url, { body, method = body ? 'POST' : 'GET' } = {}) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000)
  });
  const json = await response.json();
  if (!response.ok || !json.success) {
    const error = new Error(json.error || 'Không thể hoàn tất yêu cầu.');
    error.status = response.status;
    error.sqlstate = json.sqlstate;
    error.scenario = json.scenario;
    throw error;
  }
  return json.data ?? json;
}

async function action(button, fn) {
  const isBtn = button && button.tagName === 'BUTTON';
  const before = isBtn ? button.innerHTML : null;
  if (isBtn) { button.disabled = true; button.innerHTML = '<span class="spinner"></span> Đang xử lý'; }
  try { await fn(); }
  catch (error) {
    if (error.status && error.status !== 401) {
      state.lastViolation = {
        time: new Date().toISOString(),
        message: error.message || 'Thao tác không hợp lệ.',
        sqlstate: error.sqlstate || 'APP_RULE',
        scenario: error.scenario || 'Vi phạm quy tắc nghiệp vụ đặt vé'
      };
      if (state.user?.role === 'ADMIN') {
        api('/api/admin/violations').then(v => { state.adminViolations = v; renderShell(); }).catch(() => { });
      } else {
        renderShell();
      }
    }
    toast(error.message || 'Mất kết nối máy chủ.', true, error.sqlstate, error.scenario);
    if (error.status === 401) { state.user = null; renderAuth(); }
  }
  finally { if (isBtn && button.isConnected) { button.disabled = false; button.innerHTML = before; } }
}

function brand(isAdminPortal = false) {
  return `<div class="brand">
    <span class="brand-symbol">${icon(isAdminPortal ? 'settings' : 'plane')}</span>
    <div class="brand-text">
      <strong>Nhom14<span class="lab">AIRLINE</span></strong>
      <small class="brand-sub">${isAdminPortal ? 'HỆ QUẢN TRỊ HÃNG BAY' : 'HÃNG HÀNG KHÔNG VIỆT NAM'}</small>
    </div>
  </div>`;
}

function renderAuth() {
  const register = state.register;
  $('#app').innerHTML = `<div class="auth-page">
    <section class="auth-story">
      ${brand(false)}
      <div class="auth-copy">
        <span class="eyebrow">HỆ THỐNG ĐẶT VÉ TRỰC TUYẾN QUỐC GIA · ĐỀ TÀI 23</span>
        <h1>Sải cánh vươn cao.<br>Đặt vé an toàn<br><em>chuẩn giao dịch.</em></h1>
        <p>Hệ thống tách biệt rõ Giao diện Hành khách (tìm chuyến, giữ ghế 10 phút, săn Flash Sale, xuất vé ETKT) và Trung tâm Quản trị Hãng bay (quản trị sân bay, chuyến bay, giá từng loại vé, lịch sử mua vé khách hàng & cảnh báo vi phạm).</p>
        <div class="story-routes">
          <span class="route-chip">SGN ⇄ HAN</span>
          <span class="route-chip">SGN ⇄ DAD</span>
          <span class="route-chip">SGN ⇄ PQC</span>
        </div>
        <div class="story-features">
          <div class="story-feature"><span>${icon('seat')}</span> Giao diện Người dùng: Đặt vé, giữ chỗ 10 phút & cảnh báo lỗi trực quan</div>
          <div class="story-feature"><span>${icon('grid')}</span> Giao diện Admin riêng: Chuyến bay, Sân bay, Giá loại vé & Lịch sử khách hàng</div>
          <div class="story-feature"><span>${icon('alert')}</span> Giám sát & bắt trọn 12 kịch bản người dùng thao tác sai trong CSDL</div>
        </div>
      </div>
      <div class="auth-footer">NHOM14AIRLINE · CỔNG ĐẶT VÉ & HỆ QUẢN TRỊ</div>
    </section>
    <section class="auth-main">
      <div class="auth-card">
        <div class="auth-status"><i class="dot"></i> Hệ thống đặt vé & quản trị trực tuyến sẵn sàng</div>
        <div class="eyebrow">NHOM14AIRLINE PORTAL · VIETNAM</div>
        <h2>${register ? 'Tạo tài khoản hội viên' : 'Đăng nhập để bắt đầu'}</h2>
        <p>${register ? 'Đăng ký tài khoản khách hàng để sử dụng Cổng đặt vé hành khách.' : 'Chọn nhanh tài khoản mẫu bên dưới hoặc đăng nhập bằng tài khoản của bạn.'}</p>
        <div id="auth-error" class="error-box hidden" role="alert"></div>
        <form id="auth-form" class="auth-form">
          <label class="field">Tên đăng nhập<input name="username" autocomplete="username" placeholder="Nhập tên đăng nhập" required minlength="3" maxlength="50"></label>
          ${register ? '<label class="field">Email liên hệ<input name="email" type="email" autocomplete="email" placeholder="ban@lotusair.vn" maxlength="100"></label>' : ''}
          <label class="field">Mật khẩu<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="Nhập mật khẩu" required minlength="6" maxlength="72"></label>
          <button class="btn primary wide" type="submit">${register ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
        </form>
        ${!register ? `<div class="demo-caption">ĐĂNG NHẬP NHANH TÀI KHOẢN DEMO</div>
        <div class="demo-grid">
          <button class="demo admin" data-action="demo" data-user="admin"><strong>Quản trị viên ↗</strong><span>admin / admin123</span></button>
          <button class="demo" data-action="demo" data-user="nguyenvanan"><strong>Hành khách ↗</strong><span>nguyenvanan / user123</span></button>
        </div>`: ''}
        <div class="auth-switch">${register ? 'Đã có tài khoản hội viên?' : 'Chưa có tài khoản hội viên?'} <button class="text-btn" data-action="toggle-auth">${register ? 'Đăng nhập' : 'Đăng ký'}</button></div>
        <div class="auth-note">${icon('shield')}<span>Khách hàng vào thẳng Cổng Đặt vé. Quản trị viên có thêm Cổng Quản trị Hãng bay tách riêng.</span></div>
      </div>
    </section>
  </div>`;
}

function renderViolationAlertBanner() {
  if (!state.lastViolation) return '';
  const v = state.lastViolation;
  return `<div class="violation-alert" role="alert">
    <div class="violation-alert-icon">${icon('alert')}</div>
    <div class="violation-alert-body">
      <div class="violation-alert-head">
        <strong>CẢNH BÁO THAO TÁC SAI QUY TẮC NGHIỆP VỤ (${esc(v.sqlstate)})</strong>
        <span class="badge red">${esc(v.scenario)}</span>
      </div>
      <p>${esc(v.message)} — <em>Hệ thống CSDL đã tự động chặn thao tác và rollback giao dịch để bảo vệ toàn vẹn dữ liệu (đã ghi nhận vào Nhật ký Cảnh báo Admin).</em></p>
    </div>
    <button class="btn ghost sm" type="button" data-action="dismiss-violation">Đã hiểu ✕</button>
  </div>`;
}

function navigation() {
  // SIDEBAR DÀNH RIÊNG CHO GIAO DIỆN QUẢN TRỊ VIÊN (ADMIN)
  return `<nav>
    <div class="nav-label">QUẢN TRỊ KHAI THÁC</div>
    <button class="nav-btn ${state.view === 'admin-flights' ? 'active' : ''}" data-action="nav" data-view="admin-flights">
      ${icon('plane')}<span class="nav-text">Quản trị chuyến bay</span>
      <span class="nav-count subtle">${state.adminFlightsData?.flights?.length ?? 4}</span>
    </button>
    <button class="nav-btn ${state.view === 'admin-airports' ? 'active' : ''}" data-action="nav" data-view="admin-airports">
      ${icon('map')}<span class="nav-text">Quản trị sân bay</span>
      <span class="nav-count subtle">${state.adminAirports?.length || state.airports.length}</span>
    </button>
    <button class="nav-btn ${state.view === 'admin-fares' ? 'active' : ''}" data-action="nav" data-view="admin-fares">
      ${icon('tag')}<span class="nav-text">Quản lý loại vé</span>
    </button>
    <button class="nav-btn ${state.view === 'admin-users' ? 'active' : ''}" data-action="nav" data-view="admin-users">
      ${icon('users')}<span class="nav-text">Quản lý người dùng</span>
      <span class="nav-count subtle">${state.adminUsers?.length || 3}</span>
    </button>
    <div class="nav-label">GIÁM SÁT LỖI & KIỂM THỬ</div>
    <button class="nav-btn ${state.view === 'admin-violations' ? 'active' : ''}" data-action="nav" data-view="admin-violations">
      ${icon('alert')}<span class="nav-text">Cảnh báo lỗi nghiệp vụ</span>
      ${state.adminViolations.length ? `<span class="nav-count alert-badge">${state.adminViolations.length}</span>` : ''}
    </button>
    <button class="nav-btn ${state.view === 'lab' ? 'active' : ''}" data-action="nav" data-view="lab">
      ${icon('flask')}<span class="nav-text">Kiểm thử nghiệp vụ</span>
    </button>
  </nav>`;
}

function stats() {
  const o = state.overview;
  return `<div class="stats">
    ${[
      ['Chuyến bay đang mở bán', o.schedules, 'Khởi hành nội địa Việt Nam', 'plane'],
      ['Ghế trống sẵn sàng', o.available_seats, 'Cập nhật tức thời từ CSDL', 'seat'],
      ['Giữ chỗ đang chờ', o.my_holds, 'Giữ chỗ bảo lưu 10 phút', 'clock'],
      ['Vé điện tử đã xuất', o.my_bookings, 'Đã thanh toán & xác nhận', 'ticket']
    ].map(([label, value, foot, image]) => `
      <div class="stat">
        <div>
          <span class="label">${label}</span>
          <strong>${esc(value ?? '—')}</strong>
          <span class="foot">${foot}</span>
        </div>
        <div class="stat-icon">${icon(image)}</div>
      </div>`).join('')}
  </div>`;
}

function pageHead() {
  const titles = {
    flights: ['CỔNG HÀNH KHÁCH · ĐẶT VÉ TRỰC TUYẾN', 'Tìm chuyến & đặt vé', 'Tìm kiếm lịch bay, chọn chỗ ngồi trên sơ đồ tàu bay và xuất vé điện tử tức thời.'],
    holds: ['BẢO LƯU CHỖ NGỒI 10 PHÚT', 'Giữ chỗ của bạn', 'Hoàn tất thanh toán trước khi hết thời gian giữ ghế hoặc thử nghiệm cơ chế tự động giải phóng ghế.'],
    tickets: ['THẺ LÊN TÀU BAY & VÉ ĐIỆN TỬ', 'Vé bạn đã đặt', 'Tra cứu mã vé điện tử ETKT, trạng thái thanh toán và lịch sử xác nhận giao dịch.'],
    sales: ['CHƯƠNG TRÌNH ƯU ĐÃI ĐẶC BIỆT', 'Flash sale đang mở', 'Săn vé giá ưu đãi có kiểm soát hạn ngạch (quota) chống bán vượt trong giao dịch đồng thời.'],
    passengers: ['THÔNG TIN HÀNH KHÁCH THƯỜNG XUYÊN', 'Quản lý hành khách', 'Lưu trữ thông tin Họ tên & Hộ chiếu/CCCD để sử dụng nhanh khi đặt vé.'],
    'admin-flights': ['HỆ QUẢN TRỊ HÃNG BAY · QUẢN TRỊ CHUYẾN BAY', 'Quản trị chuyến bay & lịch khởi hành', 'Xem mã số chuyến bay, chặng bay từ sân bay nào tới sân bay nào và tạo chuyến bay mới dựa trên các sân bay đã đăng ký.'],
    'admin-airports': ['HỆ QUẢN TRỊ HÃNG BAY · QUẢN TRỊ SÂN BAY', 'Quản trị danh mục sân bay', 'Chỉ những sân bay có trong danh mục quản trị này mới được phép dùng để tạo tuyến bay và chuyến bay mới.'],
    'admin-fares': ['HỆ QUẢN TRỊ HÃNG BAY · QUẢN LÝ LOẠI VÉ', 'Quản lý loại vé & giá vé từng chuyến bay', 'Thiết lập giá riêng cho từng loại vé (Hạng Thương gia, Hạng Phổ thông, Vé Flash Sale) trên từng chuyến bay cụ thể.'],
    'admin-users': ['HỆ QUẢN TRỊ HÃNG BAY · QUẢN LÝ NGƯỜI DÙNG', 'Quản lý người dùng & lịch sử mua vé', 'Xem danh sách tài khoản; bấm vào bất kỳ khách hàng nào để kiểm tra khách hàng đó đã từng mua vé lần nào hay chưa.'],
    'admin-violations': ['HỆ QUẢN TRỊ HÃNG BAY · GIÁM SÁT VI PHẠM', 'Cảnh báo trường hợp người dùng làm sai', 'Theo dõi thời gian thực các thao tác sai quy tắc nghiệp vụ của người dùng (tương ứng 12 kịch bản kiểm thử nghiệp vụ).'],
    lab: ['KIỂM ĐỊNH GIAO DỊCH & ĐỒNG THỜI', 'Phòng kiểm thử', 'Thực thi 12 kịch bản kiểm thử độc lập, đối soát 8 chỉ số toàn vẹn và phân tích Execution Plan.']
  };
  const [eyebrow, title, subtitle] = titles[state.view] || titles.flights;
  return `<header class="page-head">
    <div>
      <div class="eyebrow">${eyebrow}</div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
    <div class="head-actions">
      <button class="btn secondary" data-action="refresh">${icon('refresh')} Tải lại</button>
    </div>
  </header>`;
}

function destinationArtwork(code, flightNumber) {
  const themes = {
    HAN: { sky1: '#7DD3FC', sky2: '#E0F2FE', sun: '#FDE047', accent: '#0284C7', land1: '#15803D', land2: '#166534', label: 'Hà Nội · Thủ đô ngàn năm' },
    DAD: { sky1: '#38BDF8', sky2: '#CFFAFE', sun: '#FACC15', accent: '#0EA5E9', land1: '#0D9488', land2: '#0F766E', label: 'Đà Nẵng · Biển xanh miền Trung' },
    PQC: { sky1: '#22D3EE', sky2: '#ECFEFF', sun: '#FDE047', accent: '#0891B2', land1: '#059669', land2: '#047857', label: 'Phú Quốc · Đảo ngọc thiên đường' },
    SGN: { sky1: '#60A5FA', sky2: '#EFF6FF', sun: '#FBBF24', accent: '#2563EB', land1: '#0D9488', land2: '#0F766E', label: 'TP. Hồ Chí Minh · Trung tâm năng động' }
  };
  const t = themes[code] || { sky1: '#7DD3FC', sky2: '#FEF9C3', sun: '#FACC15', accent: '#0284C7', land1: '#65A30D', land2: '#4D7C0F', label: 'Điểm đến Việt Nam' };
  const gid = `g_${esc(code)}_${esc(flightNumber)}`;
  return `<svg class="vna-card-svg" viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${t.sky1}"/>
        <stop offset="100%" stop-color="${t.sky2}"/>
      </linearGradient>
    </defs>
    <rect width="360" height="150" fill="url(#${gid})"/>
    <circle cx="295" cy="36" r="24" fill="${t.sun}" opacity="0.92"/>
    <circle cx="295" cy="36" r="36" fill="${t.sun}" opacity="0.25"/>
    <path d="M0 105 Q90 78 180 100 T360 92 L360 150 L0 150 Z" fill="${t.land1}" opacity="0.72"/>
    <path d="M0 118 Q110 96 220 118 T360 110 L360 150 L0 150 Z" fill="${t.land2}" opacity="0.9"/>
    <path d="M0 132 Q120 124 240 134 T360 128 L360 150 L0 150 Z" fill="${t.accent}" opacity="0.85"/>
    <g fill="#FFFFFF" opacity="0.85">
      <ellipse cx="78" cy="34" rx="28" ry="10"/>
      <ellipse cx="96" cy="30" rx="20" ry="9"/>
      <ellipse cx="205" cy="48" rx="24" ry="8"/>
    </g>
  </svg>`;
}

function renderCustomerNavbar() {
  const overlay = state.view === 'flights';
  return `<header class="vna-header ${overlay ? 'vna-header-overlay' : 'vna-header-solid'}">
    <div class="vna-container vna-header-inner">
      <div class="vna-brand" data-action="nav" data-view="flights">
        <span class="vna-brand-icon">${icon('plane')}</span>
        <strong>Nhom14AIRLINE</strong>
      </div>
      <nav class="vna-main-nav">
        <button class="vna-nav-item ${state.view === 'flights' ? 'active' : ''}" data-action="nav" data-view="flights"><span>Mua vé</span></button>
        <button class="vna-nav-item" data-action="scroll-flights"><span>Chuyến bay</span></button>
        <button class="vna-nav-item ${state.view === 'holds' ? 'active' : ''}" data-action="nav" data-view="holds"><span>Giữ chỗ của tôi</span>${state.holds.length ? `<b class="vna-badge">${state.holds.length}</b>` : ''}</button>
        <button class="vna-nav-item ${state.view === 'tickets' ? 'active' : ''}" data-action="nav" data-view="tickets"><span>Quản lý đặt chỗ</span>${state.tickets.length ? `<b class="vna-badge subtle">${state.tickets.length}</b>` : ''}</button>
        <button class="vna-nav-item ${state.view === 'sales' ? 'active' : ''}" data-action="nav" data-view="sales"><span>Flash Sale</span></button>
        <button class="vna-nav-item ${state.view === 'passengers' ? 'active' : ''}" data-action="nav" data-view="passengers"><span>Hồ sơ Hành khách</span></button>
      </nav>
      <div class="vna-header-user">
        <span class="vna-user-greeting">Xin chào, <strong>${esc(state.user.username)}</strong></span>
        <button class="vna-logout-btn" data-action="logout" title="Đăng xuất" aria-label="Đăng xuất">${icon('logout')}</button>
      </div>
    </div>
  </header>`;
}

function renderVnaHeroBanner() {
  if (state.view !== 'flights') return '';
  const activeRoute = `${state.origin}-${state.destination}`;
  return `<section class="vna-hero">
    <img class="vna-hero-bg" src="/hero-bg.jpg" alt="Phong cảnh thiên nhiên tươi đẹp">
    <div class="vna-hero-scrim" aria-hidden="true"></div>
    <div class="vna-container vna-hero-inner">
      <div class="vna-hero-center">
        <span class="vna-hero-star-pill">${icon('star')} ĐẲNG CẤP HÀNG KHÔNG 5 SAO</span>
        <h1>Trải Nghiệm Bay Thượng Lưu</h1>
        <p>Kết nối mọi miền đất nước và vươn tầm quốc tế cùng Nhom14AIRLINE</p>
      </div>
      <div class="vna-search-card">
        <form id="filter-form" class="vna-search-grid">
          <label class="field">ĐIỂM ĐI (CHỌN HOẶC NHẬP)
            <select name="origin" id="filter-origin">${airportOptions(state.origin)}</select>
          </label>
          <button class="swap" type="button" data-action="swap" aria-label="Đổi điểm đi và điểm đến" title="Đổi chiều hành trình">${icon('swap')}</button>
          <label class="field">ĐIỂM ĐẾN (CHỌN HOẶC NHẬP)
            <select name="destination" id="filter-destination">${airportOptions(state.destination)}</select>
          </label>
          <button class="btn vna-gold-search-btn" type="submit">${icon('search')} TÌM CHUYẾN BAY</button>
        </form>
        <div class="vna-pill-filters">
          <button type="button" class="vna-chip ${activeRoute === '-' ? 'active' : ''}" data-action="quick-route" data-origin="" data-dest="">Tất cả chặng (${state.flights.length})</button>
          <button type="button" class="vna-chip ${activeRoute === 'SGN-HAN' ? 'active' : ''}" data-action="quick-route" data-origin="SGN" data-dest="HAN">TP.HCM → Hà Nội</button>
          <button type="button" class="vna-chip ${activeRoute === 'HAN-SGN' ? 'active' : ''}" data-action="quick-route" data-origin="HAN" data-dest="SGN">Hà Nội → TP.HCM</button>
          <button type="button" class="vna-chip ${activeRoute === 'SGN-DAD' ? 'active' : ''}" data-action="quick-route" data-origin="SGN" data-dest="DAD">TP.HCM → Đà Nẵng</button>
          <button type="button" class="vna-chip ${activeRoute === 'SGN-PQC' ? 'active' : ''}" data-action="quick-route" data-origin="SGN" data-dest="PQC">TP.HCM → Phú Quốc</button>
        </div>
      </div>
    </div>
  </section>`;
}

function renderShell() {
  if (!state.user) return renderAuth();
  const isAdmin = state.user.role === 'ADMIN';
  const isAdminPortal = isAdmin && state.portal === 'admin';

  if (!isAdminPortal) {
    // GIAO DIỆN NGƯỜI DÙNG SÁNG THOÁNG CHUẨN VIETNAMAIRLINES.COM/VN/VI/
    $('#app').innerHTML = `<div class="vna-customer-portal">
      ${renderCustomerNavbar()}
      ${renderVnaHeroBanner()}
      <main class="vna-container vna-main-content">
        ${state.view !== 'flights' ? pageHead() : ''}
        ${renderViolationAlertBanner()}
        ${state.view === 'flights' ? renderFlights()
        : state.view === 'holds' ? renderHolds()
          : state.view === 'tickets' ? renderTickets()
            : state.view === 'sales' ? renderSales()
              : renderPassengers()}
      </main>
      ${renderSeatModal()}
      <footer class="vna-footer">
        <div class="vna-container vna-footer-grid">
          <div>
            <strong>Nhom14AIRLINE · Hệ thống Đặt vé Trực tuyến</strong>
            <p>Cổng đặt vé máy bay trực tuyến & săn vé Flash Sale (Đề tài 23).</p>
          </div>
          <div>
            <strong>Dịch vụ trực tuyến</strong>
            <p>Mua vé máy bay · Giữ chỗ 10 phút · Săn vé Flash Sale · Tra cứu Thẻ lên tàu bay ETKT</p>
          </div>
          <div>
            <strong>Cam kết dịch vụ</strong>
            <p>Giao diện tối ưu · Bảo lưu ghế ngồi 10 phút · Xuất vé điện tử tức thời</p>
          </div>
        </div>
      </footer>
    </div>`;
    updateCountdowns();
    return;
  }

  // GIAO DIỆN QUẢN TRỊ ADMIN SÁNG ĐẸP ĐỒNG BỘ NHOM14AIRLINE
  $('#app').innerHTML = `<div class="layout admin-mode">
    <aside class="sidebar admin-sidebar">
      ${brand(true)}
      ${navigation()}
      <div class="sidebar-bottom">
        <span class="badge green"><i class="dot"></i> HỆ QUẢN TRỊ TRỰC TUYẾN</span>
        <strong>Nhom14AIRLINE Admin</strong>
        <p>Điều hành chuyến bay, sân bay, bảng giá vé &amp; giám sát toàn vẹn.</p>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="breadcrumb">
          <span class="portal-pill admin">${icon('settings')} HỆ QUẢN TRỊ HÃNG BAY</span>
          <span>/</span>
          <strong>${views[state.view]?.[0] || 'Quản trị'}</strong>
        </div>
        <div class="user-area">
          ${state.adminViolations.length ? `<button class="violation-pill" data-action="nav" data-view="admin-violations" title="Xem các trường hợp người dùng làm sai">${icon('alert')} ${state.adminViolations.length} cảnh báo lỗi</button>` : ''}
          <span class="avatar">${esc(state.user.username.slice(0, 2).toUpperCase())}</span>
          <span class="user-name">
            <strong>${esc(state.user.username)}</strong>
            <small>Quản trị viên hệ thống</small>
          </span>
          <button class="logout" data-action="logout" title="Đăng xuất" aria-label="Đăng xuất">${icon('logout')}</button>
        </div>
      </header>
      <main class="content">
        ${pageHead()}
        ${renderAdminKPIs()}
        ${renderViolationAlertBanner()}
        ${state.view === 'admin-flights' ? renderAdminFlights()
      : state.view === 'admin-airports' ? renderAdminAirports()
        : state.view === 'admin-fares' ? renderAdminFares()
          : state.view === 'admin-users' ? renderAdminUsers()
            : state.view === 'admin-violations' ? renderAdminViolations()
              : renderLab()}
        ${renderUserHistoryModal()}
        <footer class="page-footer">
          <span>Nhom14AIRLINE Admin Portal · Hệ quản trị Hãng bay (Đề tài 23)</span>
          <span>Hệ thống điều hành khai thác trực tuyến</span>
        </footer>
      </main>
    </div>
  </div>`;
  updateCountdowns();
}

function airportOptions(selected) {
  return '<option value="">Tất cả sân bay Việt Nam</option>' + state.airports.map(a => `<option value="${esc(a.code)}" ${selected === a.code ? 'selected' : ''}>${esc(city(a.code, a.city))} (${esc(a.code)})</option>`).join('');
}

function renderUserMistakeSimulatorBox() {
  return `<div class="card mistake-sim-box">
    <div class="card-heading">
      <div>
        <span class="eyebrow">KIỂM TRA THÔNG BÁO KHI NGƯỜI DÙNG THAO TÁC SAI</span>
        <h2>Thử nghiệm các trường hợp người dùng làm sai quy tắc nghiệp vụ</h2>
      </div>
      <span class="badge red">${icon('alert')} BẮT LỖI TỪ POSTGRESQL</span>
    </div>
    <p class="sim-desc">Bấm vào một tình huống bên dưới để mô phỏng việc người dùng thao tác sai (giống 12 kịch bản kiểm thử nghiệp vụ). Hệ thống sẽ hiển thị <strong>Thông báo cảnh báo lỗi</strong> ngay trên màn hình và đồng thời ghi vào tab <strong>"Cảnh báo lỗi nghiệp vụ"</strong> bên giao diện Admin:</p>
    <div class="sim-buttons">
      <button type="button" class="btn secondary sm" data-action="sim-mistake" data-case="BOOKED_SEAT">${icon('alert')} Đặt ghế đã có người mua (P2001)</button>
      <button type="button" class="btn secondary sm" data-action="sim-mistake" data-case="STALE_VERSION">${icon('alert')} Giữ ghế với Version cũ / Optimistic CAS (P2003)</button>
      <button type="button" class="btn secondary sm" data-action="sim-mistake" data-case="EXPIRED_CHECKOUT">${icon('alert')} Thanh toán giữ chỗ đã hết hạn (P2004)</button>
      <button type="button" class="btn secondary sm" data-action="sim-mistake" data-case="WRONG_OWNER">${icon('alert')} Thanh toán giữ chỗ của người khác (P2010)</button>
      <button type="button" class="btn secondary sm" data-action="sim-mistake" data-case="QUOTA_EXCEEDED">${icon('alert')} Mua vượt hạn ngạch Flash Sale (P2006)</button>
      <button type="button" class="btn secondary sm" data-action="sim-mistake" data-case="REOPEN_BOOKED">${icon('alert')} Mở bán lại ghế đã xuất vé (P2005)</button>
    </div>
  </div>`;
}

function renderFlights() {
  return `<section class="vna-flash-section">
    <div class="vna-section-head">
      <div>
        <span class="vna-flash-eyebrow">${icon('bolt')} SIÊU ƯU ĐÃI CÓ HẠN</span>
        <h2>Flash Sale Giờ Vàng</h2>
        <p class="vna-section-sub">Giá vé khuyến mãi cập nhật trực tiếp theo thời gian thực · Hạn ngạch kiểm soát nghiêm ngặt.</p>
      </div>
      <button class="text-btn" data-action="nav" data-view="sales">Xem tất cả ưu đãi →</button>
    </div>
    <div class="vna-flash-cards">
      ${state.sales.slice(0, 4).map(s => `<article class="vna-flash-card">
        <div class="vna-flash-card-top">
          <div class="vna-flash-top-row">
            <span class="vna-flash-pill">${icon('bolt')} FLASH SALE</span>
            <span class="vna-flash-flight">${esc(s.flight_number)}</span>
          </div>
          <h3>${esc(city(s.dest_code, s.dest_city))}</h3>
          <p>Từ ${esc(city(s.origin_code, s.origin_city))} (${esc(s.origin_code)} → ${esc(s.dest_code)})</p>
        </div>
        <div class="vna-flash-card-body">
          <div class="vna-flash-price-row">
            <strong>${money(s.sale_price)}</strong>
            <span>Còn ${s.quota - s.sold_count}/${esc(s.quota)} suất</span>
          </div>
          <button type="button" class="btn primary wide vna-buy-btn" data-action="sale" data-sale="${s.flash_sale_item_id}" ${s.sold_count >= s.quota ? 'disabled' : ''}>${s.sold_count >= s.quota ? 'Đã hết suất' : 'Săn vé ngay'}</button>
        </div>
      </article>`).join('')}
    </div>
  </section>

  <section id="flight-results" class="vna-flights-section">
    <div class="vna-section-head">
      <div>
        <span class="eyebrow">CHUYẾN BAY ĐANG MỞ BÁN · CHỌN HÀNH TRÌNH</span>
        <h2>Lịch bay có thể đặt (${state.flights.length} chuyến)</h2>
      </div>
      <button class="btn secondary sm" data-action="refresh">${icon('refresh')} Cập nhật giá & ghế</button>
    </div>
    ${state.flights.length ? `<div class="vna-flight-cards">
      ${state.flights.map(f => {
    const sale = state.sales.find(s => Number(s.schedule_id) === Number(f.schedule_id) && s.quota > s.sold_count);
    const isSelected = Number(state.scheduleId) === Number(f.schedule_id);
    return `<article class="vna-flight-card ${isSelected ? 'selected' : ''}">
          <div class="vna-card-cover">
            ${destinationArtwork(f.dest_code, f.flight_number)}
            <span class="vna-card-flight-tag">${esc(f.flight_number)} · Còn ${esc(f.available)} ghế</span>
            ${sale ? `<span class="vna-card-sale-tag">Flash Sale ${money(sale.sale_price)}</span>` : ''}
          </div>
          <div class="vna-card-body">
            <h3>${esc(city(f.origin_code, f.origin_city))} (${esc(f.origin_code)}) đến<br>${esc(city(f.dest_code, f.dest_city))} (${esc(f.dest_code)})</h3>
            <p class="vna-card-date">Khởi hành: ${date(f.departure_time)} · ${time(f.departure_time)} → ${time(f.arrival_time)}</p>
            <div class="vna-card-price-box">
              <span class="vna-price-from">Từ</span>
              <strong class="vna-card-price">${f.min_price != null ? money(f.min_price) : 'Hết ghế'}*</strong>
              <span class="vna-price-meta">Một chiều / Phổ thông &amp; Thương gia</span>
            </div>
            <button type="button" class="btn primary wide vna-buy-btn" data-action="select-flight" data-schedule="${f.schedule_id}">Mua ngay</button>
          </div>
        </article>`;
  }).join('')}
    </div>`: `<div class="card">${empty('plane', 'Chưa có chuyến bay phù hợp', 'Vui lòng chọn lại sân bay khởi hành hoặc điểm đến.')}</div>`}
  </section>`;
}

function renderSeatModal() {
  if (!state.scheduleId || state.view !== 'flights') return '';
  return `<div class="seat-modal-backdrop" id="seat-modal-backdrop">
    <div id="seat-panel" class="card seat-modal" role="dialog" aria-modal="true" aria-label="Chọn chỗ ngồi tàu bay">
      ${renderSeatPanel()}
    </div>
  </div>`;
}

function activeHold() { return state.holds.find(h => Number(h.seat_id) === Number(state.seatId) && Number(h.schedule_id) === Number(state.scheduleId)); }
function selectedSale() { return state.sales.find(s => Number(s.flash_sale_item_id) === Number(state.saleId) && Number(s.schedule_id) === Number(state.scheduleId)); }

function renderSeatPanel() {
  const flight = state.flights.find(f => Number(f.schedule_id) === Number(state.scheduleId));
  if (!flight) return `<div class="seat-placeholder">${icon('seat')}<h3>Sơ đồ chỗ ngồi tàu bay</h3><p>Vui lòng nhấn <strong>"Chọn ghế"</strong> ở một chuyến bay bên trái để mở sơ đồ khoang Airbus A321 và xem giá từng loại vé.</p></div>`;
  const chosen = state.seats.find(s => Number(s.seat_id) === Number(state.seatId)), hold = activeHold(), sale = selectedSale();
  const bSeatPrice = state.seats.find(s => s.seat_class === 'BUSINESS')?.base_price ?? 4500000;
  const eSeatPrice = state.seats.find(s => s.seat_class === 'ECONOMY')?.base_price ?? 1850000;
  let cells = '';
  for (let row = 1; row <= 2; row++) {
    cells += `<div class="class-divider">${row === 1 ? `HẠNG THƯƠNG GIA · BUSINESS (${money(bSeatPrice)})` : `HẠNG PHỔ THÔNG · ECONOMY (${money(eSeatPrice)})`}</div>`;
    for (const [index, letter] of [...'ABCDEF'].entries()) {
      const seat = state.seats.find(s => s.seat_number === row + letter);
      if (index === 3) cells += `<span class="aisle-mark" aria-hidden="true">${row}</span>`;
      if (!seat) { cells += '<span></span>'; continue; }
      const own = seat.reservation_id != null, disabled = seat.status === 'BOOKED' || seat.status === 'HOLD' && !own;
      cells += `<button class="seat ${esc(seat.status)} ${own ? 'own' : ''} ${Number(state.seatId) === Number(seat.seat_id) ? 'active' : ''}" data-action="select-seat" data-seat="${seat.seat_id}" data-seat-number="${esc(seat.seat_number)}" title="Ghế ${esc(seat.seat_number)} (${seat.seat_class}) · ${money(sale?.sale_price ?? seat.base_price)} · v${seat.version}${own ? ' · Bạn đang giữ' : ''}" aria-label="Ghế ${esc(seat.seat_number)}${disabled ? ' không còn trống' : ''}" aria-pressed="${Number(state.seatId) === Number(seat.seat_id)}" ${disabled ? 'disabled' : ''}>${esc(seat.seat_number)}</button>`;
    }
  }
  return `<div class="seat-head">
    <div class="seat-head-top">
      <div>
        <div class="eyebrow">SƠ ĐỒ KHOANG TÀU BAY · LỊCH #${flight.schedule_id}</div>
        <h2>${esc(flight.flight_number)} · ${esc(flight.origin_code)} → ${esc(flight.dest_code)}</h2>
      </div>
      <button type="button" class="seat-modal-close" data-action="close-seat" title="Đóng sơ đồ chọn ghế" aria-label="Đóng">${icon('close')}</button>
    </div>
    <div class="seat-route">${esc(city(flight.origin_code, flight.origin_city))} → ${esc(city(flight.dest_code, flight.dest_city))} · ${date(flight.departure_time)} · ${time(flight.departure_time)} ${sale ? `<span class="badge amber">FLASH SALE</span>` : ''}</div>
  </div>
  <div class="seat-section">
    <div class="legend">
      <span><i></i> Trống</span>
      <span><i class="chosen"></i> Đang chọn</span>
      <span><i class="holding"></i> Đang giữ</span>
      <span><i class="taken"></i> Đã xuất vé</span>
    </div>
    <div class="fuselage">
      <div class="cockpit-label">BUỒNG LÁI · A321</div>
      <div class="seat-labels"><span>A</span><span>B</span><span>C</span><span></span><span>D</span><span>E</span><span>F</span></div>
      <div class="seat-grid">${cells}</div>
    </div>
    <div class="seat-selection">
      <div>
        <span>GHẾ & LOẠI VÉ</span><br>
        <strong>${chosen ? `${esc(chosen.seat_number)} (${chosen.seat_class === 'BUSINESS' ? 'Thương gia' : 'Phổ thông'})` : 'Chưa chọn'}</strong>
      </div>
      <div class="text-right">
        <span>${sale ? 'GIÁ ƯU ĐÃI FLASH SALE' : 'TỔNG GIÁ VÉ'}</span><br>
        <strong class="highlight-price">${chosen ? money(sale?.sale_price ?? chosen.base_price) : '—'}</strong>
      </div>
    </div>
  </div>
  <div class="seat-info">
    ${hold ? `<div class="checkout-box">
      <h3>Đã giữ ghế ${esc(hold.seat_number)} thành công</h3>
      <div class="help">Thời gian bảo lưu chỗ ngồi còn lại:</div>
      <span class="countdown" data-expires="${esc(hold.hold_expires_at)}">—</span>
      <div class="help">${sale ? 'Giá Flash Sale sẽ được kiểm tra hạn ngạch khi thanh toán.' : 'Chỗ ngồi đang được khóa cho tài khoản của bạn.'}</div>
      <button class="btn primary wide" data-action="checkout" data-reservation="${hold.reservation_id}">Thanh toán & xuất vé ${icon('arrow')}</button>
      <button class="btn ghost wide sm" data-action="expire" data-reservation="${hold.reservation_id}">Giả lập hết hạn</button>
    </div>`: `<label class="field">CƠ CHẾ KHÓA GIAO DỊCH (CONCURRENCY MODE)
      <select id="hold-mode">
        <option value="PESSIMISTIC" ${state.mode === 'PESSIMISTIC' ? 'selected' : ''}>Khóa bi quan · FOR UPDATE NOWAIT</option>
        <option value="OPTIMISTIC" ${state.mode === 'OPTIMISTIC' ? 'selected' : ''}>Khóa lạc quan · Kiểm tra Version (CAS)</option>
        <option value="AUTO" ${state.mode === 'AUTO' ? 'selected' : ''}>Tự chọn ghế phổ thông · SKIP LOCKED</option>
      </select>
    </label>
    <p class="help">${state.mode === 'OPTIMISTIC' && chosen ? `Version hiện tại của ghế ${chosen.seat_number}: v${chosen.version}. Nếu version thay đổi trước khi giữ, giao dịch sẽ từ chối (P2003).` : state.mode === 'AUTO' ? 'Hệ thống tự động tìm và khóa 1 ghế Phổ thông đang trống mà không phải chờ khóa (SKIP LOCKED).' : 'Khóa dòng trực tiếp với NOWAIT; từ chối ngay nếu có hành khách khác đang thao tác trên cùng ghế.'}</p>
    <button class="btn primary wide" data-action="hold" ${!chosen && state.mode !== 'AUTO' ? 'disabled' : ''}>${icon('clock')} Giữ ghế trong 10 phút</button>`}
    ${sale ? `<p class="help">Đang áp dụng Flash Sale #${sale.flash_sale_item_id} (${money(sale.sale_price)}) · Còn ${sale.quota - sale.sold_count} suất. <button class="text-btn" data-action="clear-sale">Bỏ ưu đãi</button></p>` : ''}
  </div>`;
}

function empty(image, title, message) { return `<div class="empty">${icon(image)}<h3>${esc(title)}</h3><p>${esc(message)}</p></div>`; }

function renderTickets() {
  return `<div class="card ticket-verify-bar">
    <div>
      <span class="eyebrow">TRA CỨU & XÁC THỰC VÉ ĐIỆN TỬ</span>
      <h3>Kiểm tra thông tin Thẻ lên tàu bay & Nhật ký giao dịch</h3>
    </div>
    <form id="verify-ticket-form" class="verify-form">
      <input name="code" placeholder="Nhập mã vé điện tử (VD: ETKT-1)" required maxlength="50" value="${esc(state.verifiedTicket?.e_ticket_number || '')}">
      <button class="btn dark" type="submit">Tra cứu vé</button>
      ${state.verifiedTicket ? `<button class="btn ghost" type="button" data-action="clear-verify">Đóng</button>` : ''}
    </form>
  </div>
  ${state.verifiedTicket ? `<div class="card verified-detail">
    <div class="card-heading">
      <h2>Kết quả xác thực mã vé: <code>${esc(state.verifiedTicket.e_ticket_number)}</code></h2>
      <span class="badge green">✓ VÉ HỢP LỆ · ${esc(state.verifiedTicket.status)}</span>
    </div>
    <div class="verified-grid">
      <div><small>HÀNH KHÁCH SỞ HỮU</small><strong>${esc(state.verifiedTicket.username)} (${esc(state.verifiedTicket.email)})</strong></div>
      <div><small>CHUYẾN BAY & HÀNH TRÌNH</small><strong>${esc(state.verifiedTicket.flight_number)} · ${esc(state.verifiedTicket.origin_code)} → ${esc(state.verifiedTicket.dest_code)}</strong></div>
      <div><small>CHỖ NGỒI & HẠNG VÉ</small><strong>Ghế ${esc(state.verifiedTicket.seat_number)} (${esc(state.verifiedTicket.seat_class)})</strong></div>
      <div><small>THANH TOÁN (${esc(state.verifiedTicket.payment_status || 'COMPLETED')})</small><strong>${money(state.verifiedTicket.paid_amount ?? state.verifiedTicket.total_amount)}</strong></div>
    </div>
    <div class="verified-logs">
      <strong>Nhật ký chuyển trạng thái (Audit Trigger booking_logs):</strong>
      ${state.verifiedTicket.logs?.length ? state.verifiedTicket.logs.map(l => `<span class="badge blue">${esc(l.old_status || 'NULL')} → ${esc(l.new_status)} (${time(l.changed_at)} ${date(l.changed_at)})</span>`).join(' ') : '<span class="muted small">Không có bản ghi log.</span>'}
    </div>
  </div>`: ''}
  ${state.tickets.length ? `<div class="tickets">${state.tickets.map(t => `<article class="ticket">
    <div class="ticket-top">
      <div>
        <span class="boarding-airline">✈ Nhom14AIRLINE · BOARDING PASS</span>
        <strong>${esc(t.flight_number)} · ${esc(t.seat_class === 'BUSINESS' ? 'Hạng Thương gia' : 'Hạng Phổ thông')}</strong>
      </div>
      <span class="badge green">✓ ĐÃ XÁC NHẬN</span>
    </div>
    <div class="ticket-content">
      <div class="ticket-route">
        <div class="ticket-city">
          <strong>${esc(t.origin_code)}</strong>
          <small>${esc(city(t.origin_code, t.origin_city))}</small>
        </div>
        <span class="route-line">${icon('plane')}</span>
        <div class="ticket-city text-right">
          <strong>${esc(t.dest_code)}</strong>
          <small>${esc(city(t.dest_code, t.dest_city))}</small>
        </div>
      </div>
      <div class="ticket-details">
        <div><small>NGÀY & GIỜ BAY</small><strong>${time(t.departure_time)} · ${date(t.departure_time)}</strong></div>
        <div><small>GHẾ NGỒI</small><strong>${esc(t.seat_number)}</strong></div>
        <div><small>LOẠI GIÁ VÉ</small><strong>${t.flash_sale_item_id ? '⚡ Flash Sale' : 'Tiêu chuẩn'}</strong></div>
        <div><small>HÀNH KHÁCH</small><strong>${esc(state.user.username.toUpperCase())}</strong></div>
      </div>
    </div>
    <div class="ticket-bottom">
      <div class="ticket-code-wrap">
        <code>${esc(t.e_ticket_number)}</code>
        <button class="text-btn" type="button" data-action="inspect-ticket" data-code="${esc(t.e_ticket_number)}">Xem Audit Log</button>
      </div>
      <strong>${money(t.total_amount)}</strong>
    </div>
  </article>`).join('')}</div>` : `<div class="card">${empty('ticket', 'Bạn chưa có vé điện tử nào', 'Chọn một chuyến bay, giữ ghế và hoàn tất thanh toán để phát hành thẻ lên tàu bay điện tử.')}<div class="seat-section text-center"><button class="btn primary" data-action="nav" data-view="flights">Đặt chuyến bay ngay →</button></div></div>`}`;
}

function renderHolds() {
  return state.holds.length ? `<div class="holds-list">${state.holds.map(h => {
    const sales = state.sales.filter(s => Number(s.schedule_id) === Number(h.schedule_id) && s.quota > s.sold_count);
    return `<article class="card hold-item">
      <div class="hold-title">
        <span class="badge amber">ĐANG GIỮ CHỖ · MÃ #${h.reservation_id}</span>
        <h3>${esc(h.flight_number)} · Ghế ${esc(h.seat_number)} (${esc(h.seat_class === 'BUSINESS' ? 'Thương gia' : 'Phổ thông')})</h3>
        <p>Hành trình: <strong>${esc(h.origin_code)} → ${esc(h.dest_code)}</strong></p>
        <span class="countdown" data-expires="${esc(h.hold_expires_at)}">—</span>
      </div>
      <div>
        <label class="field">CHỌN MỨC GIÁ THANH TOÁN
          <select id="sale-for-${h.reservation_id}">
            <option value="">Giá tiêu chuẩn (${h.seat_class === 'BUSINESS' ? 'Thương gia' : 'Phổ thông'}) · ${money(h.quoted_price)}</option>
            ${sales.map(s => `<option value="${s.flash_sale_item_id}">⚡ Flash sale #${s.flash_sale_item_id} · ${money(s.sale_price)} (còn ${s.quota - s.sold_count} suất)</option>`).join('')}
          </select>
        </label>
        <p class="help">Hạn ngạch Flash Sale được khóa và kiểm tra nguyên tử tại thời điểm bấm Thanh toán.</p>
      </div>
      <div class="hold-actions">
        <button class="btn primary" data-action="checkout-list" data-reservation="${h.reservation_id}">Thanh toán & xuất vé</button>
        <button class="btn ghost sm" data-action="expire" data-reservation="${h.reservation_id}">Giả lập hết hạn</button>
      </div>
    </article>`;
  }).join('')}</div>` : `<div class="card">${empty('clock', 'Không có giữ chỗ nào đang chờ thanh toán', 'Mỗi lần giữ ghế có hiệu lực 10 phút. Khi quá hạn, hệ thống tự động giải phóng ghế về trạng thái trống.')}<div class="seat-section text-center"><button class="btn primary" data-action="nav" data-view="flights">Chọn một chuyến bay →</button></div></div>`;
}

function renderSales() {
  return `<div class="notice">${icon('bolt')}<div><strong>Cơ chế Flash Sale chuẩn ACID — Giữ ghế không trừ trước hạn ngạch.</strong>Hạn ngạch (quota) chỉ giảm khi giao dịch <code>checkout()</code> thành công. Nếu hết suất ưu đãi, giao dịch thanh toán ưu đãi bị từ chối (SQLSTATE <code>P2006</code>) nhưng giữ chỗ ghế của bạn vẫn được bảo toàn để thanh toán theo giá tiêu chuẩn.</div></div>
  <div class="section-note"><h2>${state.sales.length} chương trình Flash Sale theo lịch bay</h2></div>
  <div class="sale-grid">${state.sales.map(s => `<article class="card sale-card">
    <div class="sale-card-head">
      <span class="badge amber">${icon('bolt')} FLASH SALE #${s.flash_sale_item_id}</span>
      <span class="flight-pill">${esc(s.flight_number)}</span>
    </div>
    <h3>${esc(s.origin_code)} → ${esc(s.dest_code)}</h3>
    <p>${esc(city(s.origin_code, s.origin_city))} đi ${esc(city(s.dest_code, s.dest_city))} · Lịch #${s.schedule_id}</p>
    <div class="sale-price-box">
      <small>GIÁ ƯU ĐÃI CHỈ TỪ</small>
      <strong class="sale-price">${money(s.sale_price)}</strong>
    </div>
    <progress class="sale-progress" value="${s.sold_count}" max="${s.quota || 1}" aria-label="Đã dùng ${s.sold_count} trên ${s.quota} suất"></progress>
    <div class="sale-meta"><span>Đã xuất: <strong>${s.sold_count}/${s.quota}</strong> vé</span><span>Còn lại: <strong>${s.quota - s.sold_count}</strong> suất</span></div>
    <button class="btn ${s.sold_count >= s.quota ? 'secondary' : 'primary'} wide" data-action="sale" data-sale="${s.flash_sale_item_id}" ${s.sold_count >= s.quota ? 'disabled' : ''}>${s.sold_count >= s.quota ? 'Đã hết suất ưu đãi' : 'Săn vé ưu đãi ngay →'}</button>
  </article>`).join('')}</div>`;
}

function renderPassengers() {
  return `<div class="grid-booking">
    <section class="card">
      <div class="card-heading">
        <h2>Danh sách hành khách đã lưu (${state.passengers.length})</h2>
        <span class="badge blue">BẢNG PASSENGERS</span>
      </div>
      ${state.passengers.length ? `<div class="table-wrap">
        <table class="flight-table">
          <thead>
            <tr><th>MÃ HK</th><th>HỌ & TÊN ĐỆM</th><th>TÊN</th><th>SỐ HỘ CHIẾU / CCCD</th><th></th></tr>
          </thead>
          <tbody>
            ${state.passengers.map(p => `<tr>
              <td><code>#${p.passenger_id}</code></td>
              <td><strong>${esc(p.last_name)}</strong></td>
              <td><strong>${esc(p.first_name)}</strong></td>
              <td><code>${esc(p.passport_number)}</code></td>
              <td class="text-right"><button class="btn danger sm" data-action="delete-passenger" data-id="${p.passenger_id}">Xóa</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`: empty('users', 'Chưa có hồ sơ hành khách', 'Thêm thông tin hành khách bên phải để lưu vào bảng passengers trong CSDL.')}
    </section>
    <aside class="card">
      <div class="seat-head">
        <div class="eyebrow">THÊM HÀNH KHÁCH MỚI</div>
        <h2>Hồ sơ hành khách</h2>
      </div>
      <form id="passenger-form" class="seat-section form-stack">
        <label class="field">HỌ & TÊN ĐỆM (LAST NAME)
          <input name="last_name" placeholder="VD: Nguyễn" required maxlength="50">
        </label>
        <label class="field">TÊN HÀNH KHÁCH (FIRST NAME)
          <input name="first_name" placeholder="VD: Văn An" required maxlength="50">
        </label>
        <label class="field">SỐ HỘ CHIẾU / CCCD (UNIQUE)
          <input name="passport_number" placeholder="VD: C98765432" required minlength="5" maxlength="30">
        </label>
        <button class="btn primary wide" type="submit">Lưu hồ sơ hành khách</button>
      </form>
    </aside>
  </div>`;
}

/* ============================================================================
   5 TAB QUẢN TRỊ ADMIN RIÊNG BIỆT
   1. Quản trị chuyến bay (admin-flights)
   2. Quản trị sân bay (admin-airports)
   3. Quản lý loại vé (admin-fares)
   4. Quản lý người dùng & lịch sử mua vé (admin-users)
   5. Cảnh báo lỗi nghiệp vụ khi người dùng thao tác sai (admin-violations)
============================================================================ */

function requireAdminGuard() {
  return `<div class="card">${empty('shield', 'Cần tài khoản quản trị', 'Đăng nhập bằng admin / admin123 để truy cập Hệ quản trị Hãng bay.')}</div>`;
}

function renderAdminKPIs() {
  const fl = state.adminFlightsData;
  const routesCount = fl?.flights?.length ?? 0;
  const schedulesCount = fl?.schedules?.length ?? state.overview?.schedules ?? 0;
  const airportsCount = state.adminAirports?.length ?? state.airports?.length ?? 0;
  const usersCount = state.adminUsers?.length ?? 0;
  const buyersCount = (state.adminUsers || []).filter(u => Number(u.tickets_bought || 0) > 0).length;
  const violationsCount = state.adminViolations?.length ?? 0;
  return `<div class="stats admin-kpis">
    <div class="stat">
      <div>
        <span class="label">Chuyến bay &amp; Lịch bay</span>
        <strong>${routesCount} tuyến / ${schedulesCount} lịch</strong>
        <span class="foot">Đang mở bán khai thác</span>
      </div>
      <div class="stat-icon">${icon('plane')}</div>
    </div>
    <div class="stat">
      <div>
        <span class="label">Sân bay quản trị</span>
        <strong>${airportsCount} sân bay</strong>
        <span class="foot">Nguồn tạo tuyến bay hợp lệ</span>
      </div>
      <div class="stat-icon">${icon('map')}</div>
    </div>
    <div class="stat">
      <div>
        <span class="label">Người dùng &amp; Khách mua</span>
        <strong>${usersCount} TK (${buyersCount} đã mua)</strong>
        <span class="foot">Bấm Quản lý người dùng để xem</span>
      </div>
      <div class="stat-icon">${icon('users')}</div>
    </div>
    <div class="stat kpi-clickable" data-action="nav" data-view="admin-violations">
      <div>
        <span class="label">Cảnh báo thao tác sai</span>
        <strong>${violationsCount} cảnh báo</strong>
        <span class="foot">Giám sát vi phạm nghiệp vụ</span>
      </div>
      <div class="stat-icon">${icon('alert')}</div>
    </div>
  </div>`;
}

// TAB 1: QUẢN TRỊ CHUYẾN BAY
function renderAdminFlights() {
  if (state.user.role !== 'ADMIN') return requireAdminGuard();
  const data = state.adminFlightsData;
  if (!data) return `<div class="card"><div class="seat-section">Đang tải dữ liệu chuyến bay...</div></div>`;
  const airports = data.airports || [];
  const flights = data.flights || [];
  const schedules = data.schedules || [];
  const aircrafts = data.aircrafts || [];

  return `<div class="grid-booking">
    <section>
      <div class="card">
        <div class="card-heading">
          <h2>Danh mục Tuyến bay & Mã số Chuyến bay (${flights.length} tuyến)</h2>
          <span class="badge blue">BẢNG FLIGHTS</span>
        </div>
        <div class="table-wrap">
          <table class="flight-table">
            <thead>
              <tr>
                <th>MÃ SỐ CHUYẾN BAY</th>
                <th>SÂN BAY KHỞI HÀNH (ĐI TỪ)</th>
                <th>SÂN BAY ĐẾN (TỚI ĐÂU)</th>
                <th>TÀU BAY & SỨC CHỨA</th>
                <th>THỜI GIAN BAY</th>
                <th>SỐ LỊCH BAY</th>
              </tr>
            </thead>
            <tbody>
              ${flights.map(f => `<tr>
                <td><span class="flight-pill">${esc(f.flight_number)}</span></td>
                <td><strong>${esc(f.origin_code)}</strong> · ${esc(f.origin_name)} (${esc(f.origin_city)})</td>
                <td><strong>${esc(f.dest_code)}</strong> · ${esc(f.dest_name)} (${esc(f.dest_city)})</td>
                <td>${esc(f.model)} (${esc(f.capacity)} ghế)</td>
                <td>${esc(f.duration_minutes)} phút</td>
                <td><span class="badge green">${esc(f.schedule_count)} lịch khởi hành</span></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card lab-wide">
        <div class="card-heading">
          <h2>Danh sách Lịch bay đang khai thác (${schedules.length} lịch bay)</h2>
          <span class="badge green">BẢNG FLIGHT_SCHEDULES</span>
        </div>
        <div class="table-wrap">
          <table class="activity-table">
            <thead>
              <tr>
                <th>MÃ LỊCH</th>
                <th>MÃ CHUYẾN BAY</th>
                <th>CHẶNG BAY (TỪ ĐÂU TỚI ĐÂU)</th>
                <th>KHỞI HÀNH → HẠ CÁNH</th>
                <th>GHẾ TRỐNG / GIỮ / ĐÃ BÁN</th>
                <th>GIÁ THƯƠNG GIA / PHỔ THÔNG</th>
              </tr>
            </thead>
            <tbody>
              ${schedules.map(s => `<tr>
                <td><code>#${s.schedule_id}</code></td>
                <td><strong>${esc(s.flight_number)}</strong></td>
                <td><strong>${esc(s.origin_code)} (${esc(s.origin_city)}) → ${esc(s.dest_code)} (${esc(s.dest_city)})</strong></td>
                <td>${time(s.departure_time)} ${date(s.departure_time)} → ${time(s.arrival_time)}</td>
                <td><span class="badge green">${s.available_seats} trống</span> <span class="badge amber">${s.held_seats} giữ</span> <span class="badge blue">${s.booked_seats} đã bán</span></td>
                <td><strong>${money(s.business_price)}</strong> / <strong>${money(s.economy_price)}</strong></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <aside class="card">
      <div class="seat-head">
        <div class="eyebrow">TẠO CHUYẾN BAY MỚI</div>
        <h2>Khởi tạo Chuyến bay & Lịch bay</h2>
        <div class="seat-route">Chỉ sử dụng các sân bay đã có trong mục Quản trị Sân bay (${airports.length} sân bay)</div>
      </div>
      <form id="admin-create-flight-form" class="seat-section form-stack">
        <label class="field">MÃ SỐ CHUYẾN BAY (FLIGHT NUMBER)
          <input name="flight_number" placeholder="VD: VN368, VN550" required maxlength="20">
        </label>
        <label class="field">BAY TỪ ĐÂU (SÂN BAY KHỞI HÀNH)
          <select name="origin_airport_id" required>
            ${airports.map(a => `<option value="${a.airport_id}">${esc(a.code)} · ${esc(a.name)} (${esc(a.city)})</option>`).join('')}
          </select>
        </label>
        <label class="field">BAY TỚI ĐÂU (SÂN BAY ĐẾN)
          <select name="destination_airport_id" required>
            ${airports.map((a, idx) => `<option value="${a.airport_id}" ${idx === 1 ? 'selected' : ''}>${esc(a.code)} · ${esc(a.name)} (${esc(a.city)})</option>`).join('')}
          </select>
        </label>
        <label class="field">TÀU BAY KHAI THÁC
          <select name="aircraft_id" required>
            ${aircrafts.map(ac => `<option value="${ac.aircraft_id}">${esc(ac.model)} (${ac.capacity} ghế)</option>`).join('')}
          </select>
        </label>
        <div class="form-grid-2">
          <label class="field">THỜI GIAN BAY (PHÚT)
            <input name="duration_minutes" type="number" min="15" max="1440" value="120" required>
          </label>
          <label class="field">KHỞI HÀNH SAU (NGÀY)
            <input name="days_from_now" type="number" min="1" max="180" value="10" required>
          </label>
          <label class="field">GIÁ VÉ THƯƠNG GIA (VND)
            <input name="business_price" type="number" min="0" step="50000" value="4500000" required>
          </label>
          <label class="field">GIÁ VÉ PHỔ THÔNG (VND)
            <input name="economy_price" type="number" min="0" step="50000" value="1850000" required>
          </label>
        </div>
        <button class="btn primary wide" type="submit">${icon('plane')} Tạo chuyến bay mới & 12 ghế</button>
        <p class="help">Muốn bay tới sân bay chưa có trong danh sách? Hãy sang tab <button type="button" class="text-btn" data-action="nav" data-view="admin-airports">Quản trị sân bay</button> để thêm sân bay trước.</p>
      </form>
    </aside>
  </div>`;
}

// TAB 2: QUẢN TRỊ SÂN BAY
function renderAdminAirports() {
  if (state.user.role !== 'ADMIN') return requireAdminGuard();
  const airports = state.adminAirports || [];
  return `<div class="notice">
    ${icon('map')}
    <div>
      <strong>Quy tắc toàn vẹn Sân bay — Tuyến bay (Foreign Key & Check Constraint)</strong>
      Admin chỉ có thể tạo chuyến bay giữa những sân bay đang có mặt trong bảng <code>airports</code> dưới đây. Sân bay đã có tuyến bay khai thác sẽ được bảo vệ không cho xóa nhằm giữ toàn vẹn tham chiếu.
    </div>
  </div>
  <div class="grid-booking lab-wide">
    <section class="card">
      <div class="card-heading">
        <h2>Danh sách Sân bay trong Hệ quản trị (${airports.length} sân bay)</h2>
        <span class="badge blue">BẢNG AIRPORTS</span>
      </div>
      <div class="table-wrap">
        <table class="flight-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>MÃ IATA</th>
              <th>TÊN SÂN BAY</th>
              <th>THÀNH PHỐ</th>
              <th>QUỐC GIA</th>
              <th>TUYẾN ĐI / ĐẾN</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${airports.map(a => {
    const totalRoutes = Number(a.origin_flights || 0) + Number(a.dest_flights || 0);
    return `<tr>
                <td><code>#${a.airport_id}</code></td>
                <td><span class="flight-pill">${esc(a.code)}</span></td>
                <td><strong>${esc(a.name)}</strong></td>
                <td>${esc(a.city)}</td>
                <td>${esc(a.country)}</td>
                <td><span class="badge ${totalRoutes ? 'green' : 'amber'}">${a.origin_flights} chuyến đi · ${a.dest_flights} chuyến đến</span></td>
                <td class="text-right">
                  <button class="btn danger sm" data-action="delete-airport" data-id="${a.airport_id}" title="${totalRoutes ? 'Sân bay đang có chuyến bay (bấm để thử ràng buộc FK)' : 'Xóa sân bay'}">Xóa</button>
                </td>
              </tr>`;
  }).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <aside class="card">
      <div class="seat-head">
        <div class="eyebrow">MỞ RỘNG MẠNG ĐƯỜNG BAY</div>
        <h2>Thêm Sân bay mới</h2>
        <div class="seat-route">Sau khi thêm, sân bay này sẽ xuất hiện ngay trong mục Tạo chuyến bay.</div>
      </div>
      <form id="admin-airport-form" class="seat-section form-stack">
        <label class="field">MÃ SÂN BAY IATA (3–10 CHỮ CÁI, UNIQUE)
          <input name="code" placeholder="VD: CXR, HPH, VCA, HUI" required minlength="3" maxlength="10">
        </label>
        <label class="field">TÊN CHÍNH THỨC CỦA SÂN BAY
          <input name="name" placeholder="VD: Sân bay Quốc tế Cam Ranh" required maxlength="100">
        </label>
        <label class="field">TỈNH / THÀNH PHỐ
          <input name="city" placeholder="VD: Nha Trang" required maxlength="100">
        </label>
        <label class="field">QUỐC GIA
          <input name="country" value="Việt Nam" required maxlength="100">
        </label>
        <button class="btn primary wide" type="submit">Thêm sân bay vào hệ thống</button>
      </form>
    </aside>
  </div>`;
}

// TAB 3: QUẢN LÝ LOẠI VÉ DÀNH CHO TỪNG CHUYẾN BAY
function renderAdminFares() {
  if (state.user.role !== 'ADMIN') return requireAdminGuard();
  const schedules = state.adminFlightsData?.schedules || [];
  return `<div class="notice">
    ${icon('tag')}
    <div>
      <strong>Định giá riêng từng Loại vé cho từng Chuyến bay / Lịch bay</strong>
      Mỗi chuyến bay có 3 loại vé: <strong>Vé Hạng Thương gia (BUSINESS - hàng ghế 1A..1F)</strong>, <strong>Vé Hạng Phổ thông (ECONOMY - hàng ghế 2A..2F)</strong> và <strong>Vé Ưu đãi (FLASH SALE)</strong>. Khi cập nhật giá, hệ thống áp dụng cho các ghế <code>AVAILABLE</code> của chuyến đó (các ghế đã bán được Trigger <code>trg_prevent_double_booking</code> bảo vệ không đổi giá lịch sử).
    </div>
  </div>
  <div class="fare-cards lab-wide">
    ${schedules.map(s => `<article class="card fare-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">LỊCH BAY #${s.schedule_id} · KHỞI HÀNH ${time(s.departure_time)} ${date(s.departure_time)}</span>
          <h2>Chuyến bay ${esc(s.flight_number)}: ${esc(s.origin_code)} (${esc(s.origin_city)}) → ${esc(s.dest_code)} (${esc(s.dest_city)})</h2>
        </div>
        <span class="badge blue">${esc(s.model)}</span>
      </div>
      <form class="fare-form seat-section" data-form="update-fare" data-schedule="${s.schedule_id}">
        <div class="fare-tier business">
          <div class="tier-head">
            <strong>1. Vé Hạng Thương Gia (BUSINESS)</strong>
            <span class="badge gold">Còn ${s.business_available}/6 ghế trống</span>
          </div>
          <label class="field">GIÁ VÉ THƯƠNG GIA RIÊNG CHO CHUYẾN NÀY (VND)
            <input name="business_price" type="number" min="0" step="50000" value="${Number(s.business_price || 4500000)}" required>
          </label>
        </div>

        <div class="fare-tier economy">
          <div class="tier-head">
            <strong>2. Vé Hạng Phổ Thông (ECONOMY)</strong>
            <span class="badge green">Còn ${s.economy_available}/6 ghế trống</span>
          </div>
          <label class="field">GIÁ VÉ PHỔ THÔNG RIÊNG CHO CHUYẾN NÀY (VND)
            <input name="economy_price" type="number" min="0" step="50000" value="${Number(s.economy_price || 1850000)}" required>
          </label>
        </div>

        <div class="fare-tier flashsale">
          <div class="tier-head">
            <strong>3. Vé Ưu Đãi Flash Sale</strong>
            <span class="badge amber">${s.flash_sale_item_id ? `Đã bán ${s.sale_sold}/${s.sale_quota} suất` : 'Chưa mở Flash Sale'}</span>
          </div>
          <div class="form-grid-2">
            <label class="field">GIÁ VÉ FLASH SALE (VND)
              <input name="sale_price" type="number" min="0" step="10000" value="${s.sale_price != null ? Number(s.sale_price) : ''}" placeholder="Bỏ trống nếu không mở">
            </label>
            <label class="field">SỐ SUẤT (QUOTA 1–12)
              <input name="sale_quota" type="number" min="1" max="12" value="${s.sale_quota || 3}">
            </label>
          </div>
        </div>

        <button class="btn primary wide" type="submit">Lưu bảng giá 3 loại vé cho chuyến ${esc(s.flight_number)} (Lịch #${s.schedule_id})</button>
      </form>
    </article>`).join('')}
  </div>`;
}

// TAB 4: QUẢN LÝ NGƯỜI DÙNG & LỊCH SỬ MUA VÉ CỦA KHÁCH HÀNG (FULL-WIDTH + POPUP MODAL)
function renderAdminUsers() {
  if (state.user.role !== 'ADMIN') return requireAdminGuard();
  const allUsers = state.adminUsers || [];
  const users = allUsers.filter(u => {
    const bought = Number(u.tickets_bought || 0);
    if (state.userFilter === 'BOUGHT') return bought > 0;
    if (state.userFilter === 'NEVER') return bought === 0;
    return true;
  });
  const detail = state.selectedUserHistory;

  return `<section class="card">
    <div class="card-heading">
      <div>
        <span class="eyebrow">DANH SÁCH TÀI KHOẢN HỆ THỐNG · BẤM VÀO NGƯỜI DÙNG ĐỂ MỞ POPUP CHI TIẾT</span>
        <h2>Quản lý người dùng (${users.length}/${allUsers.length} tài khoản)</h2>
      </div>
      <div class="user-filter-pills">
        <button type="button" class="vna-chip ${state.userFilter === 'ALL' ? 'active' : ''}" data-action="filter-users" data-filter="ALL">Tất cả (${allUsers.length})</button>
        <button type="button" class="vna-chip ${state.userFilter === 'BOUGHT' ? 'active' : ''}" data-action="filter-users" data-filter="BOUGHT">Đã mua vé</button>
        <button type="button" class="vna-chip ${state.userFilter === 'NEVER' ? 'active' : ''}" data-action="filter-users" data-filter="NEVER">Chưa mua lần nào</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="flight-table">
        <thead>
          <tr>
            <th>MÃ USER</th>
            <th>TÊN ĐĂNG NHẬP &amp; EMAIL</th>
            <th>VAI TRÒ</th>
            <th>TRẠNG THÁI MUA VÉ</th>
            <th>GIỮ CHỖ ĐANG CHỜ</th>
            <th>TỔNG CHI TIÊU</th>
            <th>THAO TÁC</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
    const bought = Number(u.tickets_bought || 0);
    const activeHolds = Number(u.active_holds || 0);
    const isSelected = Number(detail?.user?.user_id) === Number(u.user_id);
    return `<tr class="${isSelected ? 'selected' : ''}" data-action="inspect-user" data-user-id="${u.user_id}">
              <td><code>#${u.user_id}</code></td>
              <td>
                <strong>${esc(u.username)}</strong>
                <small class="route-city">${esc(u.email)}</small>
              </td>
              <td><span class="badge ${u.role === 'ADMIN' ? 'gold' : 'blue'}">${u.role === 'ADMIN' ? 'QUẢN TRỊ VIÊN' : 'KHÁCH HÀNG'}</span></td>
              <td>
                ${bought > 0
        ? `<span class="badge green">Đã mua ${bought} vé</span>`
        : `<span class="badge amber">Chưa mua vé lần nào</span>`}
              </td>
              <td>${activeHolds > 0 ? `<span class="badge blue">${activeHolds} giữ chỗ</span>` : '<span class="muted">0</span>'}</td>
              <td><strong>${money(u.total_spent)}</strong></td>
              <td>
                <button type="button" class="select-flight" data-action="inspect-user" data-user-id="${u.user_id}">
                  Xem lịch sử
                </button>
              </td>
            </tr>`;
  }).join('')}
        </tbody>
      </table>
    </div>
  </section>`;
}

function renderUserHistoryModal() {
  const detail = state.selectedUserHistory;
  if (!detail || state.view !== 'admin-users') return '';
  return `<div class="seat-modal-backdrop" id="user-history-backdrop">
    <div class="card user-history-modal" role="dialog" aria-modal="true" aria-label="Hồ sơ và lịch sử mua vé khách hàng">
      <div class="seat-head">
        <div class="seat-head-top">
          <div>
            <div class="eyebrow">HỒ SƠ &amp; LỊCH SỬ KHÁCH HÀNG #${detail.user.user_id}</div>
            <h2>${esc(detail.user.username)}</h2>
          </div>
          <button type="button" class="seat-modal-close" data-action="close-user-history" title="Đóng" aria-label="Đóng">${icon('close')}</button>
        </div>
        <div class="seat-route">
          Email: ${esc(detail.user.email)} · Vai trò: ${detail.user.role === 'ADMIN' ? 'Quản trị viên' : 'Khách hàng'}
          <span class="badge ${detail.bookings.length ? 'green' : 'amber'}">${detail.bookings.length ? `ĐÃ MUA ${detail.bookings.length} VÉ` : 'CHƯA MUA VÉ LẦN NÀO'}</span>
        </div>
      </div>
      <div class="seat-section">
        <div class="user-history-status ${detail.bookings.length ? 'bought' : 'never'}">
          <strong>${detail.bookings.length
      ? `Khách hàng "${esc(detail.user.username)}" đã mua vé thành công ${detail.bookings.length} lần.`
      : `Khách hàng "${esc(detail.user.username)}" chưa từng mua vé lần nào trong lịch sử.`}</strong>
        </div>

        <h3 class="history-section-title">Lịch sử vé đã mua (${detail.bookings.length})</h3>
        ${detail.bookings.length ? `<div class="history-cards">
          ${detail.bookings.map(b => `<div class="history-ticket-item">
            <div class="history-ticket-top">
              <code>${esc(b.e_ticket_number)}</code>
              <strong>${money(b.total_amount)}</strong>
            </div>
            <div class="history-ticket-route">
              <strong>${esc(b.flight_number)}</strong> · ${esc(b.origin_code)} (${esc(b.origin_city)}) → ${esc(b.dest_code)} (${esc(b.dest_city)})
            </div>
            <div class="history-ticket-meta">
              <span>Ghế <strong>${esc(b.seat_number)}</strong> (${b.seat_class === 'BUSINESS' ? 'Thương gia' : 'Phổ thông'})</span>
              <span>${b.flash_sale_item_id ? 'Vé Flash Sale' : 'Vé tiêu chuẩn'}</span>
              <span>Ngày mua: ${date(b.created_at)}</span>
            </div>
          </div>`).join('')}
        </div>`: `<p class="help">Chưa có giao dịch mua vé nào được ghi nhận cho người dùng này.</p>`}

        <h3 class="history-section-title">Lịch sử giữ chỗ gần đây (${detail.holds.length})</h3>
        ${detail.holds.length ? `<div class="history-cards">
          ${detail.holds.map(h => `<div class="history-hold-item">
            <span><strong>${esc(h.flight_number)}</strong> (${esc(h.origin_code)}→${esc(h.dest_code)}) · Ghế ${esc(h.seat_number)}</span>
            <span class="badge ${h.status === 'CONFIRMED' ? 'green' : h.status === 'HOLDING' ? 'amber' : 'red'}">${esc(h.status)}</span>
          </div>`).join('')}
        </div>`: `<p class="help">Chưa có lịch sử giữ chỗ.</p>`}
      </div>
    </div>
  </div>`;
}

// TAB 5: CẢNH BÁO TRƯỜNG HỢP NGƯỜI DÙNG LÀM SAI (GIỐNG PHẦN SAI TRONG KIỂM THỬ NGHIỆP VỤ)
function renderAdminViolations() {
  if (state.user.role !== 'ADMIN') return requireAdminGuard();
  const list = state.adminViolations || [];
  return `${renderUserMistakeSimulatorBox()}
  <div class="card lab-wide">
    <div class="card-heading">
      <div>
        <span class="eyebrow">GIÁM SÁT VI PHẠM RÀNG BUỘC CSDL & NGHIỆP VỤ</span>
        <h2>Nhật ký các trường hợp người dùng thao tác sai (${list.length} cảnh báo)</h2>
      </div>
      ${list.length ? `<button class="btn danger sm" data-action="clear-violations">Xóa nhật ký cảnh báo</button>` : ''}
    </div>
    ${list.length ? `<div class="table-wrap">
      <table class="activity-table">
        <thead>
          <tr>
            <th>THỜI GIAN</th>
            <th>NGƯỜI DÙNG</th>
            <th>MÃ LỖI SQLSTATE</th>
            <th>KỊCH BẢN VI PHẠM (TƯƠNG ỨNG KIỂM THỬ NGHIỆP VỤ)</th>
            <th>CHI TIẾT LỖI BỊ CHẶN</th>
            <th>API</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(v => `<tr>
            <td>${time(v.time)} · ${date(v.time)}</td>
            <td><strong>${esc(v.username)}</strong> <small>(${esc(v.role)})</small></td>
            <td><span class="badge red">${esc(v.sqlstate)}</span></td>
            <td><strong>${esc(v.scenario)}</strong></td>
            <td>${esc(v.message)}</td>
            <td class="mono">${esc(v.method)} ${esc(v.path)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`: empty('shield', 'Chưa có cảnh báo thao tác sai nào', 'Khi khách hàng hoặc quản trị viên thao tác vi phạm quy tắc nghiệp vụ (hoặc khi bạn bấm các nút Mô phỏng ở khung phía trên), toàn bộ thông tin vi phạm sẽ hiển thị tại đây.')}
  </div>`;
}

function renderLab() {
  if (state.user.role !== 'ADMIN') return `<div class="card">${empty('shield', 'Cần tài khoản quản trị', 'Đăng nhập bằng admin / admin123 để chạy bộ kiểm thử và xem execution plan.')}<div class="seat-section"><p class="muted small">Bạn vẫn có thể thử đặt vé, giữ chỗ, thanh toán và hết hạn với tài khoản khách hàng.</p></div></div>`;
  const tests = state.labReport?.tests || state.lab?.diagnostics?.filter(d => d.category === 'TEST') || [];
  const integrity = state.lab?.integrity || [];
  const plans = state.labReport?.plans || state.lab?.diagnostics?.filter(d => d.category === 'PLAN') || [];
  const plan = plans.find(p => p.check_name === state.planName) || plans[0];
  return `<div class="card lab-hero"><div><span class="badge">${icon('flask')} PHÒNG LAB · DỮ LIỆU THẬT</span><h2>Chạy lại. Đọc kết quả. Kiểm chứng.</h2><p>12 tình huống được thực thi trên một PostgreSQL test tạm thời. Dữ liệu đặt vé bạn đang thao tác được giữ nguyên.</p></div><button class="btn primary" data-action="run-tests">${icon('flask')} Chạy 12 kịch bản</button></div>${state.labReport ? `<div class="lab-result" role="status">✓ Đã thực thi ${tests.length}/12 kịch bản · ${state.labReport.integrity.length} đối soát trong CSDL tạm · Dữ liệu web không thay đổi.</div>` : ''}<div class="lab-grid"><div class="card"><div class="card-heading"><h2>Kịch bản nghiệp vụ</h2><span class="badge green">${tests.filter(t => t.status === 'PASS').length}/12 PASS</span></div><div class="test-list">${tests.map((t, i) => `<div class="test-row"><span class="test-check">✓</span><div class="test-info"><strong>${String(i + 1).padStart(2, '0')}. ${esc(names[t.check_name] || t.check_name)}</strong><small>${esc(t.check_name)}</small></div><span class="badge green">${esc(t.status)}</span></div>`).join('')}</div><div class="lab-info">Test gồm giữ chỗ, giá, chủ sở hữu, quota, ngoại lệ và rollback. Tự cấp ghế chỉ kiểm tra một phiên; chưa chứng minh tranh chấp giữa nhiều phiên.</div></div><div class="card"><div class="card-heading"><h2>Toàn vẹn CSDL web</h2><span class="badge green">${integrity.filter(i => Number(i.anomaly_count) === 0).length}/8 SẠCH</span></div><div class="integrity-list">${integrity.map(i => `<div class="integrity-row"><span>${esc(integrityNames[i.check_name] || i.check_name)}</span><span class="integrity-value">${esc(i.anomaly_count)}</span></div>`).join('')}</div><div class="lab-info">Các bộ đếm này đọc trực tiếp CSDL web đang dùng. Tất cả phải bằng 0 sau thao tác thành công hoặc thất bại.</div></div></div><div class="card lab-wide"><div class="card-heading"><h2>Execution plan · 2 truy vấn trước / sau</h2><span class="muted">PostgreSQL thực thi SELECT thật</span></div><div class="plan-tabs">${plans.map(p => `<button class="plan-tab ${plan?.check_name === p.check_name ? 'active' : ''}" data-action="plan" data-plan="${esc(p.check_name)}">${esc(p.check_name.replace('_BEFORE', ' · Trước').replace('_AFTER', ' · Sau'))}</button>`).join('')}</div><pre class="plan">${esc(plan?.details || 'Chưa có execution plan.')}</pre><div class="lab-info">Baseline tắt index scan trong CSDL test. Dữ liệu mẫu nhỏ có thể vẫn chọn sequential scan; không kết luận nhanh hơn chỉ từ một lần chạy.</div></div><div class="card lab-wide"><div class="card-heading"><h2>Lịch sử thao tác phiên này</h2><button class="text-btn" data-action="export-activity">Tải JSON ↓</button></div><div class="table-wrap"><table class="activity-table"><thead><tr><th>THỜI GIAN</th><th>API</th><th>HTTP</th><th>SQLSTATE</th><th class="col-request">REQUEST</th><th>THỜI GIAN</th></tr></thead><tbody>${state.activity.length ? state.activity.map(a => `<tr><td>${time(a.time)}</td><td class="mono">${esc(a.method)} ${esc(a.path)}</td><td><span class="badge ${a.status < 400 ? 'green' : 'red'}">${a.status}</span></td><td class="mono">${esc(a.sqlstate || '—')}</td><td class="mono col-request">${esc(a.id)}</td><td>${a.ms} ms</td></tr>`).join('') : '<tr><td colspan="6">Chưa có thao tác ghi dữ liệu trong phiên này.</td></tr>'}</tbody></table></div></div>`;
}

async function loadAdminData() {
  if (state.user?.role !== 'ADMIN') return;
  const [flightsData, airportsData, usersData, violationsData] = await Promise.all([
    api('/api/admin/flights'),
    api('/api/admin/airports'),
    api('/api/admin/users'),
    api('/api/admin/violations')
  ]);
  state.adminFlightsData = flightsData;
  state.adminAirports = airportsData;
  state.adminUsers = usersData;
  state.adminViolations = violationsData;
  if (state.selectedUserHistory) {
    state.selectedUserHistory = await api(`/api/admin/users/${state.selectedUserHistory.user.user_id}/history`);
  }
}

async function refresh() {
  const [overview, airports, flights, sales, holds, tickets, passengers] = await Promise.all([
    api('/api/overview'),
    api('/api/airports'),
    api(`/api/flights?origin=${encodeURIComponent(state.origin)}&destination=${encodeURIComponent(state.destination)}`),
    api('/api/flash-sales'),
    api('/api/reservations'),
    api('/api/bookings'),
    api('/api/passengers')
  ]);
  Object.assign(state, { overview, airports, flights, sales, holds, tickets, passengers });
  if (state.user?.role === 'ADMIN') {
    state.portal = 'admin';
    if (!adminViews.includes(state.view)) state.view = 'admin-flights';
  } else {
    state.portal = 'customer';
    if (!customerViews.includes(state.view)) state.view = 'flights';
  }
  if (state.scheduleId && !flights.some(f => Number(f.schedule_id) === Number(state.scheduleId))) { state.scheduleId = null; state.seatId = null; state.saleId = null; }
  if (state.scheduleId) state.seats = await api(`/api/schedules/${state.scheduleId}/seats`);
  if (state.user?.role === 'ADMIN') {
    await loadAdminData();
    if (state.view === 'lab') await loadLab();
  }
  renderShell();
}

async function loadLab() { [state.lab, state.activity] = await Promise.all([api('/api/diagnostics'), api('/api/activity')]); }
async function chooseFlight(scheduleId, saleId = null) { state.scheduleId = Number(scheduleId); state.saleId = saleId ? Number(saleId) : null; state.seatId = null; state.portal = 'customer'; state.view = 'flights'; state.origin = ''; state.destination = ''; await refresh(); }
function updateCountdowns() { for (const node of document.querySelectorAll('[data-expires]')) { const remaining = Math.max(0, Math.ceil((new Date(node.dataset.expires) - Date.now()) / 1000)); node.textContent = remaining ? `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}` : 'Đã hết hạn · tải lại'; } }
setInterval(updateCountdowns, 1000);

document.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target, button = form.querySelector('button[type="submit"]');
  if (form.id === 'auth-form') {
    const values = Object.fromEntries(new FormData(form));
    await action(button, async () => {
      try {
        if (state.register) { await api('/api/auth/register', { body: values }); state.register = false; renderAuth(); toast('Đã tạo tài khoản. Hãy đăng nhập.'); }
        else { state.user = await api('/api/auth/login', { body: values }); state.portal = 'customer'; state.view = 'flights'; state.lastViolation = null; await refresh(); }
      } catch (error) { const box = $('#auth-error'); if (box) { box.textContent = error.message; box.classList.remove('hidden'); } else throw error; }
    });
  } else if (form.id === 'filter-form') {
    await action(button, async () => { state.origin = form.elements.origin.value; state.destination = form.elements.destination.value; await refresh(); });
  } else if (form.id === 'passenger-form') {
    const values = Object.fromEntries(new FormData(form));
    await action(button, async () => { await api('/api/passengers', { body: values }); form.reset(); await refresh(); toast('Đã lưu thông tin hành khách.'); });
  } else if (form.id === 'verify-ticket-form') {
    const values = Object.fromEntries(new FormData(form));
    await action(button, async () => { state.verifiedTicket = await api(`/api/tickets/verify/${encodeURIComponent(values.code)}`); renderShell(); toast('Đã xác thực vé điện tử.'); });
  } else if (form.id === 'admin-create-flight-form') {
    const values = Object.fromEntries(new FormData(form));
    await action(button, async () => {
      const res = await api('/api/admin/flights', { body: values });
      form.reset();
      await refresh();
      toast(`Đã tạo chuyến bay mới kèm lịch bay #${res.schedule_id} và 12 ghế.`);
    });
  } else if (form.id === 'admin-airport-form') {
    const values = Object.fromEntries(new FormData(form));
    await action(button, async () => {
      const res = await api('/api/admin/airports', { body: values });
      form.reset();
      await refresh();
      toast(`Đã thêm sân bay ${res.code} (${res.name}).`);
    });
  } else if (form.dataset.form === 'update-fare') {
    const values = Object.fromEntries(new FormData(form));
    const scheduleId = form.dataset.schedule;
    await action(button, async () => {
      await api(`/api/admin/fares/${scheduleId}`, { method: 'PUT', body: values });
      await refresh();
      toast(`Đã lưu bảng giá các loại vé cho lịch bay #${scheduleId}.`);
    });
  }
});

document.addEventListener('change', event => { if (event.target.id === 'hold-mode') { state.mode = event.target.value; $('#seat-panel').innerHTML = renderSeatPanel(); updateCountdowns(); } });

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.querySelector('.confirm-backdrop')) {
    if (state.selectedUserHistory) { state.selectedUserHistory = null; renderShell(); }
    else if (state.scheduleId) { state.scheduleId = null; state.seatId = null; state.saleId = null; renderShell(); }
  }
});

document.addEventListener('click', async event => {
  if (event.target?.id === 'seat-modal-backdrop') {
    state.scheduleId = null; state.seatId = null; state.saleId = null; renderShell();
    return;
  }
  if (event.target?.id === 'user-history-backdrop') {
    state.selectedUserHistory = null; renderShell();
    return;
  }
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const operation = button.dataset.action;
  await action(button, async () => {
    if (operation === 'toggle-auth') { state.register = !state.register; renderAuth(); }
    else if (operation === 'demo') { const username = button.dataset.user; state.user = await api('/api/auth/login', { body: { username, password: username === 'admin' ? 'admin123' : 'user123' } }); state.portal = 'customer'; state.view = 'flights'; state.lastViolation = null; await refresh(); }
    else if (operation === 'logout') { await api('/api/auth/logout', { body: {} }); state.user = null; state.register = false; state.labReport = null; state.seatId = null; state.scheduleId = null; state.verifiedTicket = null; state.lastViolation = null; state.selectedUserHistory = null; renderAuth(); }
    else if (operation === 'switch-portal') {
      state.portal = button.dataset.portal;
      if (state.portal === 'admin' && !adminViews.includes(state.view)) state.view = 'admin-flights';
      if (state.portal === 'customer' && !customerViews.includes(state.view)) state.view = 'flights';
      if (state.user?.role === 'ADMIN') await loadAdminData();
      renderShell();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    else if (operation === 'nav') {
      state.view = button.dataset.view;
      if (state.user?.role === 'ADMIN') {
        if (adminViews.includes(state.view) && state.view !== 'lab') state.portal = 'admin';
        if (customerViews.includes(state.view)) state.portal = 'customer';
        if (state.view === 'lab') await loadLab();
        await loadAdminData();
      }
      renderShell();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    else if (operation === 'dismiss-violation') { state.lastViolation = null; renderShell(); }
    else if (operation === 'sim-mistake') {
      await api('/api/simulate-violation', { body: { case_type: button.dataset.case } });
    }
    else if (operation === 'clear-violations') {
      const ok = await confirmDialog.ask({
        title: 'Xóa nhật ký cảnh báo vi phạm?',
        message: 'Toàn bộ danh sách các thao tác sai đã ghi nhận sẽ được dọn sạch.',
        yesText: 'Có, xóa nhật ký',
        noText: 'Không, giữ lại',
        tone: 'danger'
      });
      if (!ok) return;
      await api('/api/admin/violations', { method: 'DELETE' });
      state.adminViolations = [];
      state.lastViolation = null;
      renderShell();
      toast('Đã xóa nhật ký cảnh báo vi phạm.');
    }
    else if (operation === 'delete-airport') {
      const ok = await confirmDialog.ask({
        title: 'Xác nhận xóa sân bay?',
        message: 'Sân bay chưa có tuyến bay sẽ bị xóa khỏi danh mục. Nếu đã có chuyến bay, hệ thống sẽ chặn theo ràng buộc khóa ngoại.',
        yesText: 'Có, xóa sân bay',
        noText: 'Không, hủy bỏ',
        tone: 'danger'
      });
      if (!ok) return;
      await api(`/api/admin/airports/${button.dataset.id}`, { method: 'DELETE' });
      await refresh();
      toast('Đã xóa sân bay khỏi hệ thống.');
    }
    else if (operation === 'inspect-user') {
      state.selectedUserHistory = await api(`/api/admin/users/${button.dataset.userId}/history`);
      renderShell();
    }
    else if (operation === 'close-user-history') {
      state.selectedUserHistory = null;
      renderShell();
    }
    else if (operation === 'filter-users') {
      state.userFilter = button.dataset.filter || 'ALL';
      renderShell();
    }
    else if (operation === 'refresh') await refresh();
    else if (operation === 'scroll-flights') {
      if (state.view !== 'flights') { state.view = 'flights'; renderShell(); }
      $('#flight-results')?.scrollIntoView({ behavior: 'smooth' });
    }
    else if (operation === 'swap') { const orig = $('#filter-origin'), dest = $('#filter-destination');[orig.value, dest.value] = [dest.value, orig.value]; }
    else if (operation === 'quick-route') { state.origin = button.dataset.origin || ''; state.destination = button.dataset.dest || ''; await refresh(); }
    else if (operation === 'select-flight') await chooseFlight(button.dataset.schedule);
    else if (operation === 'close-seat') { state.scheduleId = null; state.seatId = null; state.saleId = null; renderShell(); }
    else if (operation === 'select-seat') { state.seatId = Number(button.dataset.seat); $('#seat-panel').innerHTML = renderSeatPanel(); updateCountdowns(); }
    else if (operation === 'sale') { const sale = state.sales.find(s => Number(s.flash_sale_item_id) === Number(button.dataset.sale)); await chooseFlight(sale.schedule_id, sale.flash_sale_item_id); toast(`Đã chọn ưu đãi ${money(sale.sale_price)}. Hãy chọn ghế để tiếp tục.`); }
    else if (operation === 'clear-sale') { state.saleId = null; $('#seat-panel').innerHTML = renderSeatPanel(); updateCountdowns(); }
    else if (operation === 'hold') {
      const seat = state.seats.find(s => Number(s.seat_id) === Number(state.seatId));
      const held = await api('/api/reservations', { body: { schedule_id: state.scheduleId, seat_number: seat?.seat_number, mode: state.mode, version: seat?.version } });
      state.seatId = Number(held.seat_id); await refresh(); toast(`Đã giữ ghế ${held.seat_number}. Bạn có 10 phút để thanh toán.`);
    } else if (operation === 'checkout' || operation === 'checkout-list') {
      const reservation = button.dataset.reservation;
      const sale = operation === 'checkout-list' ? $(`#sale-for-${reservation}`)?.value : state.saleId;
      const paid = await api(`/api/reservations/${reservation}/checkout`, { body: { sale_item_id: sale || null } });
      state.view = 'tickets'; state.seatId = null; await refresh(); toast(`Đã xuất vé ${paid.e_ticket}. Thanh toán mô phỏng thành công.`);
    } else if (operation === 'expire') {
      const ok = await confirmDialog.ask({
        title: 'Giả lập giữ chỗ hết hạn?',
        message: 'Thao tác này chỉ áp dụng cho giữ chỗ đang chờ của bạn để kiểm tra giải phóng ghế về trạng thái trống.',
        yesText: 'Có, giải phóng ghế',
        noText: 'Không, giữ tiếp',
        tone: 'warning'
      });
      if (!ok) return;
      await api(`/api/reservations/${button.dataset.reservation}/expire`, { body: {} }); state.seatId = null; await refresh(); toast('Đã giải phóng ghế. Bạn có thể giữ lại để thử tiếp.');
    } else if (operation === 'delete-passenger') {
      const ok = await confirmDialog.ask({
        title: 'Xóa hồ sơ hành khách?',
        message: 'Hồ sơ hành khách này sẽ bị xóa khỏi danh sách đã lưu của bạn.',
        yesText: 'Có, xóa hồ sơ',
        noText: 'Không, giữ lại',
        tone: 'danger'
      });
      if (!ok) return;
      await api(`/api/passengers/${button.dataset.id}`, { method: 'DELETE' }); await refresh(); toast('Đã xóa hồ sơ hành khách.');
    } else if (operation === 'inspect-ticket') {
      state.verifiedTicket = await api(`/api/tickets/verify/${encodeURIComponent(button.dataset.code)}`); renderShell();
    } else if (operation === 'clear-verify') {
      state.verifiedTicket = null; renderShell();
    } else if (operation === 'run-tests') {
      state.labReport = await api('/api/tests/run', { body: {} }); await loadLab(); renderShell(); toast('12 kịch bản đã chạy xong trên CSDL tạm.');
    } else if (operation === 'plan') { state.planName = button.dataset.plan; renderShell(); }
    else if (operation === 'export-activity') {
      const blob = new Blob([JSON.stringify(state.activity, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'flightlab-activity.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
});

(async () => { try { state.user = await api('/api/me'); await refresh(); } catch (error) { state.user = null; renderAuth(); if (error.status !== 401) toast('Chưa kết nối được máy chủ. Hãy kiểm tra web test đang chạy.', true); } })();
