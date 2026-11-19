-- ============================================================================
-- DE TAI 23 - DAT VE MAY BAY TRUC TUYEN VA FLASH SALE - ORACLE 23ai
-- FILE DUY NHAT: DE_TAI_23_DBEAVER.sql (UTF-8)
-- ============================================================================
-- CACH CHAY TREN MAY KHAC:
-- 1. Ket noi Oracle 23ai vao PDB va SCHEMA TRONG, khong dung SYS/SYSTEM.
--    User can CREATE SESSION, CREATE TABLE, CREATE PROCEDURE, CREATE TRIGGER
--    va quota tablespace. Khong can Node.js, SQL*Plus hay file SQL di kem.
-- 2. Mo file trong SQL Editor gan dung ket noi Oracle. Khong boi den mot doan.
-- 3. SQL Processing: delimiter ';'; Ignore native delimiter = OFF;
--    Blank line is statement delimiter = Never; Error handling = Stop + rollback.
--    Tat SQL parameters neu DBeaver hoi nhap NEW/OLD trong trigger (:NEW/:OLD).
-- 4. Nhan Alt+X (Execute SQL Script). Dau '/' tren dong rieng ket thuc PL/SQL.
-- 5. Xem result cuoi: CORE_CHECKS va project_diagnostics. F5 refresh schema.
-- Demo: admin/admin123; nguyenvanan/user123; tranthibinh/user123.
-- Script tao schema + indexes + packages + triggers + seed + smoke tests + plans.
-- Khong DROP/TRUNCATE, khong chay migration len du lieu cu. Chay mot lan.
-- Oracle DDL tu COMMIT; Stop+rollback KHONG hoan tac cac CREATE da thanh cong.
-- Smoke tests chay 1 session; khong thay the kiem thu dong thoi 2+ sessions.
-- Phan plan la tuy chon ve quyen: neu thieu DBMS_XPLAN/PLAN_TABLE, ghi WARN;
-- schema/nghiep vu van duoc kiem tra rieng. Khong ket luan nhanh hon khi chua do.
-- Docs DBeaver: https://dbeaver.com/docs/dbeaver/SQL-Execution/
-- ============================================================================

DECLARE
  v_existing NUMBER;
BEGIN
  IF DBMS_DB_VERSION.VERSION < 23 THEN
    RAISE_APPLICATION_ERROR(-20100, 'Requires Oracle Database 23ai or later.');
  END IF;
  IF SYS_CONTEXT('USERENV','SESSION_USER') IN ('SYS','SYSTEM') THEN
    RAISE_APPLICATION_ERROR(-20100, 'Use a dedicated application schema, not SYS/SYSTEM.');
  END IF;
  IF SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> SYS_CONTEXT('USERENV','SESSION_USER') THEN
    RAISE_APPLICATION_ERROR(-20100, 'Connect directly as the target schema owner.');
  END IF;
  SELECT COUNT(*) INTO v_existing FROM user_objects
  WHERE object_name IN ('USERS','AIRPORTS','AIRCRAFTS','FLIGHTS','FLIGHT_SCHEDULES',
    'FLIGHT_SEATS','SEAT_RESERVATIONS','FLASH_SALES','FLASH_SALE_ITEMS','PASSENGERS',
    'BOOKINGS','TICKETS','PAYMENTS','BOOKING_LOGS','PROJECT_DIAGNOSTICS');
  IF v_existing > 0 THEN
    RAISE_APPLICATION_ERROR(-20100, 'Project objects already exist. Use a fresh schema; no data was deleted.');
  END IF;
END;
/

-- =========================================================================
-- Đề tài 23: Hệ thống đặt vé máy bay trực tuyến (kèm flash sale)
-- Công nghệ: Oracle Database 23ai
-- Trọng tâm: Transactions & Concurrency Control, Isolation Levels, Locking
-- =========================================================================

-- 1. TẠO BẢNG (TABLES)
CREATE TABLE users (
    user_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR2(50) UNIQUE NOT NULL,
    email VARCHAR2(100) UNIQUE NOT NULL,
    password_hash VARCHAR2(255) NOT NULL,
    role VARCHAR2(20) DEFAULT 'USER' NOT NULL CHECK (role IN ('USER','ADMIN'))
);

CREATE TABLE airports (
    airport_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR2(10) UNIQUE NOT NULL,
    name VARCHAR2(100) NOT NULL,
    city VARCHAR2(100) NOT NULL,
    country VARCHAR2(100) NOT NULL
);

CREATE TABLE aircrafts (
    aircraft_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    model VARCHAR2(50) NOT NULL,
    capacity NUMBER NOT NULL CHECK (capacity > 0 AND capacity = TRUNC(capacity))
);

CREATE TABLE flights (
    flight_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    flight_number VARCHAR2(20) UNIQUE NOT NULL,
    aircraft_id NUMBER NOT NULL REFERENCES aircrafts(aircraft_id),
    origin_airport_id NUMBER NOT NULL REFERENCES airports(airport_id),
    destination_airport_id NUMBER NOT NULL REFERENCES airports(airport_id),
    duration INTERVAL DAY TO SECOND NOT NULL,
    CHECK (origin_airport_id <> destination_airport_id),
    CHECK (duration > INTERVAL '0' SECOND)
);

CREATE TABLE flight_schedules (
    schedule_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    flight_id NUMBER NOT NULL REFERENCES flights(flight_id),
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
    CHECK (arrival_time > departure_time)
);

CREATE TABLE flight_seats (
    seat_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id NUMBER NOT NULL REFERENCES flight_schedules(schedule_id),
    seat_number VARCHAR2(10) NOT NULL,
    seat_class VARCHAR2(20) NOT NULL,
    base_price NUMBER(10, 2) NOT NULL CHECK (base_price >= 0),
    status VARCHAR2(20) CHECK (status IN ('AVAILABLE', 'HOLD', 'BOOKED')) NOT NULL,
    version NUMBER DEFAULT 0 NOT NULL CHECK (version >= 0 AND version = TRUNC(version)),
    UNIQUE(schedule_id, seat_number),
    CONSTRAINT uq_seat_schedule UNIQUE(seat_id, schedule_id)
);

CREATE TABLE seat_reservations (
    reservation_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id NUMBER NOT NULL REFERENCES flight_schedules(schedule_id),
    seat_id NUMBER NOT NULL REFERENCES flight_seats(seat_id),
    user_id NUMBER NOT NULL REFERENCES users(user_id),
    hold_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR2(20) CHECK (status IN ('HOLDING', 'EXPIRED', 'CONFIRMED')) NOT NULL,
    quoted_price NUMBER(10,2) CHECK (quoted_price >= 0),
    CONSTRAINT fk_reservation_schedule FOREIGN KEY(seat_id,schedule_id) REFERENCES flight_seats(seat_id,schedule_id)
);

CREATE TABLE flash_sales (
    flash_sale_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR2(20) CHECK (status IN ('ACTIVE', 'INACTIVE')) NOT NULL,
    CHECK (end_time > start_time)
);

CREATE TABLE flash_sale_items (
    flash_sale_item_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    flash_sale_id NUMBER NOT NULL REFERENCES flash_sales(flash_sale_id),
    schedule_id NUMBER NOT NULL REFERENCES flight_schedules(schedule_id),
    sale_price NUMBER(10, 2) NOT NULL CHECK (sale_price >= 0),
    quota NUMBER NOT NULL CHECK (quota >= 0 AND quota = TRUNC(quota)),
    sold_count NUMBER DEFAULT 0 NOT NULL,
    version NUMBER DEFAULT 0 NOT NULL CHECK (version >= 0 AND version = TRUNC(version)),
    CHECK (sold_count >= 0 AND sold_count <= quota AND sold_count = TRUNC(sold_count)),
    UNIQUE(flash_sale_id, schedule_id)
);

CREATE TABLE passengers (
    passenger_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL REFERENCES users(user_id),
    first_name VARCHAR2(50) NOT NULL,
    last_name VARCHAR2(50) NOT NULL,
    passport_number VARCHAR2(50) UNIQUE NOT NULL
);

