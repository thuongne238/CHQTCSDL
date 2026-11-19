import { PGlite } from '@electric-sql/pglite';
import { readFile, mkdir, open, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

export const root=path.dirname(fileURLToPath(import.meta.url));

// Tự động nạp cấu hình từ file .env trong thư mục dự án
const envPath=path.join(root,'.env');
if(existsSync(envPath)){
  for(const line of readFileSync(envPath,'utf8').split(/\r?\n/)){
    const trimmed=line.trim();
    if(!trimmed||trimmed.startsWith('#'))continue;
    const eq=trimmed.indexOf('=');
    if(eq>0){
      const key=trimmed.slice(0,eq).trim();
      const val=trimmed.slice(eq+1).trim();
      if(!(key in process.env))process.env[key]=val;
    }
  }
}
const require=createRequire(import.meta.url);
let oracledb=null;
try {
  oracledb=require('oracledb');
} catch {
  try { oracledb=require('../flight-booking-app/node_modules/oracledb'); } catch {}
}

export function mapOracleError(err) {
  const msg=String(err?.message||'');
  const m=msg.match(/ORA-(200\d\d):\s*([^\n\r]+)/);
  if(m){
    const num=Number(m[1]);
    if(num>=20001&&num<=20012){
      const e=new Error(m[2].trim());
      e.code='P'+String(num);
      e.oraCode='ORA-'+String(num);
      return e;
    }
  }
  if(msg.includes('ORA-00054')){const e=new Error('Ghế đang được xử lý. Hãy tải lại và thử lại.');e.code='P2002';return e;}
  if(msg.includes('ORA-00001')){const e=new Error('Thông tin bị trùng hoặc ghế đã có vé.');e.code='23505';return e;}
  if(msg.includes('ORA-02291')||msg.includes('ORA-02292')){const e=new Error('Không tìm thấy dữ liệu liên quan.');e.code='23503';return e;}
  if(msg.includes('ORA-02290')){const e=new Error('Dữ liệu vi phạm ràng buộc toàn vẹn.');e.code='23514';return e;}
  return err;
}

async function attachOracleBridge(db) {
  if(!oracledb||process.env.DISABLE_ORACLE==='true')return;
  const host=process.env.DB_HOST||'192.168.2.27';
  const port=process.env.DB_PORT||'1521';
  const service=process.env.DB_SERVICE||'FREEPDB1';
  const config={
    user:process.env.DB_USER||'PDBADMIN',
    password:process.env.DB_PASSWORD||'Oracle123',
    connectString:process.env.DB_CONNECTION_STRING||`${host}:${port}/${service}`
  };
  let pool;
  try {
    pool=await oracledb.createPool({...config,poolMin:1,poolMax:10,poolIncrement:1,queueTimeout:10000});
    const testConn=await pool.getConnection();
    await testConn.execute('SELECT 1 FROM DUAL');
    await testConn.close();
  } catch(err) {
    console.warn('Oracle bridge unavailable, falling back to embedded DB:',err.message);
    if(pool)await pool.close(0).catch(()=>{});
    return;
  }

  db.oraclePool=pool;
  db.oracleInfo=`Oracle 23ai @ ${config.connectString} (${config.user})`;
  db.oracledb=oracledb;

  db.syncFromOracle=async()=>{
    const conn=await pool.getConnection();
    try {
      const opt={outFormat:oracledb.OUT_FORMAT_OBJECT};
      const [users,airports,aircrafts,flights,schedules,seats,reservations,sales,saleItems,passengers,bookings,tickets,payments,logs]=await Promise.all([
        conn.execute('SELECT user_id,username,email,password_hash,role FROM users ORDER BY user_id',[],opt),
        conn.execute('SELECT airport_id,code,name,city,country FROM airports ORDER BY airport_id',[],opt),
        conn.execute('SELECT aircraft_id,model,capacity FROM aircrafts ORDER BY aircraft_id',[],opt),
        conn.execute("SELECT flight_id,flight_number,aircraft_id,origin_airport_id,destination_airport_id, ROUND((EXTRACT(DAY FROM duration)*1440 + EXTRACT(HOUR FROM duration)*60 + EXTRACT(MINUTE FROM duration))) AS dur_mins FROM flights ORDER BY flight_id",[],opt),
        conn.execute('SELECT schedule_id,flight_id,departure_time,arrival_time FROM flight_schedules ORDER BY schedule_id',[],opt),
        conn.execute('SELECT seat_id,schedule_id,seat_number,seat_class,base_price,status,version FROM flight_seats ORDER BY seat_id',[],opt),
        conn.execute('SELECT reservation_id,schedule_id,seat_id,user_id,hold_expires_at,status,quoted_price FROM seat_reservations ORDER BY reservation_id',[],opt),
        conn.execute('SELECT flash_sale_id,start_time,end_time,status FROM flash_sales ORDER BY flash_sale_id',[],opt),
        conn.execute('SELECT flash_sale_item_id,flash_sale_id,schedule_id,sale_price,quota,sold_count,version FROM flash_sale_items ORDER BY flash_sale_item_id',[],opt),
        conn.execute('SELECT passenger_id,user_id,first_name,last_name,passport_number FROM passengers ORDER BY passenger_id',[],opt),
        conn.execute('SELECT booking_id,user_id,created_at,total_amount,status FROM bookings ORDER BY booking_id',[],opt),
        conn.execute('SELECT ticket_id,booking_id,seat_id,e_ticket_number,reservation_id,flash_sale_item_id FROM tickets ORDER BY ticket_id',[],opt),
        conn.execute('SELECT payment_id,booking_id,amount,payment_date,status FROM payments ORDER BY payment_id',[],opt),
        conn.execute('SELECT log_id,booking_id,old_status,new_status,changed_at FROM booking_logs ORDER BY log_id',[],opt)
      ]);

      await db.transaction(async tx=>{
        await tx.query("SET LOCAL session_replication_role = 'replica'");
        await tx.query(`TRUNCATE flight_booking_test.booking_logs, flight_booking_test.payments, flight_booking_test.tickets,
          flight_booking_test.bookings, flight_booking_test.passengers, flight_booking_test.flash_sale_items,
          flight_booking_test.flash_sales, flight_booking_test.seat_reservations, flight_booking_test.flight_seats,
          flight_booking_test.flight_schedules, flight_booking_test.flights, flight_booking_test.aircrafts,
          flight_booking_test.airports, flight_booking_test.users CASCADE`);

        for(const r of users.rows)await tx.query('INSERT INTO flight_booking_test.users(user_id,username,email,password_hash,role) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4,$5)',[r.USER_ID,r.USERNAME,r.EMAIL,r.PASSWORD_HASH,r.ROLE]);
        for(const r of airports.rows)await tx.query('INSERT INTO flight_booking_test.airports(airport_id,code,name,city,country) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4,$5)',[r.AIRPORT_ID,r.CODE,r.NAME,r.CITY,r.COUNTRY]);
        for(const r of aircrafts.rows)await tx.query('INSERT INTO flight_booking_test.aircrafts(aircraft_id,model,capacity) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3)',[r.AIRCRAFT_ID,r.MODEL,r.CAPACITY]);
        for(const r of flights.rows)await tx.query('INSERT INTO flight_booking_test.flights(flight_id,flight_number,aircraft_id,origin_airport_id,destination_airport_id,duration) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4,$5,make_interval(mins=>$6))',[r.FLIGHT_ID,r.FLIGHT_NUMBER,r.AIRCRAFT_ID,r.ORIGIN_AIRPORT_ID,r.DESTINATION_AIRPORT_ID,Number(r.DUR_MINS||120)]);
        for(const r of schedules.rows)await tx.query('INSERT INTO flight_booking_test.flight_schedules(schedule_id,flight_id,departure_time,arrival_time) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4)',[r.SCHEDULE_ID,r.FLIGHT_ID,r.DEPARTURE_TIME,r.ARRIVAL_TIME]);
        for(const r of seats.rows)await tx.query('INSERT INTO flight_booking_test.flight_seats(seat_id,schedule_id,seat_number,seat_class,base_price,status,version) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4,$5,$6,$7)',[r.SEAT_ID,r.SCHEDULE_ID,r.SEAT_NUMBER,r.SEAT_CLASS,r.BASE_PRICE,r.STATUS,r.VERSION]);
        for(const r of reservations.rows)await tx.query('INSERT INTO flight_booking_test.seat_reservations(reservation_id,schedule_id,seat_id,user_id,hold_expires_at,status,quoted_price) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4,$5,$6,$7)',[r.RESERVATION_ID,r.SCHEDULE_ID,r.SEAT_ID,r.USER_ID,r.HOLD_EXPIRES_AT,r.STATUS,r.QUOTED_PRICE]);
        for(const r of sales.rows)await tx.query('INSERT INTO flight_booking_test.flash_sales(flash_sale_id,start_time,end_time,status) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4)',[r.FLASH_SALE_ID,r.START_TIME,r.END_TIME,r.STATUS]);
        for(const r of saleItems.rows)await tx.query('INSERT INTO flight_booking_test.flash_sale_items(flash_sale_item_id,flash_sale_id,schedule_id,sale_price,quota,sold_count,version) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4,$5,$6,$7)',[r.FLASH_SALE_ITEM_ID,r.FLASH_SALE_ID,r.SCHEDULE_ID,r.SALE_PRICE,r.QUOTA,r.SOLD_COUNT,r.VERSION]);
        for(const r of passengers.rows)await tx.query('INSERT INTO flight_booking_test.passengers(passenger_id,user_id,first_name,last_name,passport_number) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4,$5)',[r.PASSENGER_ID,r.USER_ID,r.FIRST_NAME,r.LAST_NAME,r.PASSPORT_NUMBER]);
        for(const r of bookings.rows)await tx.query('INSERT INTO flight_booking_test.bookings(booking_id,user_id,created_at,total_amount,status) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4,$5)',[r.BOOKING_ID,r.USER_ID,r.CREATED_AT,r.TOTAL_AMOUNT,r.STATUS]);
        for(const r of tickets.rows)await tx.query('INSERT INTO flight_booking_test.tickets(ticket_id,booking_id,seat_id,e_ticket_number,reservation_id,flash_sale_item_id) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4,$5,$6)',[r.TICKET_ID,r.BOOKING_ID,r.SEAT_ID,r.E_TICKET_NUMBER,r.RESERVATION_ID,r.FLASH_SALE_ITEM_ID]);
        for(const r of payments.rows)await tx.query('INSERT INTO flight_booking_test.payments(payment_id,booking_id,amount,payment_date,status) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4,$5)',[r.PAYMENT_ID,r.BOOKING_ID,r.AMOUNT,r.PAYMENT_DATE,r.STATUS]);
        for(const r of logs.rows)await tx.query('INSERT INTO flight_booking_test.booking_logs(log_id,booking_id,old_status,new_status,changed_at) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4,$5)',[r.LOG_ID,r.BOOKING_ID,r.OLD_STATUS,r.NEW_STATUS,r.CHANGED_AT]);
        await tx.query("SET LOCAL session_replication_role = 'origin'");
      });
    } finally {
      await conn.close();
    }
  };

  db.execOracle=async(fn)=>{
    const conn=await pool.getConnection();
    try {
      const result=await fn(conn,oracledb);
      await conn.commit();
      await db.syncFromOracle();
      return result;
    } catch(err) {
      await conn.rollback().catch(()=>{});
      throw mapOracleError(err);
    } finally {
      await conn.close();
    }
  };

  const origClose=db.close.bind(db);
  db.close=async()=>{
    await pool.close(2).catch(()=>{});
    return origClose();
  };

  await db.syncFromOracle();
  console.log(`Đã đồng bộ trực tiếp với ${db.oracleInfo}`);
}

export async function createDatabase(dataDir) {
  const db=new PGlite(dataDir);
  await db.waitReady;
  try {
    const exists=await db.query("SELECT to_regnamespace('flight_booking_test')::TEXT AS schema");
    if(!exists.rows[0].schema)await db.exec(await readFile(path.join(root,'database.sql'),'utf8'));
    const ready=await db.query("SELECT 1 FROM flight_booking_test.project_diagnostics WHERE check_name='CORE_CHECKS' AND status='PASS'");
    if(!ready.rows.length)throw new Error('CSDL chưa khởi tạo xong. Dữ liệu được giữ nguyên.');
    if(dataDir)await attachOracleBridge(db);
    return db;
  } catch(error){await db.close();throw error;}
}

export async function runIsolatedChecks() {
  const db=await createDatabase();
  try {
    const [tests,integrity,plans,version]=await Promise.all([
      db.query("SELECT check_name,status,details FROM flight_booking_test.project_diagnostics WHERE category='TEST' ORDER BY diagnostic_id"),
      db.query('SELECT * FROM flight_booking_test.vw_project_integrity ORDER BY check_name'),
      db.query("SELECT check_name,details FROM flight_booking_test.project_diagnostics WHERE category='PLAN' ORDER BY diagnostic_id"),
      db.query('SELECT version() AS version')]);
    return {tests:tests.rows,integrity:integrity.rows,plans:plans.rows,version:version.rows[0].version,
      isolated:true,concurrencyTested:false};
  } finally {await db.close();}
}

export async function claimRuntime() {
  const runtime=path.join(root,'runtime');
  await mkdir(runtime,{recursive:true});
  const lock=path.join(runtime,'web.lock');
  try {const old=JSON.parse(await readFile(lock,'utf8'));try{process.kill(old.pid,0);throw new Error('Web test đã chạy. Mở http://localhost:3001 hoặc dừng bản đang chạy trước.');}catch(error){if(error.code!=='ESRCH')throw error;}await rm(lock);}
  catch(error){if(error.code!=='ENOENT')throw error;}
  const handle=await open(lock,'wx');
  await handle.writeFile(JSON.stringify({pid:process.pid}));await handle.close();
  return async()=>rm(lock,{force:true});
}
