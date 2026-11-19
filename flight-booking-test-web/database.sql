-- ===========================================================================
-- DE TAI 23 - BAN POSTGRESQL DE TEST (KHONG THAY THE BAN ORACLE DE NOP)
-- File duy nhat: DE_TAI_23_POSTGRESQL.sql, PostgreSQL 16+, DBeaver Alt+X.
-- Ket noi PostgreSQL, vi du database 'postgres'. User can CREATE SCHEMA.
-- Script tao schema RIENG flight_booking_test trong database dang ket noi.
-- Khong xoa du lieu. Chay mot lan; schema da ton tai thi dung va rollback.
-- DBeaver SQL Processing: delimiter ';', Blank line delimiter = Never,
-- Ignore native delimiter = OFF, Error handling = Stop + rollback.
-- Giu nguyen $$...$$ cua PL/pgSQL; khong su dung delimiter '/' cua Oracle.
-- Khong bat commit tung statement: file tu BEGIN/COMMIT toan bo cai dat.
-- Co schema, index, functions thay package, triggers, seed, tests va plans.
-- Ban web FlightLab nap file nay tu dong vao PostgreSQL test rieng.
-- Demo passwords: admin/admin123; nguyenvanan/user123; tranthibinh/user123.
-- Xem project_diagnostics, vw_project_integrity va CORE_CHECKS o cuoi file.
-- ===========================================================================
BEGIN;
CREATE SCHEMA flight_booking_test;
SET search_path TO flight_booking_test, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';



-- =========================================================================
-- Đề tài 23: Hệ thống đặt vé máy bay trực tuyến (kèm flash sale)
-- Bản chuyển đổi để test: PostgreSQL 16+
-- Trọng tâm: Transactions & Concurrency Control, Isolation Levels, Locking
-- =========================================================================

-- 1. TẠO BẢNG (TABLES)
CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER' NOT NULL CHECK (role IN ('USER','ADMIN'))
);

CREATE TABLE airports (
    airport_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL
);

CREATE TABLE aircrafts (
    aircraft_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    model VARCHAR(50) NOT NULL,
    capacity BIGINT NOT NULL CHECK (capacity > 0 AND capacity = TRUNC(capacity))
);

CREATE TABLE flights (
    flight_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    flight_number VARCHAR(20) UNIQUE NOT NULL,
    aircraft_id BIGINT NOT NULL REFERENCES aircrafts(aircraft_id),
    origin_airport_id BIGINT NOT NULL REFERENCES airports(airport_id),
    destination_airport_id BIGINT NOT NULL REFERENCES airports(airport_id),
    duration INTERVAL NOT NULL,
    CHECK (origin_airport_id <> destination_airport_id),
    CHECK (duration > INTERVAL '0' SECOND)
);

CREATE TABLE flight_schedules (
    schedule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    flight_id BIGINT NOT NULL REFERENCES flights(flight_id),
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
    CHECK (arrival_time > departure_time)
);

CREATE TABLE flight_seats (
    seat_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id BIGINT NOT NULL REFERENCES flight_schedules(schedule_id),
    seat_number VARCHAR(10) NOT NULL,
    seat_class VARCHAR(20) NOT NULL,
    base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
    status VARCHAR(20) CHECK (status IN ('AVAILABLE', 'HOLD', 'BOOKED')) NOT NULL,
    version BIGINT DEFAULT 0 NOT NULL CHECK (version >= 0 AND version = TRUNC(version)),
    UNIQUE(schedule_id, seat_number),
    CONSTRAINT uq_seat_schedule UNIQUE(seat_id, schedule_id)
);

CREATE TABLE seat_reservations (
    reservation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id BIGINT NOT NULL REFERENCES flight_schedules(schedule_id),
    seat_id BIGINT NOT NULL REFERENCES flight_seats(seat_id),
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    hold_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('HOLDING', 'EXPIRED', 'CONFIRMED')) NOT NULL,
    quoted_price NUMERIC(10,2) CHECK (quoted_price >= 0),
    CONSTRAINT fk_reservation_schedule FOREIGN KEY(seat_id,schedule_id) REFERENCES flight_seats(seat_id,schedule_id)
);

CREATE TABLE flash_sales (
    flash_sale_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('ACTIVE', 'INACTIVE')) NOT NULL,
    CHECK (end_time > start_time)
);

CREATE TABLE flash_sale_items (
    flash_sale_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    flash_sale_id BIGINT NOT NULL REFERENCES flash_sales(flash_sale_id),
    schedule_id BIGINT NOT NULL REFERENCES flight_schedules(schedule_id),
    sale_price NUMERIC(10,2) NOT NULL CHECK (sale_price >= 0),
    quota BIGINT NOT NULL CHECK (quota >= 0 AND quota = TRUNC(quota)),
    sold_count BIGINT DEFAULT 0 NOT NULL,
    version BIGINT DEFAULT 0 NOT NULL CHECK (version >= 0 AND version = TRUNC(version)),
    CHECK (sold_count >= 0 AND sold_count <= quota AND sold_count = TRUNC(sold_count)),
    UNIQUE(flash_sale_id, schedule_id)
);