CREATE TABLE bookings (
    booking_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMBER(10, 2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR2(20) CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')) NOT NULL
);

CREATE TABLE tickets (
    ticket_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id NUMBER NOT NULL REFERENCES bookings(booking_id),
    seat_id NUMBER NOT NULL REFERENCES flight_seats(seat_id),
    e_ticket_number VARCHAR2(50) UNIQUE NOT NULL,
    reservation_id NUMBER UNIQUE REFERENCES seat_reservations(reservation_id),
    flash_sale_item_id NUMBER REFERENCES flash_sale_items(flash_sale_item_id),
    CONSTRAINT uq_ticket_seat UNIQUE(seat_id)
);

CREATE TABLE payments (
    payment_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id NUMBER NOT NULL REFERENCES bookings(booking_id),
    amount NUMBER(10, 2) NOT NULL CHECK (amount >= 0),
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR2(20) CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')) NOT NULL
);

-- Bảng cho Audit Trigger
CREATE TABLE booking_logs (
    log_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id NUMBER NOT NULL REFERENCES bookings(booking_id),
    old_status VARCHAR2(20),
    new_status VARCHAR2(20),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================================
-- 2. CÁC CHỈ MỤC (INDEXES)
-- =========================================================================

-- Indexes hỗ trợ tìm kiếm nhanh
CREATE INDEX idx_flight_seats_search ON flight_seats(schedule_id, status);
CREATE INDEX idx_seat_reserv_status ON seat_reservations(status, hold_expires_at);

-- Indexes trên Khóa Ngoại giúp tránh Lock Table trong các Giao dịch đồng thời
CREATE INDEX idx_flights_aircraft ON flights(aircraft_id);
-- idx_flights_route below covers origin_airport_id as its leading column.
CREATE INDEX idx_flights_dest ON flights(destination_airport_id);
CREATE INDEX idx_schedules_flight ON flight_schedules(flight_id);
CREATE INDEX idx_reservations_user ON seat_reservations(user_id);
CREATE INDEX idx_reservations_sched ON seat_reservations(schedule_id);
-- idx_res_seat_schedule and idx_bookings_history cover these FK prefixes.
CREATE INDEX idx_tickets_booking ON tickets(booking_id);
-- uq_ticket_seat already supplies the seat_id index.
CREATE INDEX idx_payments_booking ON payments(booking_id);
-- UNIQUE(flash_sale_id,schedule_id) covers flash_sale_id.
CREATE INDEX idx_flash_sale_sched ON flash_sale_items(schedule_id);
CREATE INDEX idx_passengers_user ON passengers(user_id);
CREATE INDEX idx_book_logs_booking ON booking_logs(booking_id);



-- Selective indexes for the actual API and worker predicates.
CREATE UNIQUE INDEX uq_holding_seat ON seat_reservations
  (CASE WHEN status='HOLDING' THEN seat_id END);
CREATE INDEX idx_res_seat_schedule ON seat_reservations(seat_id,schedule_id);
CREATE INDEX idx_tickets_sale ON tickets(flash_sale_item_id);
CREATE INDEX idx_schedule_departure ON flight_schedules(departure_time,flight_id);
CREATE INDEX idx_flights_route ON flights(origin_airport_id,destination_airport_id);
CREATE INDEX idx_seat_class_available ON flight_seats(schedule_id,seat_class,status,seat_id);
CREATE INDEX idx_bookings_history ON bookings(user_id,booking_id DESC);


-- 3. PACKAGES VA TRIGGERS
-- Run after tables/indexes. Caller owns COMMIT/ROLLBACK; no hidden commits.
CREATE OR REPLACE PACKAGE pkg_flight_booking AS
  PROCEDURE hold_seat(p_schedule_id NUMBER, p_seat_number VARCHAR2,
    p_user_id NUMBER, p_mode VARCHAR2, p_client_version NUMBER,
    p_reservation_id OUT NUMBER);
  PROCEDURE hold_seat_pessimistic(p_schedule_id NUMBER, p_seat_number VARCHAR2, p_user_id NUMBER);
  PROCEDURE hold_seat_optimistic(p_schedule_id NUMBER, p_seat_number VARCHAR2,
    p_user_id NUMBER, p_client_version NUMBER);
  PROCEDURE hold_auto_seat_skip_locked(p_schedule_id NUMBER, p_user_id NUMBER, p_seat_class VARCHAR2);
  PROCEDURE hold_auto_seat(p_schedule_id NUMBER,p_user_id NUMBER,p_seat_class VARCHAR2,p_reservation_id OUT NUMBER);
  PROCEDURE confirm_booking_and_pay(p_reservation_id NUMBER, p_payment_amount NUMBER);
  PROCEDURE checkout(p_reservation_id NUMBER, p_user_id NUMBER,
    p_flash_sale_item_id NUMBER, p_booking_id OUT NUMBER, p_ticket OUT VARCHAR2);
  PROCEDURE release_expired_reservations;
END pkg_flight_booking;
/
CREATE OR REPLACE PACKAGE BODY pkg_flight_booking AS
  PROCEDURE check_departure(p_schedule_id NUMBER) IS
    v_time TIMESTAMP WITH TIME ZONE;
  BEGIN
    SELECT departure_time INTO v_time FROM flight_schedules WHERE schedule_id=p_schedule_id;
    IF v_time <= SYSTIMESTAMP THEN
      RAISE_APPLICATION_ERROR(-20008, 'Chuyen bay da khoi hanh.');
    END IF;
  END;

  PROCEDURE create_hold(p_seat_id NUMBER, p_user_id NUMBER, p_reservation_id OUT NUMBER) IS
    v_schedule NUMBER;
    v_price NUMBER;
  BEGIN
    SELECT schedule_id, base_price INTO v_schedule, v_price FROM flight_seats WHERE seat_id=p_seat_id;
    check_departure(v_schedule);
    UPDATE flight_seats SET status='HOLD' WHERE seat_id=p_seat_id AND status='AVAILABLE';
    INSERT INTO seat_reservations(schedule_id,seat_id,user_id,hold_expires_at,status,quoted_price)
      VALUES(v_schedule,p_seat_id,p_user_id,SYSTIMESTAMP+INTERVAL '10' MINUTE,'HOLDING',v_price)
      RETURNING reservation_id INTO p_reservation_id;
  END;

  PROCEDURE hold_seat(p_schedule_id NUMBER, p_seat_number VARCHAR2,
    p_user_id NUMBER, p_mode VARCHAR2, p_client_version NUMBER,
    p_reservation_id OUT NUMBER) IS
    v_seat NUMBER;
    v_status VARCHAR2(20);
    v_version NUMBER;
  BEGIN
    SAVEPOINT sp_hold;
    IF p_mode IS NULL OR p_mode NOT IN ('PESSIMISTIC','OPTIMISTIC') THEN
      RAISE_APPLICATION_ERROR(-20009,'Che do khoa khong hop le.');
    END IF;
    IF p_mode='PESSIMISTIC' THEN
      SELECT seat_id,status,version INTO v_seat,v_status,v_version
        FROM flight_seats WHERE schedule_id=p_schedule_id AND seat_number=p_seat_number FOR UPDATE NOWAIT;
    ELSE
      -- Compare-and-swap UPDATE below handles changes after this unlocked read.
      SELECT seat_id,status,version INTO v_seat,v_status,v_version
        FROM flight_seats WHERE schedule_id=p_schedule_id AND seat_number=p_seat_number;
    END IF;
    IF p_mode='OPTIMISTIC' AND (p_client_version IS NULL OR p_client_version<>v_version) THEN
      RAISE_APPLICATION_ERROR(-20003,'Phien ban ghe da thay doi.');
    END IF;
    IF v_status<>'AVAILABLE' THEN RAISE_APPLICATION_ERROR(-20001,'Ghe khong con trong.'); END IF;
    IF p_mode='OPTIMISTIC' THEN
      UPDATE flight_seats SET status='HOLD'
        WHERE seat_id=v_seat AND version=p_client_version AND status='AVAILABLE';
      IF SQL%ROWCOUNT<>1 THEN RAISE_APPLICATION_ERROR(-20003,'Xung dot phien ban.'); END IF;
    END IF;
    create_hold(v_seat,p_user_id,p_reservation_id);
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      ROLLBACK TO sp_hold;
      RAISE_APPLICATION_ERROR(-20001,'Khong tim thay ghe.');
    WHEN OTHERS THEN
      ROLLBACK TO sp_hold;
      IF SQLCODE=-54 THEN RAISE_APPLICATION_ERROR(-20002,'Ghe dang bi khoa, thu lai.'); END IF;
      RAISE;
  END;

  PROCEDURE hold_seat_pessimistic(p_schedule_id NUMBER,p_seat_number VARCHAR2,p_user_id NUMBER) IS v_id NUMBER;
  BEGIN hold_seat(p_schedule_id,p_seat_number,p_user_id,'PESSIMISTIC',NULL,v_id); END;
  PROCEDURE hold_seat_optimistic(p_schedule_id NUMBER,p_seat_number VARCHAR2,p_user_id NUMBER,p_client_version NUMBER) IS v_id NUMBER;
  BEGIN hold_seat(p_schedule_id,p_seat_number,p_user_id,'OPTIMISTIC',p_client_version,v_id); END;

  PROCEDURE hold_auto_seat(p_schedule_id NUMBER,p_user_id NUMBER,p_seat_class VARCHAR2,p_reservation_id OUT NUMBER) IS
    -- Explicit single FETCH avoids combining row limiting with FOR UPDATE.
    CURSOR c_seats IS SELECT seat_id FROM flight_seats
      WHERE schedule_id=p_schedule_id AND seat_class=p_seat_class AND status='AVAILABLE'
      ORDER BY seat_id FOR UPDATE SKIP LOCKED;
    v_seat NUMBER;
  BEGIN
    SAVEPOINT sp_auto;
    OPEN c_seats;
    FETCH c_seats INTO v_seat;
    IF c_seats%NOTFOUND THEN
      CLOSE c_seats;
      RAISE_APPLICATION_ERROR(-20001,'Khong co ghe trong hoac ghe dang bi khoa.');
    END IF;
    CLOSE c_seats;
    create_hold(v_seat,p_user_id,p_reservation_id);
  EXCEPTION WHEN OTHERS THEN
    IF c_seats%ISOPEN THEN CLOSE c_seats; END IF;
    ROLLBACK TO sp_auto; RAISE;
  END;

  PROCEDURE hold_auto_seat_skip_locked(p_schedule_id NUMBER,p_user_id NUMBER,p_seat_class VARCHAR2) IS
    v_id NUMBER;
  BEGIN hold_auto_seat(p_schedule_id,p_user_id,p_seat_class,v_id); END;

  PROCEDURE complete_reservation(p_reservation_id NUMBER,p_user_id NUMBER,
    p_sale_id NUMBER,p_amount NUMBER,p_booking_id OUT NUMBER,p_ticket OUT VARCHAR2) IS
    v_seat NUMBER; v_owner NUMBER; v_schedule NUMBER; v_price NUMBER;
    v_state VARCHAR2(20); v_seat_state VARCHAR2(20);
    v_expiry TIMESTAMP WITH TIME ZONE; v_sale NUMBER;
    v_start TIMESTAMP WITH TIME ZONE; v_end TIMESTAMP WITH TIME ZONE; v_active VARCHAR2(20);
  BEGIN
    SAVEPOINT sp_confirm;
    SELECT seat_id INTO v_seat FROM seat_reservations WHERE reservation_id=p_reservation_id;
    -- Same order as expiry worker: seat -> reservation -> sale item -> sale.
    SELECT status INTO v_seat_state FROM flight_seats WHERE seat_id=v_seat FOR UPDATE NOWAIT;
    SELECT user_id,schedule_id,status,hold_expires_at,quoted_price
      INTO v_owner,v_schedule,v_state,v_expiry,v_price
      FROM seat_reservations WHERE reservation_id=p_reservation_id FOR UPDATE NOWAIT;
    IF p_user_id IS NOT NULL AND p_user_id<>v_owner THEN
      RAISE_APPLICATION_ERROR(-20010,'Giu cho khong thuoc tai khoan nay.');
    END IF;
    IF v_state<>'HOLDING' OR v_expiry<=SYSTIMESTAMP OR v_seat_state<>'HOLD' THEN
      RAISE_APPLICATION_ERROR(-20004,'Giu cho da het han hoac da xu ly.');
    END IF;
    check_departure(v_schedule);
    IF v_price IS NULL THEN RAISE_APPLICATION_ERROR(-20009,'Giu cho cu thieu gia, vui long dat lai.'); END IF;
    IF p_sale_id IS NOT NULL THEN
      SELECT flash_sale_id,sale_price INTO v_sale,v_price FROM flash_sale_items
        WHERE flash_sale_item_id=p_sale_id AND schedule_id=v_schedule FOR UPDATE NOWAIT;
      SELECT start_time,end_time,status INTO v_start,v_end,v_active FROM flash_sales
        WHERE flash_sale_id=v_sale FOR UPDATE NOWAIT;
      IF v_active<>'ACTIVE' OR v_start>SYSTIMESTAMP OR v_end<=SYSTIMESTAMP THEN
        RAISE_APPLICATION_ERROR(-20011,'Flash sale chua bat dau hoac da ket thuc.');
      END IF;
      UPDATE flash_sale_items SET sold_count=sold_count+1,version=version+1
        WHERE flash_sale_item_id=p_sale_id AND sold_count<quota;
      IF SQL%ROWCOUNT<>1 THEN RAISE_APPLICATION_ERROR(-20006,'Flash sale da het han ngach.'); END IF;
    END IF;
    IF p_amount IS NOT NULL AND p_amount<>v_price THEN
      RAISE_APPLICATION_ERROR(-20012,'So tien thanh toan khong dung.');
    END IF;
    INSERT INTO bookings(user_id,total_amount,status) VALUES(v_owner,v_price,'PENDING')
      RETURNING booking_id INTO p_booking_id;
    p_ticket := 'ETKT-' || TO_CHAR(p_booking_id,'FM99999999999999999999');
    INSERT INTO tickets(booking_id,seat_id,e_ticket_number,reservation_id,flash_sale_item_id)
      VALUES(p_booking_id,v_seat,p_ticket,p_reservation_id,p_sale_id);
    INSERT INTO payments(booking_id,amount,status) VALUES(p_booking_id,v_price,'COMPLETED');
    UPDATE seat_reservations SET status='CONFIRMED' WHERE reservation_id=p_reservation_id;
    UPDATE flight_seats SET status='BOOKED' WHERE seat_id=v_seat;
    UPDATE bookings SET status='CONFIRMED' WHERE booking_id=p_booking_id;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      ROLLBACK TO sp_confirm; RAISE_APPLICATION_ERROR(-20004,'Khong tim thay giu cho hoac flash sale.');
    WHEN OTHERS THEN
      ROLLBACK TO sp_confirm;
      IF SQLCODE=-54 THEN RAISE_APPLICATION_ERROR(-20002,'Giao dich dang bi khoa, thu lai.'); END IF;
      RAISE;
  END;
  PROCEDURE confirm_booking_and_pay(p_reservation_id NUMBER,p_payment_amount NUMBER) IS
    v_id NUMBER; v_ticket VARCHAR2(50);
  BEGIN
    IF p_payment_amount IS NULL OR p_payment_amount<0 THEN
      RAISE_APPLICATION_ERROR(-20012,'So tien khong hop le.');
    END IF;
    complete_reservation(p_reservation_id,NULL,NULL,p_payment_amount,v_id,v_ticket);
  END;
  PROCEDURE checkout(p_reservation_id NUMBER,p_user_id NUMBER,p_flash_sale_item_id NUMBER,
    p_booking_id OUT NUMBER,p_ticket OUT VARCHAR2) IS
  BEGIN
    IF p_user_id IS NULL THEN RAISE_APPLICATION_ERROR(-20010,'Thieu tai khoan.'); END IF;
    complete_reservation(p_reservation_id,p_user_id,p_flash_sale_item_id,NULL,p_booking_id,p_ticket);
  END;

  PROCEDURE release_expired_reservations IS
    CURSOR c_expired IS SELECT s.seat_id FROM flight_seats s WHERE s.status='HOLD'
      AND EXISTS(SELECT 1 FROM seat_reservations r WHERE r.seat_id=s.seat_id
        AND r.status='HOLDING' AND r.hold_expires_at<=SYSTIMESTAMP)
      ORDER BY s.seat_id FOR UPDATE SKIP LOCKED;
  BEGIN
    SAVEPOINT sp_expire;
    FOR r IN c_expired LOOP
      UPDATE seat_reservations SET status='EXPIRED' WHERE seat_id=r.seat_id
        AND status='HOLDING' AND hold_expires_at<=SYSTIMESTAMP;
      IF SQL%ROWCOUNT>0 THEN
        UPDATE flight_seats SET status='AVAILABLE' WHERE seat_id=r.seat_id AND status='HOLD';
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN ROLLBACK TO sp_expire; RAISE;
  END;
END pkg_flight_booking;
/

-- Compatibility name for the report; all logic has one implementation.
CREATE OR REPLACE PACKAGE pkg_airline_booking AS
  PROCEDURE hold_auto_seat_skip_locked(p_schedule_id NUMBER,p_user_id NUMBER,p_seat_class VARCHAR2);
  PROCEDURE confirm_booking_and_pay(p_reservation_id NUMBER,p_payment_amount NUMBER);
  PROCEDURE release_expired_reservations;
END pkg_airline_booking;
/
CREATE OR REPLACE PACKAGE BODY pkg_airline_booking AS
  PROCEDURE hold_auto_seat_skip_locked(p_schedule_id NUMBER,p_user_id NUMBER,p_seat_class VARCHAR2) IS
  BEGIN pkg_flight_booking.hold_auto_seat_skip_locked(p_schedule_id,p_user_id,p_seat_class); END;
  PROCEDURE confirm_booking_and_pay(p_reservation_id NUMBER,p_payment_amount NUMBER) IS
  BEGIN pkg_flight_booking.confirm_booking_and_pay(p_reservation_id,p_payment_amount); END;
  PROCEDURE release_expired_reservations IS
  BEGIN pkg_flight_booking.release_expired_reservations; END;
END pkg_airline_booking;
/

CREATE OR REPLACE TRIGGER trg_prevent_double_booking
BEFORE UPDATE ON flight_seats FOR EACH ROW
BEGIN
  :NEW.version := :OLD.version+1;
  IF :OLD.status='BOOKED' AND :NEW.status<>'BOOKED' THEN
    RAISE_APPLICATION_ERROR(-20005,'Khong the mo lai ghe da xuat ve.');
  END IF;
  IF :OLD.status IN ('HOLD','BOOKED') AND
    (:NEW.schedule_id<>:OLD.schedule_id OR :NEW.seat_number<>:OLD.seat_number
     OR :NEW.base_price<>:OLD.base_price OR :NEW.seat_class<>:OLD.seat_class) THEN
    RAISE_APPLICATION_ERROR(-20005,'Khong duoc sua ghe dang giu hoac da ban.');
  END IF;
END;
/
CREATE OR REPLACE TRIGGER trg_validate_flash_sale_quota
BEFORE INSERT OR UPDATE ON flash_sale_items FOR EACH ROW
BEGIN
  IF :NEW.sold_count<0 OR :NEW.sold_count>:NEW.quota THEN
    RAISE_APPLICATION_ERROR(-20006,'Han ngach flash sale khong hop le.');
  END IF;
END;
/
CREATE OR REPLACE TRIGGER trg_audit_booking_status
AFTER UPDATE OF status ON bookings FOR EACH ROW
BEGIN
  IF :OLD.status<>:NEW.status THEN
    INSERT INTO booking_logs(booking_id,old_status,new_status)
      VALUES(:NEW.booking_id,:OLD.status,:NEW.status);
  END IF;
END;
/
-- Capacity applies to the inventory of each schedule, not bookings across the system.
CREATE OR REPLACE TRIGGER trg_seat_capacity
FOR INSERT OR UPDATE OF schedule_id ON flight_seats COMPOUND TRIGGER
  TYPE t_ids IS TABLE OF NUMBER INDEX BY PLS_INTEGER;
  v_ids t_ids; v_n PLS_INTEGER:=0;
  BEFORE EACH ROW IS v_dummy NUMBER; v_aircraft NUMBER;
  BEGIN
    SELECT schedule_id INTO v_dummy FROM flight_schedules
      WHERE schedule_id=:NEW.schedule_id FOR UPDATE NOWAIT;
    SELECT f.aircraft_id INTO v_aircraft FROM flights f
      WHERE f.flight_id=(SELECT flight_id FROM flight_schedules WHERE schedule_id=:NEW.schedule_id)
      FOR UPDATE NOWAIT;
    SELECT aircraft_id INTO v_dummy FROM aircrafts WHERE aircraft_id=v_aircraft FOR UPDATE NOWAIT;
    v_n:=v_n+1; v_ids(v_n):=:NEW.schedule_id;
  END BEFORE EACH ROW;
  AFTER STATEMENT IS v_count NUMBER; v_capacity NUMBER;
  BEGIN
    FOR i IN 1..v_n LOOP
      SELECT a.capacity INTO v_capacity FROM flight_schedules s
        JOIN flights f ON f.flight_id=s.flight_id JOIN aircrafts a ON a.aircraft_id=f.aircraft_id
        WHERE s.schedule_id=v_ids(i);
      SELECT COUNT(*) INTO v_count FROM flight_seats WHERE schedule_id=v_ids(i);
      IF v_count>v_capacity THEN RAISE_APPLICATION_ERROR(-20007,'So ghe vuot suc chua lich bay.'); END IF;
    END LOOP;
  END AFTER STATEMENT;
END;
/
CREATE OR REPLACE TRIGGER trg_aircraft_capacity_change
BEFORE UPDATE OF capacity ON aircrafts FOR EACH ROW
DECLARE v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM (
    SELECT s.schedule_id FROM flight_schedules s JOIN flights f ON f.flight_id=s.flight_id
      JOIN flight_seats seats ON seats.schedule_id=s.schedule_id
      WHERE f.aircraft_id=:OLD.aircraft_id GROUP BY s.schedule_id
      HAVING COUNT(*)>:NEW.capacity
  );
  IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20007,'Suc chua moi nho hon so ghe da tao.'); END IF;
END;
/
CREATE OR REPLACE TRIGGER trg_flight_aircraft_change
BEFORE UPDATE OF aircraft_id ON flights FOR EACH ROW
DECLARE v_count NUMBER;
BEGIN
  IF :NEW.aircraft_id<>:OLD.aircraft_id THEN
    SELECT COUNT(*) INTO v_count FROM flight_seats seats JOIN flight_schedules s ON s.schedule_id=seats.schedule_id
      WHERE s.flight_id=:OLD.flight_id;
    IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20007,'Chuyen bay da co so do ghe, khong the doi may bay.'); END IF;
  END IF;
