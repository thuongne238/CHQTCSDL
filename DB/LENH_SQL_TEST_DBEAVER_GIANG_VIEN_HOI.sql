-- ============================================================================
-- BỘ CÂU LỆNH SQL & PL/SQL CHẠY TEST TRỰC TIẾP TRÊN DBEAVER (ORACLE 23ai)
-- Kết nối: Oracle@192.168.2.27:1521 / Service: FREEPDB1 / User: PDBADMIN
-- Hướng dẫn trong DBeaver: Bôi đen từng câu lệnh (hoặc đặt con trỏ) nhấn Ctrl+Enter
-- ============================================================================


-- ============================================================================
-- PHẦN 1: KIỂM TRA TỔNG QUAN SCHEMA, ĐỐI TƯỢNG & ĐỐI SOÁT 8 CHỈ SỐ TOÀN VẸN
-- (Chứng minh CSDL đủ 15 bảng, 3 packages, 7 triggers, 20 indexes và 0 lỗi)
-- ============================================================================

-- 1.1. Kiểm tra trạng thái toàn bộ Package, Trigger, View (Tất cả phải VALID)
SELECT object_type, object_name, status
FROM user_objects
WHERE object_type IN ('PACKAGE', 'PACKAGE BODY', 'TRIGGER', 'VIEW')
ORDER BY object_type, object_name;

-- 1.2. Kiểm tra lỗi biên dịch PL/SQL (Kết quả phải rỗng = 0 lỗi)
SELECT name, type, line, position, attribute, text
FROM user_errors
ORDER BY name, sequence;

-- 1.3. Đối soát 8 chỉ số toàn vẹn dữ liệu (Tất cả ANOMALY_COUNT phải = 0)
SELECT check_name, anomaly_count
FROM vw_project_integrity
ORDER BY check_name;

-- 1.4. Xem thống kê số lượng dữ liệu hiện có trong các bảng chính
SELECT 'USERS' AS bang, COUNT(*) AS so_dong FROM users
UNION ALL SELECT 'AIRPORTS', COUNT(*) FROM airports
UNION ALL SELECT 'AIRCRAFTS', COUNT(*) FROM aircrafts
UNION ALL SELECT 'FLIGHTS', COUNT(*) FROM flights
UNION ALL SELECT 'FLIGHT_SCHEDULES', COUNT(*) FROM flight_schedules
UNION ALL SELECT 'FLIGHT_SEATS', COUNT(*) FROM flight_seats
UNION ALL SELECT 'SEAT_RESERVATIONS', COUNT(*) FROM seat_reservations
UNION ALL SELECT 'FLASH_SALE_ITEMS', COUNT(*) FROM flash_sale_items
UNION ALL SELECT 'BOOKINGS', COUNT(*) FROM bookings
UNION ALL SELECT 'TICKETS', COUNT(*) FROM tickets
UNION ALL SELECT 'PAYMENTS', COUNT(*) FROM payments
UNION ALL SELECT 'BOOKING_LOGS', COUNT(*) FROM booking_logs;


-- ============================================================================
-- PHẦN 2: TRUY VẤN NGHIỆP VỤ (CHUYẾN BAY, SÂN BAY, GIÁ TỪNG LOẠI VÉ, LỊCH SỬ USER)
-- ============================================================================

-- 2.1. Xem danh sách sân bay và số tuyến bay đi/đến từ từng sân bay
SELECT a.airport_id, a.code, a.name, a.city, a.country,
       (SELECT COUNT(*) FROM flights f WHERE f.origin_airport_id = a.airport_id) AS chuyen_di,
       (SELECT COUNT(*) FROM flights f WHERE f.destination_airport_id = a.airport_id) AS chuyen_den
FROM airports a
ORDER BY a.code;