CREATE TABLE passengers (
    passenger_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    passport_number VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE bookings (
    booking_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(20) CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')) NOT NULL
);

CREATE TABLE tickets (
    ticket_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(booking_id),
    seat_id BIGINT NOT NULL REFERENCES flight_seats(seat_id),
    e_ticket_number VARCHAR(50) UNIQUE NOT NULL,
    reservation_id BIGINT UNIQUE REFERENCES seat_reservations(reservation_id),
    flash_sale_item_id BIGINT REFERENCES flash_sale_items(flash_sale_item_id),
    CONSTRAINT uq_ticket_seat UNIQUE(seat_id)
);

CREATE TABLE payments (
    payment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(booking_id),
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')) NOT NULL
);

-- Bảng cho Audit Trigger
CREATE TABLE booking_logs (
    log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(booking_id),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
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
CREATE UNIQUE INDEX uq_holding_seat ON seat_reservations(seat_id) WHERE status='HOLDING';
CREATE INDEX idx_res_seat_schedule ON seat_reservations(seat_id,schedule_id);
CREATE INDEX idx_tickets_sale ON tickets(flash_sale_item_id);
CREATE INDEX idx_schedule_departure ON flight_schedules(departure_time,flight_id);
CREATE INDEX idx_flights_route ON flights(origin_airport_id,destination_airport_id);
CREATE INDEX idx_seat_class_available ON flight_seats(schedule_id,seat_class,status,seat_id);
CREATE INDEX idx_bookings_history ON bookings(user_id,booking_id DESC);


-- PostgreSQL has no Oracle package: schema-qualified functions expose the API.
-- P2001..P2012 correspond to Oracle business errors -20001..-20012.
-- Functions do not commit. Any uncaught error rolls back the SQL statement.
CREATE FUNCTION check_departure(p_schedule_id BIGINT) RETURNS VOID
LANGUAGE plpgsql SET search_path = flight_booking_test, pg_catalog AS $$
DECLARE v_time TIMESTAMPTZ;
BEGIN
  SELECT departure_time INTO STRICT v_time FROM flight_schedules WHERE schedule_id=p_schedule_id;
  IF v_time<=clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='P2008',MESSAGE='Flight has departed'; END IF;
END;
$$;

CREATE FUNCTION hold_seat(p_schedule_id BIGINT,p_seat_number TEXT,p_user_id BIGINT,
  p_mode TEXT DEFAULT 'PESSIMISTIC',p_client_version BIGINT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SET search_path = flight_booking_test, pg_catalog AS $$
DECLARE v_seat flight_seats%ROWTYPE; v_reservation BIGINT;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('PESSIMISTIC','OPTIMISTIC') THEN
    RAISE EXCEPTION USING ERRCODE='P2009',MESSAGE='Invalid lock mode';
  END IF;
  IF p_mode='PESSIMISTIC' THEN
    SELECT * INTO STRICT v_seat FROM flight_seats
      WHERE schedule_id=p_schedule_id AND seat_number=p_seat_number FOR UPDATE NOWAIT;
  ELSE
    SELECT * INTO STRICT v_seat FROM flight_seats
      WHERE schedule_id=p_schedule_id AND seat_number=p_seat_number;
  END IF;
  IF p_mode='OPTIMISTIC' AND (p_client_version IS NULL OR p_client_version<>v_seat.version) THEN
    RAISE EXCEPTION USING ERRCODE='P2003',MESSAGE='Stale seat version';
  END IF;
  IF v_seat.status<>'AVAILABLE' THEN RAISE EXCEPTION USING ERRCODE='P2001',MESSAGE='Seat unavailable'; END IF;
  PERFORM check_departure(p_schedule_id);
  IF p_mode='OPTIMISTIC' THEN
    UPDATE flight_seats SET status='HOLD' WHERE seat_id=v_seat.seat_id
      AND status='AVAILABLE' AND version=p_client_version;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2003',MESSAGE='Concurrent seat change'; END IF;
  ELSE
    UPDATE flight_seats SET status='HOLD' WHERE seat_id=v_seat.seat_id;
  END IF;
  INSERT INTO seat_reservations(schedule_id,seat_id,user_id,hold_expires_at,status,quoted_price)
    VALUES(p_schedule_id,v_seat.seat_id,p_user_id,clock_timestamp()+INTERVAL '10 minutes','HOLDING',v_seat.base_price)
    RETURNING reservation_id INTO v_reservation;
  RETURN v_reservation;
EXCEPTION
  WHEN no_data_found THEN RAISE EXCEPTION USING ERRCODE='P2001',MESSAGE='Seat does not exist';
  WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='P2002',MESSAGE='Seat busy; retry whole transaction';
END;
$$;

CREATE FUNCTION hold_seat_pessimistic(p_schedule_id BIGINT,p_seat_number TEXT,p_user_id BIGINT)
RETURNS BIGINT LANGUAGE sql SET search_path = flight_booking_test, pg_catalog AS $$
  SELECT hold_seat(p_schedule_id,p_seat_number,p_user_id,'PESSIMISTIC',NULL);
$$;
CREATE FUNCTION hold_seat_optimistic(p_schedule_id BIGINT,p_seat_number TEXT,p_user_id BIGINT,p_version BIGINT)
RETURNS BIGINT LANGUAGE sql SET search_path = flight_booking_test, pg_catalog AS $$
  SELECT hold_seat(p_schedule_id,p_seat_number,p_user_id,'OPTIMISTIC',p_version);
$$;
CREATE FUNCTION hold_auto_seat_skip_locked(p_schedule_id BIGINT,p_user_id BIGINT,p_class TEXT)
RETURNS BIGINT LANGUAGE plpgsql SET search_path = flight_booking_test, pg_catalog AS $$
DECLARE v_number TEXT;
BEGIN
  SELECT seat_number INTO v_number FROM flight_seats
    WHERE schedule_id=p_schedule_id AND seat_class=p_class AND status='AVAILABLE'
    ORDER BY seat_id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2001',MESSAGE='No unlocked available seat'; END IF;
  RETURN hold_seat(p_schedule_id,v_number,p_user_id);
END;
$$;

CREATE FUNCTION checkout(p_reservation_id BIGINT,p_user_id BIGINT,
  p_sale_item_id BIGINT DEFAULT NULL,p_expected_amount NUMERIC DEFAULT NULL)
RETURNS TABLE(booking_id BIGINT,e_ticket VARCHAR(50))
LANGUAGE plpgsql SET search_path = flight_booking_test, pg_catalog AS $$
DECLARE
  v_seat_id BIGINT; v_seat_status TEXT; v_res seat_reservations%ROWTYPE;
  v_item flash_sale_items%ROWTYPE; v_sale flash_sales%ROWTYPE;
  v_price NUMERIC(10,2); v_booking BIGINT; v_ticket VARCHAR(50);
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2010',MESSAGE='User is required'; END IF;
  SELECT r.seat_id INTO STRICT v_seat_id FROM seat_reservations r WHERE r.reservation_id=p_reservation_id;
  SELECT s.status INTO STRICT v_seat_status FROM flight_seats s WHERE s.seat_id=v_seat_id FOR UPDATE NOWAIT;
  SELECT r.* INTO STRICT v_res FROM seat_reservations r WHERE r.reservation_id=p_reservation_id FOR UPDATE NOWAIT;
  IF v_res.user_id<>p_user_id THEN RAISE EXCEPTION USING ERRCODE='P2010',MESSAGE='Reservation owner mismatch'; END IF;
  IF v_res.status<>'HOLDING' OR v_res.hold_expires_at<=clock_timestamp() OR v_seat_status<>'HOLD' THEN
    RAISE EXCEPTION USING ERRCODE='P2004',MESSAGE='Reservation expired or already processed';
  END IF;
  PERFORM check_departure(v_res.schedule_id);
  v_price:=v_res.quoted_price;
  IF v_price IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2009',MESSAGE='Missing quoted price'; END IF;
  IF p_sale_item_id IS NOT NULL THEN
    SELECT i.* INTO STRICT v_item FROM flash_sale_items i
      WHERE i.flash_sale_item_id=p_sale_item_id AND i.schedule_id=v_res.schedule_id FOR UPDATE NOWAIT;
    SELECT fs.* INTO STRICT v_sale FROM flash_sales fs WHERE fs.flash_sale_id=v_item.flash_sale_id FOR UPDATE NOWAIT;
    IF v_sale.status<>'ACTIVE' OR v_sale.start_time>clock_timestamp() OR v_sale.end_time<=clock_timestamp() THEN
      RAISE EXCEPTION USING ERRCODE='P2011',MESSAGE='Sale has not started or has ended';
    END IF;
    UPDATE flash_sale_items i SET sold_count=i.sold_count+1,version=i.version+1
      WHERE i.flash_sale_item_id=p_sale_item_id AND i.sold_count<i.quota;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2006',MESSAGE='Sale quota exhausted'; END IF;
    v_price:=v_item.sale_price;
  END IF;
  IF p_expected_amount IS NOT NULL AND p_expected_amount<>v_price THEN
    RAISE EXCEPTION USING ERRCODE='P2012',MESSAGE='Payment amount mismatch';
  END IF;
  INSERT INTO bookings AS b(user_id,total_amount,status) VALUES(p_user_id,v_price,'PENDING')
    RETURNING b.booking_id INTO v_booking;
  v_ticket:='ETKT-'||v_booking::TEXT;
  INSERT INTO tickets(booking_id,seat_id,e_ticket_number,reservation_id,flash_sale_item_id)
    VALUES(v_booking,v_seat_id,v_ticket,p_reservation_id,p_sale_item_id);
  INSERT INTO payments(booking_id,amount,status) VALUES(v_booking,v_price,'COMPLETED');
  UPDATE seat_reservations r SET status='CONFIRMED' WHERE r.reservation_id=p_reservation_id;
  UPDATE flight_seats s SET status='BOOKED' WHERE s.seat_id=v_seat_id;
  UPDATE bookings b SET status='CONFIRMED' WHERE b.booking_id=v_booking;
  RETURN QUERY SELECT v_booking,v_ticket;
EXCEPTION
  WHEN no_data_found THEN RAISE EXCEPTION USING ERRCODE='P2004',MESSAGE='Reservation or sale item not found';
  WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='P2002',MESSAGE='Checkout busy; retry whole transaction';
END;
$$;

CREATE FUNCTION book_seat(p_schedule_id BIGINT,p_seat_number TEXT,p_user_id BIGINT,
  p_sale_item_id BIGINT DEFAULT NULL,p_mode TEXT DEFAULT 'PESSIMISTIC',p_version BIGINT DEFAULT NULL)
RETURNS TABLE(booking_id BIGINT,e_ticket VARCHAR(50))
LANGUAGE plpgsql SET search_path = flight_booking_test, pg_catalog AS $$
DECLARE v_reservation BIGINT;
BEGIN
  v_reservation:=hold_seat(p_schedule_id,p_seat_number,p_user_id,p_mode,p_version);
  RETURN QUERY SELECT * FROM checkout(v_reservation,p_user_id,p_sale_item_id);
END;
$$;

CREATE FUNCTION release_expired_reservations() RETURNS INTEGER
LANGUAGE plpgsql SET search_path = flight_booking_test, pg_catalog AS $$
DECLARE v_seat RECORD; v_rows INTEGER; v_total INTEGER:=0;
BEGIN
  FOR v_seat IN SELECT s.seat_id FROM flight_seats s WHERE s.status='HOLD'
    AND EXISTS(SELECT 1 FROM seat_reservations r WHERE r.seat_id=s.seat_id
      AND r.status='HOLDING' AND r.hold_expires_at<=clock_timestamp())
    ORDER BY s.seat_id FOR UPDATE OF s SKIP LOCKED
  LOOP
    UPDATE seat_reservations r SET status='EXPIRED' WHERE r.seat_id=v_seat.seat_id
      AND r.status='HOLDING' AND r.hold_expires_at<=clock_timestamp();
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows>0 THEN
      UPDATE flight_seats s SET status='AVAILABLE' WHERE s.seat_id=v_seat.seat_id AND s.status='HOLD';
      v_total:=v_total+v_rows;
    END IF;
  END LOOP;
  RETURN v_total;
END;
$$;
CREATE PROCEDURE sp_release_expired_reservations()
LANGUAGE plpgsql SET search_path = flight_booking_test, pg_catalog AS $$
BEGIN PERFORM release_expired_reservations(); END;
$$;

CREATE FUNCTION guard_seat_update() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = flight_booking_test, pg_catalog AS $$
BEGIN
  NEW.version:=OLD.version+1;
  IF OLD.status='BOOKED' AND NEW.status<>'BOOKED' THEN
    RAISE EXCEPTION USING ERRCODE='P2005',MESSAGE='Cannot reopen a ticketed seat';
  END IF;
  IF OLD.status IN ('HOLD','BOOKED') AND
    (NEW.schedule_id,NEW.seat_number,NEW.base_price,NEW.seat_class)
      IS DISTINCT FROM (OLD.schedule_id,OLD.seat_number,OLD.base_price,OLD.seat_class) THEN
    RAISE EXCEPTION USING ERRCODE='P2005',MESSAGE='Cannot change a held or ticketed seat';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_seat_version BEFORE UPDATE ON flight_seats FOR EACH ROW EXECUTE FUNCTION guard_seat_update();

CREATE FUNCTION guard_seat_capacity() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = flight_booking_test, pg_catalog AS $$
DECLARE v_flight BIGINT; v_aircraft BIGINT; v_capacity BIGINT; v_count BIGINT;
BEGIN
  SELECT s.flight_id INTO STRICT v_flight FROM flight_schedules s WHERE s.schedule_id=NEW.schedule_id FOR UPDATE NOWAIT;
  SELECT f.aircraft_id INTO STRICT v_aircraft FROM flights f WHERE f.flight_id=v_flight FOR UPDATE NOWAIT;
  SELECT a.capacity INTO STRICT v_capacity FROM aircrafts a WHERE a.aircraft_id=v_aircraft FOR UPDATE NOWAIT;
  SELECT COUNT(*) INTO v_count FROM flight_seats s WHERE s.schedule_id=NEW.schedule_id
    AND s.seat_id<>NEW.seat_id;
  IF v_count+1>v_capacity THEN RAISE EXCEPTION USING ERRCODE='P2007',MESSAGE='Schedule seat capacity exceeded'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_seat_capacity BEFORE INSERT OR UPDATE OF schedule_id ON flight_seats
FOR EACH ROW EXECUTE FUNCTION guard_seat_capacity();

CREATE FUNCTION guard_capacity_changes() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = flight_booking_test, pg_catalog AS $$
BEGIN
  IF TG_TABLE_NAME='aircrafts' THEN
    IF EXISTS(SELECT 1 FROM flight_schedules s JOIN flights f ON f.flight_id=s.flight_id
      JOIN flight_seats seats ON seats.schedule_id=s.schedule_id WHERE f.aircraft_id=OLD.aircraft_id
      GROUP BY s.schedule_id HAVING COUNT(*)>NEW.capacity) THEN
      RAISE EXCEPTION USING ERRCODE='P2007',MESSAGE='New capacity is below existing inventory';
    END IF;
  ELSIF TG_TABLE_NAME='flights' THEN
    IF NEW.aircraft_id IS DISTINCT FROM OLD.aircraft_id AND EXISTS(
      SELECT 1 FROM flight_seats seats JOIN flight_schedules s ON s.schedule_id=seats.schedule_id WHERE s.flight_id=OLD.flight_id) THEN
      RAISE EXCEPTION USING ERRCODE='P2007',MESSAGE='Cannot change aircraft after creating seat inventory';
    END IF;
  ELSIF TG_TABLE_NAME='flight_schedules' THEN
    IF NEW.flight_id IS DISTINCT FROM OLD.flight_id AND EXISTS(SELECT 1 FROM flight_seats WHERE schedule_id=OLD.schedule_id) THEN
      RAISE EXCEPTION USING ERRCODE='P2007',MESSAGE='Cannot change flight after creating seat inventory';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_aircraft_capacity BEFORE UPDATE OF capacity ON aircrafts FOR EACH ROW EXECUTE FUNCTION guard_capacity_changes();
CREATE TRIGGER trg_flight_aircraft BEFORE UPDATE OF aircraft_id ON flights FOR EACH ROW EXECUTE FUNCTION guard_capacity_changes();
CREATE TRIGGER trg_schedule_flight BEFORE UPDATE OF flight_id ON flight_schedules FOR EACH ROW EXECUTE FUNCTION guard_capacity_changes();

CREATE FUNCTION audit_booking_status() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = flight_booking_test, pg_catalog AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO booking_logs(booking_id,old_status,new_status) VALUES(NEW.booking_id,OLD.status,NEW.status);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_booking_audit AFTER UPDATE OF status ON bookings FOR EACH ROW EXECUTE FUNCTION audit_booking_status();

CREATE FUNCTION guard_flash_sale_quota() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = flight_booking_test, pg_catalog AS $$
BEGIN
  IF NEW.sold_count<0 OR NEW.sold_count>NEW.quota THEN
    RAISE EXCEPTION USING ERRCODE='P2006',MESSAGE='Invalid flash sale quota';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_flash_sale_quota BEFORE INSERT OR UPDATE ON flash_sale_items
FOR EACH ROW EXECUTE FUNCTION guard_flash_sale_quota();


CREATE TABLE project_diagnostics (
  diagnostic_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category VARCHAR(20) NOT NULL,
  check_name VARCHAR(100) NOT NULL,
  status VARCHAR(10) NOT NULL CHECK(status IN ('PASS','INFO','WARN','FAIL')),
  details TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

DO $$
DECLARE
  v_user BIGINT; v_other BIGINT; v_sgn BIGINT; v_han BIGINT; v_dad BIGINT; v_pqc BIGINT;
  v_aircraft BIGINT; v_flight BIGINT; v_schedule BIGINT; v_sale BIGINT;
  v_schedules BIGINT[]:='{}'; v_items BIGINT[]:='{}'; v_item BIGINT;
  v_origin BIGINT; v_dest BIGINT; v_number TEXT;
BEGIN
  INSERT INTO users(username,email,password_hash,role) VALUES('admin','admin@airline.test',
    '$2b$10$MmgaWpQlr1mNcecDFFg27uze0Dl7ZTrj0HXYIPu.SQUQ/zrJx4NL6','ADMIN');
  INSERT INTO users(username,email,password_hash,role) VALUES('nguyenvanan','an@airline.test',
    '$2b$10$s0QNs/u9qmYHufLvj3wG5erHk9NlGG/9K15FRpHTWffOvG9LrkjAG','USER') RETURNING user_id INTO v_user;
  INSERT INTO users(username,email,password_hash,role) VALUES('tranthibinh','binh@airline.test',
    '$2b$10$s0QNs/u9qmYHufLvj3wG5erHk9NlGG/9K15FRpHTWffOvG9LrkjAG','USER') RETURNING user_id INTO v_other;
  INSERT INTO airports(code,name,city,country) VALUES('SGN','Tan Son Nhat','TP. Ho Chi Minh','Viet Nam') RETURNING airport_id INTO v_sgn;
  INSERT INTO airports(code,name,city,country) VALUES('HAN','Noi Bai','Ha Noi','Viet Nam') RETURNING airport_id INTO v_han;
  INSERT INTO airports(code,name,city,country) VALUES('DAD','Da Nang','Da Nang','Viet Nam') RETURNING airport_id INTO v_dad;
  INSERT INTO airports(code,name,city,country) VALUES('PQC','Phu Quoc','Phu Quoc','Viet Nam') RETURNING airport_id INTO v_pqc;
  INSERT INTO aircrafts(model,capacity) VALUES('Airbus A321 - Demo 12 seats',12) RETURNING aircraft_id INTO v_aircraft;
  FOR i IN 1..4 LOOP
    IF i=1 THEN v_origin:=v_sgn; v_dest:=v_han; v_number:='VN120';
    ELSIF i=2 THEN v_origin:=v_han; v_dest:=v_sgn; v_number:='VN121';
    ELSIF i=3 THEN v_origin:=v_sgn; v_dest:=v_dad; v_number:='VN230';
    ELSE v_origin:=v_sgn; v_dest:=v_pqc; v_number:='VN780'; END IF;
    INSERT INTO flights(flight_number,aircraft_id,origin_airport_id,destination_airport_id,duration)
      VALUES(v_number,v_aircraft,v_origin,v_dest,INTERVAL '2 hours') RETURNING flight_id INTO v_flight;
    FOR j IN 1..2 LOOP
      INSERT INTO flight_schedules(flight_id,departure_time,arrival_time)
        VALUES(v_flight,clock_timestamp()+make_interval(days=>7+i+j),
          clock_timestamp()+make_interval(days=>7+i+j,hours=>2)) RETURNING schedule_id INTO v_schedule;
      v_schedules:=array_append(v_schedules,v_schedule);
      FOR row_num IN 1..2 LOOP
        FOR col_num IN 1..6 LOOP
          INSERT INTO flight_seats(schedule_id,seat_number,seat_class,base_price,status)
            VALUES(v_schedule,row_num::TEXT||substr('ABCDEF',col_num,1),
              CASE WHEN row_num=1 THEN 'BUSINESS' ELSE 'ECONOMY' END,
              CASE WHEN row_num=1 THEN 4500000 ELSE 1850000 END,'AVAILABLE');
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
  INSERT INTO flash_sales(start_time,end_time,status)
    VALUES(clock_timestamp()-INTERVAL '1 hour',clock_timestamp()+INTERVAL '7 days','ACTIVE') RETURNING flash_sale_id INTO v_sale;
  FOR i IN 1..8 LOOP
    INSERT INTO flash_sale_items(flash_sale_id,schedule_id,sale_price,quota)
      VALUES(v_sale,v_schedules[i],199000+i*10000,3) RETURNING flash_sale_item_id INTO v_item;
    v_items:=array_append(v_items,v_item);
  END LOOP;
  INSERT INTO passengers(user_id,first_name,last_name,passport_number) VALUES(v_user,'Van An','Nguyen','DEMO-C12345678');
  INSERT INTO passengers(user_id,first_name,last_name,passport_number) VALUES(v_other,'Thi Binh','Tran','DEMO-B87654321');
  PERFORM book_seat(v_schedules[1],'1A',v_user);
  PERFORM book_seat(v_schedules[2],'2A',v_user);
  PERFORM book_seat(v_schedules[3],'2B',v_other,v_items[3]);
  INSERT INTO project_diagnostics(category,check_name,status,details)
    VALUES('INSTALL','SEED','PASS','3 users, 4 flights, 8 schedules, 96 seats, 8 sale items, 3 paid bookings.');
END;
$$;

CREATE FUNCTION test_check(p_ok BOOLEAN,p_message TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION USING ERRCODE='PT999',MESSAGE=p_message; END IF;
END;
$$;

-- Each successful test raises/catches PT001 to roll back its data subtransaction.
-- Unexpected failures abort the full install transaction; no false PASS is stored.
DO $$
DECLARE
  v_user BIGINT; v_other BIGINT; v_schedule BIGINT; v_wrong BIGINT; v_item BIGINT; v_sale BIGINT;
  v_aircraft BIGINT; v_seat BIGINT; v_version BIGINT; v_res BIGINT;
  v_paid RECORD; v_count BIGINT; v_amount NUMERIC; v_status TEXT;
  v_names TEXT[]:=ARRAY['ATOMIC_CHECKOUT','OPTIMISTIC_CAS','OWNER_AND_AMOUNT','EXPIRED_HOLD',
    'FINAL_QUOTA_AND_FREE_TICKET','SALE_TIME_WINDOW','DEPARTED_FLIGHT','CAPACITY_AND_FK',
    'UNIQUE_TICKET_AND_REOPEN','INVALID_USER_ROLLBACK','SKIP_LOCKED_AUTO_ALLOCATE','SALE_SCHEDULE_AND_NEGATIVE_VALUES'];
BEGIN
  SELECT user_id INTO STRICT v_user FROM users WHERE username='nguyenvanan';
  SELECT user_id INTO STRICT v_other FROM users WHERE username='tranthibinh';
  SELECT max(schedule_id),min(schedule_id) INTO v_schedule,v_wrong FROM flight_schedules;
  SELECT flash_sale_item_id,flash_sale_id INTO STRICT v_item,v_sale FROM flash_sale_items WHERE schedule_id=v_schedule;
  SELECT seat_id,version INTO STRICT v_seat,v_version FROM flight_seats WHERE schedule_id=v_schedule AND seat_number='2F';
  SELECT aircraft_id INTO STRICT v_aircraft FROM aircrafts LIMIT 1;
  FOR case_no IN 1..12 LOOP
    BEGIN
      CASE case_no
      WHEN 1 THEN
        v_res:=hold_seat(v_schedule,'2F',v_user);
        SELECT * INTO v_paid FROM checkout(v_res,v_user);
        SELECT count(*) INTO v_count FROM tickets WHERE reservation_id=v_res AND booking_id=v_paid.booking_id;
        PERFORM test_check(v_count=1,'T01 ticket missing');
        SELECT count(*) INTO v_count FROM payments WHERE booking_id=v_paid.booking_id AND amount=1850000 AND status='COMPLETED';
        PERFORM test_check(v_count=1,'T01 payment missing');
        SELECT count(*) INTO v_count FROM booking_logs WHERE booking_id=v_paid.booking_id AND new_status='CONFIRMED';
        PERFORM test_check(v_count=1,'T01 audit missing');
        SELECT version INTO v_count FROM flight_seats WHERE seat_id=v_seat;
        PERFORM test_check(v_count=v_version+2,'T01 wrong version increments');
        BEGIN PERFORM checkout(v_res,v_user); RAISE SQLSTATE 'PT999' USING MESSAGE='Repeated checkout accepted';
        EXCEPTION WHEN SQLSTATE 'P2004' THEN NULL; END;
      WHEN 2 THEN
        BEGIN PERFORM hold_seat(v_schedule,'2F',v_user,'OPTIMISTIC',v_version+100);
          RAISE SQLSTATE 'PT999' USING MESSAGE='Stale version accepted';
        EXCEPTION WHEN SQLSTATE 'P2003' THEN NULL; END;
        v_res:=hold_seat(v_schedule,'2F',v_user,'OPTIMISTIC',v_version);
        SELECT status INTO v_status FROM flight_seats WHERE seat_id=v_seat;
        PERFORM test_check(v_status='HOLD','Valid CAS failed');
      WHEN 3 THEN
        v_res:=hold_seat(v_schedule,'2F',v_user);
        BEGIN PERFORM checkout(v_res,v_other); RAISE SQLSTATE 'PT999' USING MESSAGE='Wrong owner accepted';
        EXCEPTION WHEN SQLSTATE 'P2010' THEN NULL; END;
        BEGIN PERFORM checkout(v_res,v_user,NULL,1); RAISE SQLSTATE 'PT999' USING MESSAGE='Wrong amount accepted';
        EXCEPTION WHEN SQLSTATE 'P2012' THEN NULL; END;
        SELECT status INTO v_status FROM seat_reservations WHERE reservation_id=v_res;
        PERFORM test_check(v_status='HOLDING','Rejected checkout changed hold');
      WHEN 4 THEN
        v_res:=hold_seat(v_schedule,'2F',v_user);
        UPDATE seat_reservations SET hold_expires_at=clock_timestamp()-INTERVAL '1 second' WHERE reservation_id=v_res;
        BEGIN PERFORM checkout(v_res,v_user); RAISE SQLSTATE 'PT999' USING MESSAGE='Expired hold accepted';
        EXCEPTION WHEN SQLSTATE 'P2004' THEN NULL; END;
        PERFORM release_expired_reservations();
        SELECT status INTO v_status FROM flight_seats WHERE seat_id=v_seat;
        PERFORM test_check(v_status='AVAILABLE','Expired seat not released');
        SELECT status INTO v_status FROM seat_reservations WHERE reservation_id=v_res;
        PERFORM test_check(v_status='EXPIRED','Hold not marked expired');
      WHEN 5 THEN
        UPDATE flash_sale_items SET quota=sold_count+1,sale_price=0 WHERE flash_sale_item_id=v_item;
        SELECT * INTO v_paid FROM book_seat(v_schedule,'2F',v_user,v_item);
        SELECT total_amount INTO v_amount FROM bookings WHERE booking_id=v_paid.booking_id;
        PERFORM test_check(v_amount=0,'Free ticket price was lost');
        BEGIN PERFORM book_seat(v_schedule,'2E',v_user,v_item); RAISE SQLSTATE 'PT999' USING MESSAGE='Exceeded quota';
        EXCEPTION WHEN SQLSTATE 'P2006' THEN NULL; END;
        SELECT status INTO v_status FROM flight_seats WHERE schedule_id=v_schedule AND seat_number='2E';
        PERFORM test_check(v_status='AVAILABLE','Failed booking leaked a HOLD');
      WHEN 6 THEN
        UPDATE flash_sales SET start_time=clock_timestamp()+INTERVAL '1 hour' WHERE flash_sale_id=v_sale;
        BEGIN PERFORM book_seat(v_schedule,'2F',v_user,v_item); RAISE SQLSTATE 'PT999' USING MESSAGE='Future sale accepted';
        EXCEPTION WHEN SQLSTATE 'P2011' THEN NULL; END;
        UPDATE flash_sales SET start_time=clock_timestamp()-INTERVAL '2 hours',end_time=clock_timestamp()-INTERVAL '1 hour' WHERE flash_sale_id=v_sale;
        BEGIN PERFORM book_seat(v_schedule,'2F',v_user,v_item); RAISE SQLSTATE 'PT999' USING MESSAGE='Ended sale accepted';
        EXCEPTION WHEN SQLSTATE 'P2011' THEN NULL; END;
      WHEN 7 THEN
        UPDATE flight_schedules SET departure_time=clock_timestamp()-INTERVAL '2 hours',arrival_time=clock_timestamp()-INTERVAL '1 hour' WHERE schedule_id=v_schedule;
        BEGIN PERFORM hold_seat(v_schedule,'2F',v_user); RAISE SQLSTATE 'PT999' USING MESSAGE='Departed flight accepted';
        EXCEPTION WHEN SQLSTATE 'P2008' THEN NULL; END;
      WHEN 8 THEN
        BEGIN INSERT INTO flight_seats(schedule_id,seat_number,seat_class,base_price,status) VALUES(v_schedule,'3A','ECONOMY',1,'AVAILABLE');
          RAISE SQLSTATE 'PT999' USING MESSAGE='Capacity exceeded';
        EXCEPTION WHEN SQLSTATE 'P2007' THEN NULL; END;
        BEGIN INSERT INTO seat_reservations(schedule_id,seat_id,user_id,hold_expires_at,status)
          VALUES(v_wrong,v_seat,v_user,clock_timestamp()+INTERVAL '10 minutes','HOLDING');
          RAISE SQLSTATE 'PT999' USING MESSAGE='Mismatched schedule accepted';
        EXCEPTION WHEN foreign_key_violation THEN NULL; END;
      WHEN 9 THEN
        SELECT * INTO v_paid FROM book_seat(v_schedule,'2F',v_user);
        BEGIN INSERT INTO tickets(booking_id,seat_id,e_ticket_number) VALUES(v_paid.booking_id,v_seat,'SMOKE-DUPLICATE');
          RAISE SQLSTATE 'PT999' USING MESSAGE='Duplicate ticket accepted';
        EXCEPTION WHEN unique_violation THEN NULL; END;
        BEGIN UPDATE flight_seats SET status='AVAILABLE' WHERE seat_id=v_seat;
          RAISE SQLSTATE 'PT999' USING MESSAGE='Reopening ticketed seat accepted';
        EXCEPTION WHEN SQLSTATE 'P2005' THEN NULL; END;
        BEGIN UPDATE aircrafts SET capacity=11 WHERE aircraft_id=v_aircraft;
          RAISE SQLSTATE 'PT999' USING MESSAGE='Capacity reduction accepted';
        EXCEPTION WHEN SQLSTATE 'P2007' THEN NULL; END;
      WHEN 10 THEN
        BEGIN PERFORM hold_seat(v_schedule,'2F',-1); RAISE SQLSTATE 'PT999' USING MESSAGE='Unknown user accepted';
        EXCEPTION WHEN foreign_key_violation THEN NULL; END;
        SELECT status INTO v_status FROM flight_seats WHERE seat_id=v_seat;
        PERFORM test_check(v_status='AVAILABLE','Failed hold left partial changes');
      WHEN 11 THEN
        v_res:=hold_auto_seat_skip_locked(v_schedule,v_user,'ECONOMY');
        SELECT count(*) INTO v_count FROM seat_reservations WHERE reservation_id=v_res AND status='HOLDING';
        PERFORM test_check(v_count=1,'Auto allocation did not create a hold');
      WHEN 12 THEN
        BEGIN PERFORM book_seat(v_wrong,'2F',v_user,v_item); RAISE SQLSTATE 'PT999' USING MESSAGE='Wrong sale schedule accepted';
        EXCEPTION WHEN SQLSTATE 'P2004' THEN NULL; END;
        BEGIN UPDATE flash_sale_items SET quota=-1 WHERE flash_sale_item_id=v_item;
          RAISE SQLSTATE 'PT999' USING MESSAGE='Negative quota accepted';
        EXCEPTION WHEN SQLSTATE 'P2006' OR check_violation THEN NULL; END;
      END CASE;
      RAISE SQLSTATE 'PT001' USING MESSAGE='Rollback successful test changes';
    EXCEPTION WHEN SQLSTATE 'PT001' THEN NULL;
    END;
    INSERT INTO project_diagnostics(category,check_name,status,details)
      VALUES('TEST',v_names[case_no],'PASS','Executed on PostgreSQL; test changes rolled back by a PL/pgSQL subtransaction.');
  END LOOP;
END;
$$;


ANALYZE flight_schedules;
ANALYZE flights;
ANALYZE seat_reservations;

-- Both plans execute real SELECTs. Baseline disables index access only locally;
-- after restores original settings. Tiny demo data may correctly use sequential scans.
DO $$
DECLARE
  v_plan JSONB; v_query TEXT; v_before TEXT; v_after TEXT;
  v_indexscan TEXT:=current_setting('enable_indexscan');
  v_indexonly TEXT:=current_setting('enable_indexonlyscan');
  v_bitmap TEXT:=current_setting('enable_bitmapscan');
BEGIN
  FOR query_no IN 1..2 LOOP
    IF query_no=1 THEN
      v_query:='SELECT s.schedule_id,s.departure_time,f.flight_number
        FROM flight_booking_test.flight_schedules s JOIN flight_booking_test.flights f ON f.flight_id=s.flight_id
        WHERE s.departure_time>=CURRENT_TIMESTAMP AND s.departure_time<CURRENT_TIMESTAMP+INTERVAL ''14 days''
          AND f.origin_airport_id=(SELECT airport_id FROM flight_booking_test.airports WHERE code=''SGN'')
        ORDER BY s.departure_time';
    ELSE
      v_query:='SELECT reservation_id,seat_id FROM flight_booking_test.seat_reservations
        WHERE status=''HOLDING'' AND hold_expires_at<=CURRENT_TIMESTAMP';
    END IF;
    PERFORM set_config('enable_indexscan','off',TRUE);
    PERFORM set_config('enable_indexonlyscan','off',TRUE);
    PERFORM set_config('enable_bitmapscan','off',TRUE);
    EXECUTE 'EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '||v_query INTO v_plan;
    INSERT INTO project_diagnostics(category,check_name,status,details)
      VALUES('PLAN','Q'||query_no||'_BEFORE','INFO',jsonb_pretty(v_plan));
    PERFORM set_config('enable_indexscan',v_indexscan,TRUE);
    PERFORM set_config('enable_indexonlyscan',v_indexonly,TRUE);
    PERFORM set_config('enable_bitmapscan',v_bitmap,TRUE);
    EXECUTE 'EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '||v_query INTO v_plan;
    INSERT INTO project_diagnostics(category,check_name,status,details)
      VALUES('PLAN','Q'||query_no||'_AFTER','INFO',jsonb_pretty(v_plan));
  END LOOP;
END;
$$;

CREATE VIEW vw_project_integrity AS
SELECT 'DUPLICATE_TICKET_SEAT'::TEXT AS check_name,count(*) AS anomaly_count
  FROM (SELECT seat_id FROM tickets GROUP BY seat_id HAVING count(*)>1) q
UNION ALL SELECT 'DUPLICATE_ACTIVE_HOLD',count(*)
  FROM (SELECT seat_id FROM seat_reservations WHERE status='HOLDING' GROUP BY seat_id HAVING count(*)>1) q
UNION ALL SELECT 'RESERVATION_SEAT_MISMATCH',count(*)
  FROM seat_reservations r JOIN flight_seats s ON s.seat_id=r.seat_id
  WHERE r.schedule_id<>s.schedule_id OR (r.status='HOLDING' AND s.status<>'HOLD') OR (r.status='CONFIRMED' AND s.status<>'BOOKED')
UNION ALL SELECT 'TICKET_SEAT_NOT_BOOKED',count(*)
  FROM tickets t JOIN flight_seats s ON s.seat_id=t.seat_id WHERE s.status<>'BOOKED'
UNION ALL SELECT 'CAPACITY_EXCEEDED',count(*) FROM (
  SELECT s.schedule_id FROM flight_schedules s JOIN flights f ON f.flight_id=s.flight_id
    JOIN aircrafts a ON a.aircraft_id=f.aircraft_id JOIN flight_seats seats ON seats.schedule_id=s.schedule_id
  GROUP BY s.schedule_id,a.capacity HAVING count(*)>a.capacity) q
UNION ALL SELECT 'SALE_TICKET_COUNT_MISMATCH',count(*) FROM (
  SELECT i.flash_sale_item_id FROM flash_sale_items i LEFT JOIN tickets t ON t.flash_sale_item_id=i.flash_sale_item_id
  GROUP BY i.flash_sale_item_id,i.sold_count,i.quota
  HAVING count(t.ticket_id)<>i.sold_count OR i.sold_count>i.quota OR i.sold_count<0) q
UNION ALL SELECT 'PAYMENT_AMOUNT_MISMATCH',count(*) FROM (
  SELECT b.booking_id FROM bookings b LEFT JOIN payments p ON p.booking_id=b.booking_id AND p.status='COMPLETED'
  WHERE b.status='CONFIRMED' GROUP BY b.booking_id,b.total_amount
  HAVING count(p.payment_id)<>1 OR sum(p.amount)<>b.total_amount) q
UNION ALL SELECT 'BOOKED_SEAT_WITHOUT_TICKET',count(*) FROM flight_seats s
  WHERE s.status='BOOKED' AND NOT EXISTS(SELECT 1 FROM tickets t WHERE t.seat_id=s.seat_id);

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM vw_project_integrity WHERE anomaly_count<>0) THEN
    RAISE EXCEPTION 'Integrity checks failed';
  END IF;
  IF (SELECT count(*) FROM project_diagnostics WHERE category='TEST' AND status='PASS')<>12 THEN
    RAISE EXCEPTION 'Expected 12 successful smoke tests';
  END IF;
  INSERT INTO project_diagnostics(category,check_name,status,details)
    VALUES('INSTALL','CORE_CHECKS','PASS','12 smoke cases passed, 8 integrity counts zero, 4 real execution plans captured. Multi-session concurrency needs a native PostgreSQL server.');
END;
$$;
COMMIT;

SELECT category,check_name,status,details FROM flight_booking_test.project_diagnostics ORDER BY diagnostic_id;
SELECT * FROM flight_booking_test.vw_project_integrity ORDER BY check_name;
SELECT b.booking_id,u.username,t.e_ticket_number,f.flight_number,s.seat_number,b.total_amount,b.status
FROM flight_booking_test.bookings b JOIN flight_booking_test.users u ON u.user_id=b.user_id
JOIN flight_booking_test.tickets t ON t.booking_id=b.booking_id
JOIN flight_booking_test.flight_seats s ON s.seat_id=t.seat_id
JOIN flight_booking_test.flight_schedules sch ON sch.schedule_id=s.schedule_id
JOIN flight_booking_test.flights f ON f.flight_id=sch.flight_id ORDER BY b.booking_id;

-- EXAMPLE ONLY (not executed): one atomic booking, with IDs queried from your data:
-- SELECT * FROM flight_booking_test.book_seat(schedule_id,'2F',user_id);
-- Hold and pay separately: SELECT flight_booking_test.hold_seat(...);
-- SELECT * FROM flight_booking_test.checkout(reservation_id,user_id,sale_item_id);
-- CALL flight_booking_test.sp_release_expired_reservations();
-- Error P2002: lock busy; 40001: serialization failure; retry the WHOLE transaction.