END;
/
CREATE OR REPLACE TRIGGER trg_schedule_flight_change
BEFORE UPDATE OF flight_id ON flight_schedules FOR EACH ROW
DECLARE v_count NUMBER;
BEGIN
  IF :NEW.flight_id<>:OLD.flight_id THEN
    SELECT COUNT(*) INTO v_count FROM flight_seats WHERE schedule_id=:OLD.schedule_id;
    IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20007,'Lich bay da co so do ghe, khong the doi chuyen bay.'); END IF;
  END IF;
END;
/
SELECT name,type,line,position,text FROM user_errors
WHERE name IN ('PKG_FLIGHT_BOOKING','PKG_AIRLINE_BOOKING','TRG_PREVENT_DOUBLE_BOOKING',
  'TRG_VALIDATE_FLASH_SALE_QUOTA','TRG_AUDIT_BOOKING_STATUS','TRG_SEAT_CAPACITY',
  'TRG_AIRCRAFT_CAPACITY_CHANGE','TRG_FLIGHT_AIRCRAFT_CHANGE','TRG_SCHEDULE_FLIGHT_CHANGE')
ORDER BY name,sequence;
DECLARE v_errors NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_errors FROM user_errors
    WHERE attribute='ERROR' AND name IN ('PKG_FLIGHT_BOOKING','PKG_AIRLINE_BOOKING','TRG_PREVENT_DOUBLE_BOOKING',
      'TRG_VALIDATE_FLASH_SALE_QUOTA','TRG_AUDIT_BOOKING_STATUS','TRG_SEAT_CAPACITY',
      'TRG_AIRCRAFT_CAPACITY_CHANGE','TRG_FLIGHT_AIRCRAFT_CHANGE','TRG_SCHEDULE_FLIGHT_CHANGE');
  IF v_errors>0 THEN RAISE_APPLICATION_ERROR(-20199,'Compilation errors: inspect USER_ERRORS output.'); END IF;