-- 2.2. Xem lịch bay kèm bảng giá riêng của 3 loại vé (Thương gia, Phổ thông, Flash Sale)
SELECT sch.schedule_id,
       f.flight_number,
       orig.code || ' (' || orig.city || ') -> ' || dest.code || ' (' || dest.city || ')' AS hanh_trinh,
       TO_CHAR(sch.departure_time, 'DD/MM/YYYY HH24:MI') AS gio_khoi_hanh,
       MAX(CASE WHEN s.seat_class = 'BUSINESS' THEN s.base_price END) AS gia_thuong_gia,
       MAX(CASE WHEN s.seat_class = 'ECONOMY' THEN s.base_price END) AS gia_pho_thong,
       fsi.sale_price AS gia_flash_sale,
       fsi.sold_count || '/' || fsi.quota AS tien_do_flash_sale,
       SUM(CASE WHEN s.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS ghe_trong
FROM flight_schedules sch
JOIN flights f ON f.flight_id = sch.flight_id
JOIN airports orig ON orig.airport_id = f.origin_airport_id
JOIN airports dest ON dest.airport_id = f.destination_airport_id
LEFT JOIN flight_seats s ON s.schedule_id = sch.schedule_id
LEFT JOIN flash_sale_items fsi ON fsi.schedule_id = sch.schedule_id
GROUP BY sch.schedule_id, f.flight_number, orig.code, orig.city, dest.code, dest.city,
         sch.departure_time, fsi.sale_price, fsi.sold_count, fsi.quota
ORDER BY sch.schedule_id;

-- 2.3. Kiểm tra lịch sử người dùng đã từng mua vé lần nào hay chưa
SELECT u.user_id, u.username, u.email, u.role,
       COUNT(b.booking_id) AS so_lan_mua_ve,
       CASE WHEN COUNT(b.booking_id) > 0 THEN 'DA MUA VE' ELSE 'CHUA MUA LAN NAO' END AS trang_thai_mua,
       NVL(SUM(b.total_amount), 0) AS tong_chi_tieu
FROM users u
LEFT JOIN bookings b ON b.user_id = u.user_id AND b.status = 'CONFIRMED'
GROUP BY u.user_id, u.username, u.email, u.role
ORDER BY u.user_id;

-- 2.4. Xem chi tiết toàn bộ vé điện tử đã xuất & Nhật ký Audit (booking_logs)
SELECT b.booking_id, u.username, t.e_ticket_number, f.flight_number,
       orig.code || '->' || dest.code AS chang_bay,
       s.seat_number, s.seat_class, b.total_amount, b.status,
       CASE WHEN t.flash_sale_item_id IS NOT NULL THEN 'FLASH SALE' ELSE 'GIA THUONG' END AS loai_ve
FROM bookings b
JOIN users u ON u.user_id = b.user_id
JOIN tickets t ON t.booking_id = b.booking_id
JOIN flight_seats s ON s.seat_id = t.seat_id
JOIN flight_schedules sch ON sch.schedule_id = s.schedule_id
JOIN flights f ON f.flight_id = sch.flight_id
JOIN airports orig ON orig.airport_id = f.origin_airport_id
JOIN airports dest ON dest.airport_id = f.destination_airport_id
ORDER BY b.booking_id DESC;


-- ============================================================================
-- PHẦN 3: DEMO GỌI PACKAGE ĐẶT VÉ CHUẨN (GIỮ GHẾ 10 PHÚT -> THANH TOÁN & XUẤT VÉ)
-- (Có ROLLBACK ở cuối để bạn chạy demo nhiều lần không làm bẩn dữ liệu mẫu;
--  nếu giảng viên muốn lưu thật vào DB thì đổi ROLLBACK thành COMMIT)
-- ============================================================================

-- 3.1. Demo Khóa Bi Quan (PESSIMISTIC - FOR UPDATE NOWAIT) + Checkout xuất vé
DECLARE
  v_user_id        NUMBER;
  v_schedule_id    NUMBER;
  v_reservation_id NUMBER;
  v_booking_id     NUMBER;
  v_ticket_code    VARCHAR2(50);
BEGIN
  SELECT user_id INTO v_user_id FROM users WHERE username = 'nguyenvanan';
  SELECT MAX(schedule_id) INTO v_schedule_id FROM flight_schedules;

  -- Bước 1: Giữ ghế 1F bằng khóa bi quan (PESSIMISTIC)
  pkg_flight_booking.hold_seat(
    p_schedule_id    => v_schedule_id,
    p_seat_number    => '1F',
    p_user_id        => v_user_id,
    p_mode           => 'PESSIMISTIC',
    p_client_version => NULL,
    p_reservation_id => v_reservation_id
  );

  -- Bước 2: Thanh toán và xuất vé điện tử
  pkg_flight_booking.checkout(
    p_reservation_id     => v_reservation_id,
    p_user_id            => v_user_id,
    p_flash_sale_item_id => NULL,
    p_booking_id         => v_booking_id,
    p_ticket             => v_ticket_code
  );

  DBMS_OUTPUT.PUT_LINE('Giữ chỗ ID = ' || v_reservation_id || ' | Booking ID = ' || v_booking_id || ' | Mã vé = ' || v_ticket_code);
  ROLLBACK; -- Đổi thành COMMIT nếu muốn lưu vé thật
END;
/

-- 3.2. Demo Tự động cấp ghế Phổ thông trống (FOR UPDATE SKIP LOCKED)
DECLARE
  v_user_id        NUMBER;
  v_schedule_id    NUMBER;
  v_reservation_id NUMBER;
BEGIN
  SELECT user_id INTO v_user_id FROM users WHERE username = 'nguyenvanan';
  SELECT MAX(schedule_id) INTO v_schedule_id FROM flight_schedules;

  pkg_flight_booking.hold_auto_seat(
    p_schedule_id    => v_schedule_id,
    p_user_id        => v_user_id,
    p_seat_class     => 'ECONOMY',
    p_reservation_id => v_reservation_id
  );

  DBMS_OUTPUT.PUT_LINE('Đã tự động cấp giữ chỗ ID = ' || v_reservation_id);
  ROLLBACK;
END;
/


-- ============================================================================
-- PHẦN 4: DEMO CÁC TRƯỜNG HỢP NGƯỜI DÙNG LÀM SAI (BẮT LỖI ORA-20001 .. ORA-20012)
-- (Giảng viên rất hay hỏi: "Nếu người dùng làm sai thì CSDL chặn thế nào?")
-- ============================================================================

-- 4.1. Lỗi ORA-20001: Cố tình đặt ghế ĐÃ BÁN (BOOKED)
DECLARE
  v_schedule_id NUMBER;
  v_seat_number VARCHAR2(10);
  v_user_id     NUMBER;
  v_res_id      NUMBER;
BEGIN
  SELECT user_id INTO v_user_id FROM users WHERE username = 'nguyenvanan';
  SELECT schedule_id, seat_number INTO v_schedule_id, v_seat_number
  FROM flight_seats WHERE status = 'BOOKED' FETCH FIRST 1 ROWS ONLY;

  pkg_flight_booking.hold_seat(v_schedule_id, v_seat_number, v_user_id, 'PESSIMISTIC', NULL, v_res_id);
END;
/

-- 4.2. Lỗi ORA-20003: Xung đột phiên bản Khóa Lạc Quan (OPTIMISTIC LOCKING / Stale Version)
DECLARE
  v_schedule_id NUMBER;
  v_user_id     NUMBER;
  v_res_id      NUMBER;
BEGIN
  SELECT user_id INTO v_user_id FROM users WHERE username = 'nguyenvanan';
  SELECT MAX(schedule_id) INTO v_schedule_id FROM flight_schedules;

  -- Truyền client_version = 9999 (sai lệch so với version hiện tại của ghế) -> Báo lỗi ORA-20003
  pkg_flight_booking.hold_seat(v_schedule_id, '1E', v_user_id, 'OPTIMISTIC', 9999, v_res_id);
END;
/

-- 4.3. Lỗi ORA-20005 (Trigger TRG_PREVENT_DOUBLE_BOOKING): Cố tình mở bán lại ghế ĐÃ XUẤT VÉ
UPDATE flight_seats
SET status = 'AVAILABLE'
WHERE status = 'BOOKED' AND ROWNUM = 1;

-- 4.4. Lỗi ORA-20006 (Trigger TRG_VALIDATE_FLASH_SALE_QUOTA): Vượt hạn ngạch Flash Sale
UPDATE flash_sale_items
SET sold_count = quota + 1
WHERE ROWNUM = 1;

-- 4.5. Lỗi ORA-20007 (Trigger TRG_SEAT_CAPACITY): Thêm ghế vượt quá sức chứa máy bay (12 ghế)
INSERT INTO flight_seats(schedule_id, seat_number, seat_class, base_price, status)
VALUES ((SELECT MIN(schedule_id) FROM flight_schedules), '9Z', 'ECONOMY', 1850000, 'AVAILABLE');

-- 4.6. Lỗi ORA-20010: Tài khoản B cố tình thanh toán giữ chỗ của Tài khoản A
DECLARE
  v_user_a     NUMBER;
  v_user_b     NUMBER;
  v_schedule   NUMBER;
  v_res_id     NUMBER;
  v_booking_id NUMBER;
  v_ticket     VARCHAR2(50);
BEGIN
  SELECT user_id INTO v_user_a FROM users WHERE username = 'nguyenvanan';
  SELECT user_id INTO v_user_b FROM users WHERE username = 'tranthibinh';
  SELECT MAX(schedule_id) INTO v_schedule FROM flight_schedules;

  -- User A giữ ghế 1E
  pkg_flight_booking.hold_seat(v_schedule, '1E', v_user_a, 'PESSIMISTIC', NULL, v_res_id);

  -- User B cố tình checkout giữ chỗ của User A -> Báo lỗi ORA-20010
  pkg_flight_booking.checkout(v_res_id, v_user_b, NULL, v_booking_id, v_ticket);
END;
/
ROLLBACK;


-- ============================================================================
-- PHẦN 5: CHẠY TỰ ĐỘNG 10 KỊCH BẢN SMOKE TEST & XEM EXECUTION PLAN TRƯỚC/SAU INDEX
-- ============================================================================

-- 5.1. Gọi Package tự động chạy 10 kịch bản kiểm thử nghiệp vụ (Tự rollback dữ liệu test)
DECLARE
  v_report VARCHAR2(4000);
BEGIN
  pkg_booking_diagnostics.run_smoke_tests(v_report);
  DBMS_OUTPUT.PUT_LINE(v_report);
END;
/

-- 5.2. Xem kết quả Execution Plan trước và sau khi có Index đã lưu trong PROJECT_DIAGNOSTICS
SELECT category, check_name, status, details
FROM project_diagnostics
ORDER BY diagnostic_id;

-- 5.3. Chạy trực tiếp EXPLAIN PLAN trong DBeaver để giảng viên xem bảng Plan thực tế
EXPLAIN PLAN FOR
SELECT s.schedule_id, s.departure_time, f.flight_number
FROM flight_schedules s
JOIN flights f ON f.flight_id = s.flight_id
WHERE s.departure_time >= SYSTIMESTAMP
  AND s.departure_time < SYSTIMESTAMP + INTERVAL '14' DAY
  AND f.origin_airport_id = (SELECT airport_id FROM airports WHERE code = 'SGN')
ORDER BY s.departure_time;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC +PREDICATE +COST'));


-- ============================================================================
-- PHẦN 6: DEMO TRANH CHẤP ĐỒNG THỜI 2 SESSION (MỞ 2 TAB SQL EDITOR TRONG DBEAVER)
-- ============================================================================
/*
  HƯỚNG DẪN DEMO 2 TAB SQL EDITOR CHO GIẢNG VIÊN:
  (Lưu ý trong DBeaver: tắt Auto-Commit, chuyển sang Manual Commit)

  --- [TAB SQL EDITOR 1 - SESSION A] ---
  -- Khóa dòng ghế 1D trên lịch bay lớn nhất nhưng CHƯA COMMIT:
  SELECT seat_id, seat_number, status, version
  FROM flight_seats
  WHERE schedule_id = (SELECT MAX(schedule_id) FROM flight_schedules)
    AND seat_number = '1D'
  FOR UPDATE NOWAIT;

  --- [TAB SQL EDITOR 2 - SESSION B] ---
  -- Cùng lúc đó, khách hàng ở Session B gọi hold_seat vào đúng ghế 1D:
  -- Sẽ bị từ chối NGAY LẬP TỨC với lỗi ORA-20002: "Ghe dang bi khoa, thu lai." (nhờ FOR UPDATE NOWAIT)
  DECLARE
    v_res NUMBER;
  BEGIN
    pkg_flight_booking.hold_seat(
      (SELECT MAX(schedule_id) FROM flight_schedules),
      '1D',
      (SELECT user_id FROM users WHERE username = 'tranthibinh'),
      'PESSIMISTIC', NULL, v_res
    );
  END;
  /

  -- Sau khi demo xong, quay lại TAB 1 và TAB 2 gõ:
  ROLLBACK;
*/