END;
/

-- Called by the Oracle web admin; creates only uncommitted test fixtures.
-- No DDL/COMMIT. All fixture business rows roll back; identity sequences may advance.
CREATE OR REPLACE PACKAGE pkg_booking_diagnostics AS
  PROCEDURE run_smoke_tests(p_report OUT VARCHAR2);
END pkg_booking_diagnostics;
/
CREATE OR REPLACE PACKAGE BODY pkg_booking_diagnostics AS
  PROCEDURE run_smoke_tests(p_report OUT VARCHAR2) IS
  v_user NUMBER; v_other NUMBER; v_schedule NUMBER; v_wrong_schedule NUMBER;
  v_item NUMBER; v_sale NUMBER; v_aircraft NUMBER;
  v_reservation NUMBER; v_booking NUMBER; v_seat NUMBER; v_ticket VARCHAR2(50);
  v_count NUMBER; v_amount NUMBER; v_version NUMBER; v_status VARCHAR2(20);
  v_test_count PLS_INTEGER:=0;
  v_tag VARCHAR2(32); v_origin NUMBER; v_dest NUMBER; v_flight NUMBER;
  PROCEDURE check_true(p_ok BOOLEAN,p_message VARCHAR2) IS
  BEGIN
    IF p_ok IS NULL OR NOT p_ok THEN RAISE_APPLICATION_ERROR(-20200,p_message); END IF;
  END;
  BEGIN

    SAVEPOINT sp_web_diag;
    v_tag:=RAWTOHEX(SYS_GUID());
    INSERT INTO users(username,email,password_hash) VALUES('diag_'||v_tag,v_tag||'@test.invalid','diagnostic-only') RETURNING user_id INTO v_user;
    INSERT INTO users(username,email,password_hash) VALUES('diag2_'||v_tag,'b'||v_tag||'@test.invalid','diagnostic-only') RETURNING user_id INTO v_other;
    INSERT INTO airports(code,name,city,country) VALUES('T'||SUBSTR(v_tag,1,8),'test','test','test') RETURNING airport_id INTO v_origin;
    INSERT INTO airports(code,name,city,country) VALUES('T'||SUBSTR(v_tag,9,8),'test','test','test') RETURNING airport_id INTO v_dest;
    INSERT INTO aircrafts(model,capacity) VALUES('web diagnostics',12) RETURNING aircraft_id INTO v_aircraft;
    INSERT INTO flights(flight_number,aircraft_id,origin_airport_id,destination_airport_id,duration)
      VALUES('T'||SUBSTR(v_tag,1,18),v_aircraft,v_origin,v_dest,INTERVAL '1' HOUR) RETURNING flight_id INTO v_flight;
    INSERT INTO flight_schedules(flight_id,departure_time,arrival_time) VALUES(v_flight,SYSTIMESTAMP+INTERVAL '10' DAY,SYSTIMESTAMP+INTERVAL '10' DAY+INTERVAL '1' HOUR) RETURNING schedule_id INTO v_schedule;
    INSERT INTO flight_schedules(flight_id,departure_time,arrival_time) VALUES(v_flight,SYSTIMESTAMP+INTERVAL '11' DAY,SYSTIMESTAMP+INTERVAL '11' DAY+INTERVAL '1' HOUR) RETURNING schedule_id INTO v_wrong_schedule;
    FOR row_num IN 1..2 LOOP
      FOR col_num IN 1..6 LOOP
        INSERT INTO flight_seats(schedule_id,seat_number,seat_class,base_price,status)
          VALUES(v_schedule,TO_CHAR(row_num,'FM9')||SUBSTR('ABCDEF',col_num,1),'ECONOMY',1850000,'AVAILABLE');
      END LOOP;
    END LOOP;
    INSERT INTO flash_sales(start_time,end_time,status) VALUES(SYSTIMESTAMP-INTERVAL '1' HOUR,SYSTIMESTAMP+INTERVAL '1' DAY,'ACTIVE') RETURNING flash_sale_id INTO v_sale;
    INSERT INTO flash_sale_items(flash_sale_id,schedule_id,sale_price,quota) VALUES(v_sale,v_schedule,99000,3) RETURNING flash_sale_item_id INTO v_item;
    SELECT seat_id,version INTO v_seat,v_version FROM flight_seats WHERE schedule_id=v_schedule AND seat_number='2F';
    SAVEPOINT sp_smoke;
  -- T01: hold -> checkout, exact owner, amount, payment, audit, version.
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
  pkg_flight_booking.checkout(v_reservation,v_user,NULL,v_booking,v_ticket);
  SELECT COUNT(*) INTO v_count FROM tickets WHERE booking_id=v_booking AND seat_id=v_seat AND reservation_id=v_reservation;
  check_true(v_count=1,'T01: missing or duplicate ticket');
  SELECT COUNT(*) INTO v_count FROM payments WHERE booking_id=v_booking AND amount=1850000 AND status='COMPLETED';
  check_true(v_count=1,'T01: invalid payment');
  SELECT COUNT(*) INTO v_count FROM booking_logs WHERE booking_id=v_booking AND new_status='CONFIRMED';
  check_true(v_count=1,'T01: missing audit');
  SELECT version INTO v_count FROM flight_seats WHERE seat_id=v_seat;
  check_true(v_count=v_version+2,'T01: seat version must increment on hold and checkout');
  BEGIN
    pkg_flight_booking.checkout(v_reservation,v_user,NULL,v_booking,v_ticket);
    RAISE_APPLICATION_ERROR(-20200,'T01: repeated checkout accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20004 THEN RAISE; END IF; END;
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T02: stale optimistic version, then a valid CAS.
  BEGIN
    pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'OPTIMISTIC',v_version+100,v_reservation);
    RAISE_APPLICATION_ERROR(-20200,'T02: stale version accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20003 THEN RAISE; END IF; END;
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'OPTIMISTIC',v_version,v_reservation);
  SELECT status INTO v_status FROM flight_seats WHERE seat_id=v_seat;
  check_true(v_status='HOLD','T02: valid optimistic hold failed');
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T03: wrong owner and wrong amount do not consume the reservation.
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
  BEGIN
    pkg_flight_booking.checkout(v_reservation,v_other,NULL,v_booking,v_ticket);
    RAISE_APPLICATION_ERROR(-20200,'T03: wrong owner accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20010 THEN RAISE; END IF; END;
  BEGIN
    pkg_flight_booking.confirm_booking_and_pay(v_reservation,1);
    RAISE_APPLICATION_ERROR(-20200,'T03: wrong amount accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20012 THEN RAISE; END IF; END;
  SELECT status INTO v_status FROM seat_reservations WHERE reservation_id=v_reservation;
  check_true(v_status='HOLDING','T03: failed payment changed reservation');
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T04: expiry rejects checkout and releases only expired holds.
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
  UPDATE seat_reservations SET hold_expires_at=SYSTIMESTAMP-INTERVAL '1' MINUTE WHERE reservation_id=v_reservation;
  BEGIN
    pkg_flight_booking.checkout(v_reservation,v_user,NULL,v_booking,v_ticket);
    RAISE_APPLICATION_ERROR(-20200,'T04: expired hold accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20004 THEN RAISE; END IF; END;
  pkg_flight_booking.release_expired_reservations;
  SELECT status INTO v_status FROM flight_seats WHERE seat_id=v_seat;
  check_true(v_status='AVAILABLE','T04: expired seat not released');
  SELECT status INTO v_status FROM seat_reservations WHERE reservation_id=v_reservation;
  check_true(v_status='EXPIRED','T04: reservation not expired');
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T05: exact final sale quota, including a zero-priced ticket.
  UPDATE flash_sale_items SET quota=sold_count+1,sale_price=0 WHERE flash_sale_item_id=v_item;
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
  pkg_flight_booking.checkout(v_reservation,v_user,v_item,v_booking,v_ticket);
  SELECT total_amount INTO v_amount FROM bookings WHERE booking_id=v_booking;
  check_true(v_amount=0,'T05: zero-priced sale lost');
  pkg_flight_booking.hold_seat(v_schedule,'2E',v_user,'PESSIMISTIC',NULL,v_reservation);
  BEGIN
    pkg_flight_booking.checkout(v_reservation,v_user,v_item,v_booking,v_ticket);
    RAISE_APPLICATION_ERROR(-20200,'T05: quota exceeded');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20006 THEN RAISE; END IF; END;
  SELECT quota-sold_count INTO v_count FROM flash_sale_items WHERE flash_sale_item_id=v_item;
  check_true(v_count=0,'T05: quota changed after failed checkout');
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T06: not-yet-started sale.
  UPDATE flash_sales SET start_time=SYSTIMESTAMP+INTERVAL '1' HOUR WHERE flash_sale_id=v_sale;
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
  BEGIN
    pkg_flight_booking.checkout(v_reservation,v_user,v_item,v_booking,v_ticket);
    RAISE_APPLICATION_ERROR(-20200,'T06: future sale accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20011 THEN RAISE; END IF; END;
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T07: departed schedule.
  UPDATE flight_schedules SET departure_time=SYSTIMESTAMP-INTERVAL '2' HOUR,
    arrival_time=SYSTIMESTAMP-INTERVAL '1' HOUR WHERE schedule_id=v_schedule;
  BEGIN
    pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
    RAISE_APPLICATION_ERROR(-20200,'T07: departed flight accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20008 THEN RAISE; END IF; END;
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T08: capacity and mismatched reservation schedule.
  BEGIN
    INSERT INTO flight_seats(schedule_id,seat_number,seat_class,base_price,status)
      VALUES(v_schedule,'3A','ECONOMY',1,'AVAILABLE');
    RAISE_APPLICATION_ERROR(-20200,'T08: inventory exceeded capacity');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20007 THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO seat_reservations(schedule_id,seat_id,user_id,hold_expires_at,status)
      VALUES(v_wrong_schedule,v_seat,v_user,SYSTIMESTAMP+INTERVAL '10' MINUTE,'HOLDING');
    RAISE_APPLICATION_ERROR(-20200,'T08: mismatched schedule accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-2291 THEN RAISE; END IF; END;
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T09: unique ticket per seat and no reopening a paid seat.
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
  pkg_flight_booking.checkout(v_reservation,v_user,NULL,v_booking,v_ticket);
  BEGIN
    INSERT INTO tickets(booking_id,seat_id,e_ticket_number) VALUES(v_booking,v_seat,'SMOKE-'||RAWTOHEX(SYS_GUID()));
    RAISE_APPLICATION_ERROR(-20200,'T09: duplicate ticket accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-1 THEN RAISE; END IF; END;
  BEGIN
    UPDATE flight_seats SET status='AVAILABLE' WHERE seat_id=v_seat;
    RAISE_APPLICATION_ERROR(-20200,'T09: reopening paid seat accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20005 THEN RAISE; END IF; END;
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T10: unavailable user rolls back the preceding seat update.
  BEGIN
    pkg_flight_booking.hold_seat(v_schedule,'2F',-1,'PESSIMISTIC',NULL,v_reservation);
    RAISE_APPLICATION_ERROR(-20200,'T10: invalid user accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-2291 THEN RAISE; END IF; END;
  SELECT status INTO v_status FROM flight_seats WHERE seat_id=v_seat;
  check_true(v_status='AVAILABLE','T10: failed hold left partial seat update');
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;


    check_true(v_test_count=10,'Diagnostic case count mismatch');
    ROLLBACK TO sp_web_diag;
    p_report := '{"passed":10,"cases":[{"name":"ATOMIC_CHECKOUT","status":"PASS"},{"name":"OPTIMISTIC_CAS","status":"PASS"},{"name":"OWNER_AND_AMOUNT","status":"PASS"},{"name":"EXPIRED_HOLD","status":"PASS"},{"name":"FINAL_QUOTA_AND_FREE_TICKET","status":"PASS"},{"name":"SALE_TIME_WINDOW","status":"PASS"},{"name":"DEPARTED_FLIGHT","status":"PASS"},{"name":"CAPACITY_AND_FK","status":"PASS"},{"name":"UNIQUE_TICKET_AND_REOPEN","status":"PASS"},{"name":"INVALID_USER_ROLLBACK","status":"PASS"}],"isolated":true,"concurrencyTested":false}';
  EXCEPTION WHEN OTHERS THEN
    ROLLBACK TO sp_web_diag;
    RAISE;
  END;
END pkg_booking_diagnostics;
/
SELECT name,type,line,position,text FROM user_errors WHERE name='PKG_BOOKING_DIAGNOSTICS' ORDER BY sequence;
DECLARE v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_errors WHERE name='PKG_BOOKING_DIAGNOSTICS' AND attribute='ERROR';
  IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20199,'PKG_BOOKING_DIAGNOSTICS failed to compile. Inspect USER_ERRORS.'); END IF;
END;
/


-- ============================================================================
-- 4. DU LIEU MAU - ID SINH TU DONG, KHONG GIA DINH ID BAT DAU TU 1
-- 14 bang nghiep vu + 1 bang luu ket qua kiem tra/plan.
-- ============================================================================
CREATE TABLE project_diagnostics (
  diagnostic_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category VARCHAR2(20) NOT NULL,
  check_name VARCHAR2(100) NOT NULL,
  status VARCHAR2(10) NOT NULL CHECK(status IN ('PASS','INFO','WARN','FAIL')),
  details CLOB,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);

DECLARE
  v_admin NUMBER; v_user NUMBER; v_user2 NUMBER;
  v_sgn NUMBER; v_han NUMBER; v_dad NUMBER; v_pqc NUMBER;
  v_aircraft NUMBER; v_flight NUMBER; v_schedule NUMBER; v_sale NUMBER;
  v_reservation NUMBER; v_booking NUMBER; v_ticket VARCHAR2(50);
  TYPE t_ids IS TABLE OF NUMBER INDEX BY PLS_INTEGER;
  v_schedules t_ids; v_items t_ids;
  v_letters VARCHAR2(6) := 'ABCDEF';
  v_origin NUMBER; v_dest NUMBER; v_flight_number VARCHAR2(20);
BEGIN
  SAVEPOINT sp_seed;
  INSERT INTO users(username,email,password_hash,role)
    VALUES('admin','admin@airline.test',
      '$2b$10$MmgaWpQlr1mNcecDFFg27uze0Dl7ZTrj0HXYIPu.SQUQ/zrJx4NL6','ADMIN')
    RETURNING user_id INTO v_admin;
  INSERT INTO users(username,email,password_hash,role)
    VALUES('nguyenvanan','an@airline.test',
      '$2b$10$s0QNs/u9qmYHufLvj3wG5erHk9NlGG/9K15FRpHTWffOvG9LrkjAG','USER')
    RETURNING user_id INTO v_user;
  INSERT INTO users(username,email,password_hash,role)
    VALUES('tranthibinh','binh@airline.test',
      '$2b$10$s0QNs/u9qmYHufLvj3wG5erHk9NlGG/9K15FRpHTWffOvG9LrkjAG','USER')
    RETURNING user_id INTO v_user2;
  INSERT INTO airports(code,name,city,country) VALUES('SGN','Tan Son Nhat','TP. Ho Chi Minh','Viet Nam') RETURNING airport_id INTO v_sgn;
  INSERT INTO airports(code,name,city,country) VALUES('HAN','Noi Bai','Ha Noi','Viet Nam') RETURNING airport_id INTO v_han;
  INSERT INTO airports(code,name,city,country) VALUES('DAD','Da Nang','Da Nang','Viet Nam') RETURNING airport_id INTO v_dad;
  INSERT INTO airports(code,name,city,country) VALUES('PQC','Phu Quoc','Phu Quoc','Viet Nam') RETURNING airport_id INTO v_pqc;
  INSERT INTO aircrafts(model,capacity) VALUES('Airbus A321 - Demo 12 seats',12) RETURNING aircraft_id INTO v_aircraft;
  FOR i IN 1..4 LOOP
    IF i=1 THEN v_origin:=v_sgn; v_dest:=v_han; v_flight_number:='VN120';
    ELSIF i=2 THEN v_origin:=v_han; v_dest:=v_sgn; v_flight_number:='VN121';
    ELSIF i=3 THEN v_origin:=v_sgn; v_dest:=v_dad; v_flight_number:='VN230';
    ELSE v_origin:=v_sgn; v_dest:=v_pqc; v_flight_number:='VN780'; END IF;
    INSERT INTO flights(flight_number,aircraft_id,origin_airport_id,destination_airport_id,duration)
      VALUES(v_flight_number,v_aircraft,v_origin,v_dest,INTERVAL '2' HOUR)
      RETURNING flight_id INTO v_flight;
    FOR j IN 1..2 LOOP
      INSERT INTO flight_schedules(flight_id,departure_time,arrival_time)
        VALUES(v_flight,SYSTIMESTAMP+NUMTODSINTERVAL(7+i+j,'DAY'),
          SYSTIMESTAMP+NUMTODSINTERVAL(7+i+j,'DAY')+INTERVAL '2' HOUR)
        RETURNING schedule_id INTO v_schedule;
      v_schedules((i-1)*2+j):=v_schedule;
      FOR row_num IN 1..2 LOOP
        FOR col_num IN 1..6 LOOP
          INSERT INTO flight_seats(schedule_id,seat_number,seat_class,base_price,status)
            VALUES(v_schedule,TO_CHAR(row_num,'FM9')||SUBSTR(v_letters,col_num,1),
              CASE WHEN row_num=1 THEN 'BUSINESS' ELSE 'ECONOMY' END,
              CASE WHEN row_num=1 THEN 4500000 ELSE 1850000 END,'AVAILABLE');
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
  INSERT INTO flash_sales(start_time,end_time,status)
    VALUES(SYSTIMESTAMP-INTERVAL '1' HOUR,SYSTIMESTAMP+INTERVAL '7' DAY,'ACTIVE')
    RETURNING flash_sale_id INTO v_sale;
  FOR i IN 1..8 LOOP
    INSERT INTO flash_sale_items(flash_sale_id,schedule_id,sale_price,quota)
      VALUES(v_sale,v_schedules(i),199000+i*10000,3)
      RETURNING flash_sale_item_id INTO v_items(i);
  END LOOP;
  INSERT INTO passengers(user_id,first_name,last_name,passport_number) VALUES(v_user,'Van An','Nguyen','DEMO-C12345678');
  INSERT INTO passengers(user_id,first_name,last_name,passport_number) VALUES(v_user2,'Thi Binh','Tran','DEMO-B87654321');
  pkg_flight_booking.hold_seat(v_schedules(1),'1A',v_user,'PESSIMISTIC',NULL,v_reservation);
  pkg_flight_booking.checkout(v_reservation,v_user,NULL,v_booking,v_ticket);
  pkg_flight_booking.hold_seat(v_schedules(2),'2A',v_user,'PESSIMISTIC',NULL,v_reservation);
  pkg_flight_booking.checkout(v_reservation,v_user,NULL,v_booking,v_ticket);
  pkg_flight_booking.hold_seat(v_schedules(3),'2B',v_user2,'PESSIMISTIC',NULL,v_reservation);
  pkg_flight_booking.checkout(v_reservation,v_user2,v_items(3),v_booking,v_ticket);
  INSERT INTO project_diagnostics(category,check_name,status,details)
    VALUES('INSTALL','SEED','PASS','3 users, 4 airports, 1 aircraft, 4 flights, 8 schedules, 96 seats, 8 sale items, 3 paid bookings.');
EXCEPTION WHEN OTHERS THEN
  ROLLBACK TO sp_seed;
  RAISE;
END;
/
COMMIT;

-- ============================================================================
-- 5. SMOKE TESTS: LOI DU KIEN DUOC BAT, LOI NGOAI DU KIEN SE DUNG SCRIPT.
-- Moi case rollback ve cung savepoint; khong de lai ve/hold/quota thu nghiem.
-- ============================================================================
DECLARE
  v_user NUMBER; v_other NUMBER; v_schedule NUMBER; v_wrong_schedule NUMBER;
  v_item NUMBER; v_sale NUMBER; v_aircraft NUMBER;
  v_reservation NUMBER; v_booking NUMBER; v_seat NUMBER; v_ticket VARCHAR2(50);
  v_count NUMBER; v_amount NUMBER; v_version NUMBER; v_status VARCHAR2(20);
  v_test_count PLS_INTEGER:=0;
  PROCEDURE check_true(p_ok BOOLEAN,p_message VARCHAR2) IS
  BEGIN
    IF p_ok IS NULL OR NOT p_ok THEN RAISE_APPLICATION_ERROR(-20200,p_message); END IF;
  END;
BEGIN
  SAVEPOINT sp_smoke;
  SELECT user_id INTO v_user FROM users WHERE username='nguyenvanan';
  SELECT user_id INTO v_other FROM users WHERE username='tranthibinh';
  SELECT MAX(schedule_id),MIN(schedule_id) INTO v_schedule,v_wrong_schedule FROM flight_schedules;
  SELECT flash_sale_item_id,flash_sale_id INTO v_item,v_sale FROM flash_sale_items WHERE schedule_id=v_schedule;
  SELECT seat_id,version INTO v_seat,v_version FROM flight_seats WHERE schedule_id=v_schedule AND seat_number='2F';
  SELECT aircraft_id INTO v_aircraft FROM aircrafts WHERE model='Airbus A321 - Demo 12 seats';
  -- T01: hold -> checkout, exact owner, amount, payment, audit, version.
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
  pkg_flight_booking.checkout(v_reservation,v_user,NULL,v_booking,v_ticket);
  SELECT COUNT(*) INTO v_count FROM tickets WHERE booking_id=v_booking AND seat_id=v_seat AND reservation_id=v_reservation;
  check_true(v_count=1,'T01: missing or duplicate ticket');
  SELECT COUNT(*) INTO v_count FROM payments WHERE booking_id=v_booking AND amount=1850000 AND status='COMPLETED';
  check_true(v_count=1,'T01: invalid payment');
  SELECT COUNT(*) INTO v_count FROM booking_logs WHERE booking_id=v_booking AND new_status='CONFIRMED';
  check_true(v_count=1,'T01: missing audit');
  SELECT version INTO v_count FROM flight_seats WHERE seat_id=v_seat;
  check_true(v_count=v_version+2,'T01: seat version must increment on hold and checkout');
  BEGIN
    pkg_flight_booking.checkout(v_reservation,v_user,NULL,v_booking,v_ticket);
    RAISE_APPLICATION_ERROR(-20200,'T01: repeated checkout accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20004 THEN RAISE; END IF; END;
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T02: stale optimistic version, then a valid CAS.
  BEGIN
    pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'OPTIMISTIC',v_version+100,v_reservation);
    RAISE_APPLICATION_ERROR(-20200,'T02: stale version accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20003 THEN RAISE; END IF; END;
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'OPTIMISTIC',v_version,v_reservation);
  SELECT status INTO v_status FROM flight_seats WHERE seat_id=v_seat;
  check_true(v_status='HOLD','T02: valid optimistic hold failed');
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T03: wrong owner and wrong amount do not consume the reservation.
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
  BEGIN
    pkg_flight_booking.checkout(v_reservation,v_other,NULL,v_booking,v_ticket);
    RAISE_APPLICATION_ERROR(-20200,'T03: wrong owner accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20010 THEN RAISE; END IF; END;
  BEGIN
    pkg_flight_booking.confirm_booking_and_pay(v_reservation,1);
    RAISE_APPLICATION_ERROR(-20200,'T03: wrong amount accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20012 THEN RAISE; END IF; END;
  SELECT status INTO v_status FROM seat_reservations WHERE reservation_id=v_reservation;
  check_true(v_status='HOLDING','T03: failed payment changed reservation');
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T04: expiry rejects checkout and releases only expired holds.
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
  UPDATE seat_reservations SET hold_expires_at=SYSTIMESTAMP-INTERVAL '1' MINUTE WHERE reservation_id=v_reservation;
  BEGIN
    pkg_flight_booking.checkout(v_reservation,v_user,NULL,v_booking,v_ticket);
    RAISE_APPLICATION_ERROR(-20200,'T04: expired hold accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20004 THEN RAISE; END IF; END;
  pkg_flight_booking.release_expired_reservations;
  SELECT status INTO v_status FROM flight_seats WHERE seat_id=v_seat;
  check_true(v_status='AVAILABLE','T04: expired seat not released');
  SELECT status INTO v_status FROM seat_reservations WHERE reservation_id=v_reservation;
  check_true(v_status='EXPIRED','T04: reservation not expired');
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T05: exact final sale quota, including a zero-priced ticket.
  UPDATE flash_sale_items SET quota=sold_count+1,sale_price=0 WHERE flash_sale_item_id=v_item;
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
  pkg_flight_booking.checkout(v_reservation,v_user,v_item,v_booking,v_ticket);
  SELECT total_amount INTO v_amount FROM bookings WHERE booking_id=v_booking;
  check_true(v_amount=0,'T05: zero-priced sale lost');
  pkg_flight_booking.hold_seat(v_schedule,'2E',v_user,'PESSIMISTIC',NULL,v_reservation);
  BEGIN
    pkg_flight_booking.checkout(v_reservation,v_user,v_item,v_booking,v_ticket);
    RAISE_APPLICATION_ERROR(-20200,'T05: quota exceeded');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20006 THEN RAISE; END IF; END;
  SELECT quota-sold_count INTO v_count FROM flash_sale_items WHERE flash_sale_item_id=v_item;
  check_true(v_count=0,'T05: quota changed after failed checkout');
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T06: not-yet-started sale.
  UPDATE flash_sales SET start_time=SYSTIMESTAMP+INTERVAL '1' HOUR WHERE flash_sale_id=v_sale;
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
  BEGIN
    pkg_flight_booking.checkout(v_reservation,v_user,v_item,v_booking,v_ticket);
    RAISE_APPLICATION_ERROR(-20200,'T06: future sale accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20011 THEN RAISE; END IF; END;
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T07: departed schedule.
  UPDATE flight_schedules SET departure_time=SYSTIMESTAMP-INTERVAL '2' HOUR,
    arrival_time=SYSTIMESTAMP-INTERVAL '1' HOUR WHERE schedule_id=v_schedule;
  BEGIN
    pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
    RAISE_APPLICATION_ERROR(-20200,'T07: departed flight accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20008 THEN RAISE; END IF; END;
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T08: capacity and mismatched reservation schedule.
  BEGIN
    INSERT INTO flight_seats(schedule_id,seat_number,seat_class,base_price,status)
      VALUES(v_schedule,'3A','ECONOMY',1,'AVAILABLE');
    RAISE_APPLICATION_ERROR(-20200,'T08: inventory exceeded capacity');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20007 THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO seat_reservations(schedule_id,seat_id,user_id,hold_expires_at,status)
      VALUES(v_wrong_schedule,v_seat,v_user,SYSTIMESTAMP+INTERVAL '10' MINUTE,'HOLDING');
    RAISE_APPLICATION_ERROR(-20200,'T08: mismatched schedule accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-2291 THEN RAISE; END IF; END;
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T09: unique ticket per seat and no reopening a paid seat.
  pkg_flight_booking.hold_seat(v_schedule,'2F',v_user,'PESSIMISTIC',NULL,v_reservation);
  pkg_flight_booking.checkout(v_reservation,v_user,NULL,v_booking,v_ticket);
  BEGIN
    INSERT INTO tickets(booking_id,seat_id,e_ticket_number) VALUES(v_booking,v_seat,'SMOKE-'||RAWTOHEX(SYS_GUID()));
    RAISE_APPLICATION_ERROR(-20200,'T09: duplicate ticket accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-1 THEN RAISE; END IF; END;
  BEGIN
    UPDATE flight_seats SET status='AVAILABLE' WHERE seat_id=v_seat;
    RAISE_APPLICATION_ERROR(-20200,'T09: reopening paid seat accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-20005 THEN RAISE; END IF; END;
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  -- T10: unavailable user rolls back the preceding seat update.
  BEGIN
    pkg_flight_booking.hold_seat(v_schedule,'2F',-1,'PESSIMISTIC',NULL,v_reservation);
    RAISE_APPLICATION_ERROR(-20200,'T10: invalid user accepted');
  EXCEPTION WHEN OTHERS THEN IF SQLCODE<>-2291 THEN RAISE; END IF; END;
  SELECT status INTO v_status FROM flight_seats WHERE seat_id=v_seat;
  check_true(v_status='AVAILABLE','T10: failed hold left partial seat update');
  ROLLBACK TO sp_smoke; v_test_count:=v_test_count+1;

  INSERT INTO project_diagnostics(category,check_name,status,details)
    VALUES('TEST','SINGLE_SESSION_SMOKE','PASS',TO_CHAR(v_test_count)||' cases passed; test business data rolled back. Concurrency/isolation need separate sessions.');
EXCEPTION WHEN OTHERS THEN
  ROLLBACK TO sp_smoke;
  RAISE;
END;
/
COMMIT;

-- ============================================================================
-- 6. EXECUTION PLANS CHO 2 TRUY VAN, TRUOC/SAU INDEX.
-- Baseline dung NO_INDEX, khong xoa index that. Ket qua luu trong diagnostics.
-- Khong can SPOOL, quyen xem V$SQL, DBA hay file ngoai.
-- ============================================================================
DECLARE
  v_stats_error VARCHAR2(4000);
  PROCEDURE capture_plan(p_name VARCHAR2,p_query VARCHAR2) IS
    v_rows SYS_REFCURSOR;
    v_line VARCHAR2(4000);
    v_plan CLOB;
    v_error VARCHAR2(4000);
    v_is_open BOOLEAN:=FALSE;
  BEGIN
    EXECUTE IMMEDIATE 'EXPLAIN PLAN SET STATEMENT_ID = '''||p_name||''' FOR '||p_query;
    DBMS_LOB.CREATETEMPORARY(v_plan,TRUE);
    OPEN v_rows FOR
      'SELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY(''PLAN_TABLE'',:plan_id,''BASIC +PREDICATE +COST''))'
      USING p_name;
    v_is_open:=TRUE;
    LOOP
      FETCH v_rows INTO v_line;
      EXIT WHEN v_rows%NOTFOUND;
      IF v_line IS NOT NULL THEN
        DBMS_LOB.WRITEAPPEND(v_plan,LENGTH(v_line||CHR(10)),v_line||CHR(10));
      END IF;
    END LOOP;
    CLOSE v_rows;
    v_is_open:=FALSE;
    INSERT INTO project_diagnostics(category,check_name,status,details)
      VALUES('PLAN',p_name,'INFO',v_plan);
    DBMS_LOB.FREETEMPORARY(v_plan);
  EXCEPTION WHEN OTHERS THEN
    v_error:=SQLERRM;
    IF v_is_open THEN CLOSE v_rows; END IF;
    IF v_plan IS NOT NULL AND DBMS_LOB.ISTEMPORARY(v_plan)=1 THEN DBMS_LOB.FREETEMPORARY(v_plan); END IF;
    INSERT INTO project_diagnostics(category,check_name,status,details)
      VALUES('PLAN',p_name,'WARN','Optional plan unavailable: '||v_error);
  END;
BEGIN
  BEGIN
    EXECUTE IMMEDIATE 'BEGIN
      DBMS_STATS.GATHER_TABLE_STATS(USER,''FLIGHT_SCHEDULES'',cascade=>TRUE);
      DBMS_STATS.GATHER_TABLE_STATS(USER,''FLIGHTS'',cascade=>TRUE);
      DBMS_STATS.GATHER_TABLE_STATS(USER,''SEAT_RESERVATIONS'',cascade=>TRUE);
    END;';
  EXCEPTION WHEN OTHERS THEN
    v_stats_error:=SQLERRM;
    INSERT INTO project_diagnostics(category,check_name,status,details)
      VALUES('PLAN','GATHER_STATS','WARN','Statistics unavailable: '||v_stats_error);
  END;
  capture_plan('D23_Q1_BEFORE',
    'SELECT /*+ NO_INDEX(s idx_schedule_departure) NO_INDEX(f idx_flights_route) */
       s.schedule_id,s.departure_time,f.flight_number
     FROM flight_schedules s JOIN flights f ON f.flight_id=s.flight_id
     WHERE s.departure_time>=SYSTIMESTAMP
       AND s.departure_time<SYSTIMESTAMP+INTERVAL ''14'' DAY
       AND f.origin_airport_id=(SELECT airport_id FROM airports WHERE code=''SGN'')
     ORDER BY s.departure_time');
  capture_plan('D23_Q1_AFTER',
    'SELECT s.schedule_id,s.departure_time,f.flight_number
     FROM flight_schedules s JOIN flights f ON f.flight_id=s.flight_id
     WHERE s.departure_time>=SYSTIMESTAMP
       AND s.departure_time<SYSTIMESTAMP+INTERVAL ''14'' DAY
       AND f.origin_airport_id=(SELECT airport_id FROM airports WHERE code=''SGN'')
     ORDER BY s.departure_time');
  capture_plan('D23_Q2_BEFORE',
    'SELECT /*+ NO_INDEX(r idx_seat_reserv_status) */ reservation_id,seat_id
     FROM seat_reservations r WHERE status=''HOLDING'' AND hold_expires_at<=SYSTIMESTAMP');
  capture_plan('D23_Q2_AFTER',
    'SELECT reservation_id,seat_id FROM seat_reservations r
     WHERE status=''HOLDING'' AND hold_expires_at<=SYSTIMESTAMP');
END;
/
COMMIT;

-- ============================================================================
-- 7. DOI SOAT TOAN VEN: MOI ANOMALY_COUNT PHAI BANG 0.
-- ============================================================================
CREATE OR REPLACE VIEW vw_project_integrity AS
SELECT 'DUPLICATE_TICKET_SEAT' AS check_name,COUNT(*) AS anomaly_count
  FROM (SELECT seat_id FROM tickets GROUP BY seat_id HAVING COUNT(*)>1)
UNION ALL
SELECT 'DUPLICATE_ACTIVE_HOLD',COUNT(*)
  FROM (SELECT seat_id FROM seat_reservations WHERE status='HOLDING' GROUP BY seat_id HAVING COUNT(*)>1)
UNION ALL
SELECT 'RESERVATION_SEAT_MISMATCH',COUNT(*)
  FROM seat_reservations r JOIN flight_seats s ON s.seat_id=r.seat_id
  WHERE r.schedule_id<>s.schedule_id OR (r.status='HOLDING' AND s.status<>'HOLD')
    OR (r.status='CONFIRMED' AND s.status<>'BOOKED')
UNION ALL
SELECT 'TICKET_SEAT_NOT_BOOKED',COUNT(*)
  FROM tickets t JOIN flight_seats s ON s.seat_id=t.seat_id WHERE s.status<>'BOOKED'
UNION ALL
SELECT 'CAPACITY_EXCEEDED',COUNT(*) FROM (
  SELECT s.schedule_id FROM flight_schedules s JOIN flights f ON f.flight_id=s.flight_id
    JOIN aircrafts a ON a.aircraft_id=f.aircraft_id JOIN flight_seats seats ON seats.schedule_id=s.schedule_id
  GROUP BY s.schedule_id,a.capacity HAVING COUNT(*)>a.capacity)
UNION ALL
SELECT 'SALE_TICKET_COUNT_MISMATCH',COUNT(*) FROM (
  SELECT i.flash_sale_item_id FROM flash_sale_items i LEFT JOIN tickets t ON t.flash_sale_item_id=i.flash_sale_item_id
  GROUP BY i.flash_sale_item_id,i.sold_count,i.quota
  HAVING COUNT(t.ticket_id)<>i.sold_count OR i.sold_count>i.quota OR i.sold_count<0)
UNION ALL
SELECT 'PAYMENT_AMOUNT_MISMATCH',COUNT(*) FROM (
  SELECT b.booking_id FROM bookings b LEFT JOIN payments p ON p.booking_id=b.booking_id AND p.status='COMPLETED'
  WHERE b.status='CONFIRMED' GROUP BY b.booking_id,b.total_amount
  HAVING COUNT(p.payment_id)<>1 OR SUM(p.amount)<>b.total_amount)
UNION ALL
SELECT 'BOOKED_SEAT_WITHOUT_TICKET',COUNT(*) FROM flight_seats s
  WHERE s.status='BOOKED' AND NOT EXISTS(SELECT 1 FROM tickets t WHERE t.seat_id=s.seat_id);

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_errors WHERE attribute='ERROR';
  IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20199,'Compilation errors: inspect USER_ERRORS.'); END IF;
  SELECT COUNT(*) INTO v_count FROM vw_project_integrity WHERE anomaly_count<>0;
  IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20198,'Integrity failed: inspect VW_PROJECT_INTEGRITY.'); END IF;
  SELECT COUNT(*) INTO v_count FROM project_diagnostics WHERE check_name='SINGLE_SESSION_SMOKE' AND status='PASS';
  IF v_count<>1 THEN RAISE_APPLICATION_ERROR(-20197,'Smoke tests did not complete.'); END IF;
  INSERT INTO project_diagnostics(category,check_name,status,details)
    VALUES('INSTALL','CORE_CHECKS','PASS','Packages, triggers, 10 smoke cases and 8 integrity checks completed. Check PLAN warnings separately.');
END;
/
COMMIT;

-- RESULT 1: phai co CORE_CHECKS = PASS; PLAN = WARN nghia la thieu quyen/plan.
SELECT category,check_name,status,details FROM project_diagnostics ORDER BY diagnostic_id;

-- RESULT 2: phai la 8 dong, tat ca ANOMALY_COUNT = 0.
SELECT check_name,anomaly_count FROM vw_project_integrity ORDER BY check_name;

-- RESULT 3: khong duoc co dong ATTRIBUTE = ERROR.
SELECT name,type,line,position,attribute,text FROM user_errors ORDER BY name,sequence;

-- RESULT 4: packages, triggers va view phai VALID.
SELECT object_name,object_type,status FROM user_objects
WHERE object_type IN ('PACKAGE','PACKAGE BODY','TRIGGER','VIEW') ORDER BY object_type,object_name;

-- RESULT 5: 3 ve mau (khong bao gom du lieu smoke test da rollback).
SELECT b.booking_id,u.username,t.e_ticket_number,f.flight_number,s.seat_number,
  b.total_amount,b.status,t.flash_sale_item_id
FROM bookings b JOIN users u ON u.user_id=b.user_id JOIN tickets t ON t.booking_id=b.booking_id
JOIN flight_seats s ON s.seat_id=t.seat_id JOIN flight_schedules sch ON sch.schedule_id=s.schedule_id
JOIN flights f ON f.flight_id=sch.flight_id ORDER BY b.booking_id;

-- RESULT 6: so luong du lieu mau.
SELECT 'USERS' AS table_name,COUNT(*) AS row_count FROM users
UNION ALL SELECT 'FLIGHTS',COUNT(*) FROM flights
UNION ALL SELECT 'FLIGHT_SCHEDULES',COUNT(*) FROM flight_schedules
UNION ALL SELECT 'FLIGHT_SEATS',COUNT(*) FROM flight_seats
UNION ALL SELECT 'FLASH_SALE_ITEMS',COUNT(*) FROM flash_sale_items
UNION ALL SELECT 'BOOKINGS',COUNT(*) FROM bookings
UNION ALL SELECT 'TICKETS',COUNT(*) FROM tickets
UNION ALL SELECT 'PAYMENTS',COUNT(*) FROM payments;

-- Sau khi chay: API Node.js ket noi cung PDB/schema nay; KHONG chay npm run seed
-- vi file nay da seed san. Chi can cai npm, cau hinh .env va npm start.
-- Khong tu tao scheduler job: worker API don hold het han moi 30 giay.
-- Khi demo bang SQL thu cong: goi release_expired_reservations roi COMMIT.
-- READ COMMITTED/SERIALIZABLE/NOWAIT can 2 SQL Editors voi 2 connections rieng.
-- Khong chen SET TRANSACTION SERIALIZABLE vao toan bo script cai dat nay.
