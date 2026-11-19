import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes,randomUUID } from 'node:crypto';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { root,runIsolatedChecks } from './database.mjs';

const messages={P2001:'Ghế không còn trống hoặc không tồn tại.',P2002:'Ghế đang được xử lý. Hãy tải lại và thử lại.',
  P2003:'Phiên bản ghế đã thay đổi. Hãy tải lại sơ đồ ghế.',P2004:'Giữ chỗ đã hết hạn, đã xử lý hoặc ưu đãi không đúng lịch bay.',
  P2005:'Không thể thay đổi ghế đã xuất vé.',P2006:'Flash sale đã hết suất.',P2007:'Số ghế vượt sức chứa máy bay.',
  P2008:'Chuyến bay đã khởi hành.',P2009:'Thông tin giữ chỗ không hợp lệ.',P2010:'Giữ chỗ không thuộc tài khoản của bạn.',
  P2011:'Flash sale chưa bắt đầu hoặc đã kết thúc.',P2012:'Số tiền thanh toán không đúng.',
  '23505':'Thông tin bị trùng hoặc ghế đã có vé.','23503':'Không tìm thấy dữ liệu liên quan.','23514':'Dữ liệu vi phạm ràng buộc toàn vẹn (điểm đi trùng điểm đến hoặc giá trị âm).','40001':'Xung đột giao dịch. Hãy chạy lại cả giao dịch.'};
const violationScenarios={
  P2001:'ATOMIC_CHECKOUT · Đặt ghế đã bán hoặc không còn trống',
  P2002:'PESSIMISTIC_NOWAIT · Tranh chấp khóa bi quan (Ghế đang bị giữ)',
  '55P03':'PESSIMISTIC_NOWAIT · Tranh chấp khóa dòng (FOR UPDATE NOWAIT)',
  P2003:'OPTIMISTIC_CAS · Xung đột phiên bản ghế (Stale Version)',
  P2004:'EXPIRED_HOLD / SALE_SCHEDULE · Giữ chỗ hết hạn hoặc ưu đãi sai lịch bay',
  P2005:'UNIQUE_TICKET_AND_REOPEN · Cố sửa hoặc mở lại ghế đã xuất vé',
  P2006:'FINAL_QUOTA_AND_FREE_TICKET · Vượt hạn ngạch (Quota) Flash Sale',
  P2007:'CAPACITY_AND_FK · Số ghế vượt sức chứa tàu bay',
  P2008:'DEPARTED_FLIGHT · Đặt vé trên chuyến bay đã khởi hành',
  P2009:'INVALID_HOLD_MODE · Chế độ khóa hoặc thông tin giữ chỗ sai',
  P2010:'OWNER_AND_AMOUNT · Thanh toán giữ chỗ của tài khoản khác',
  P2011:'SALE_TIME_WINDOW · Flash sale chưa mở hoặc đã kết thúc',
  P2012:'OWNER_AND_AMOUNT · Số tiền thanh toán không khớp giá vé',
  '23505':'UNIQUE_CONSTRAINT · Trùng mã chuyến bay / sân bay / vé trùng ghế',
  '23503':'INVALID_USER_ROLLBACK · Không tìm thấy khóa ngoại liên quan',
  '23514':'CHECK_CONSTRAINT · Vi phạm ràng buộc miền giá trị CSDL'
};
function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
function id(value,label='Mã'){const number=Number(value);if(!Number.isSafeInteger(number)||number<=0)fail(`${label} không hợp lệ.`);return number;}
function optionalId(value){return value==null||value===''?null:id(value);}
function cookie(req,name){return (req.headers.cookie||'').split(';').map(p=>p.trim()).find(p=>p.startsWith(name+'='))?.slice(name.length+1);}
const route=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export function createApp(db,{checks=runIsolatedChecks}={}) {
  const app=express(),sessions=new Map(),activity=[],violations=[];
  let checkRun=null;
  const q=(sql,params=[])=>db.query(sql,params);
  app.disable('x-powered-by');
  app.use(express.json({limit:'32kb'}));
  app.use((req,res,next)=>{
    req.requestId=randomUUID().slice(0,8);req.started=performance.now();
    res.setHeader('X-Request-ID',req.requestId);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','no-store');
    res.on('finish',()=>{
      if(req.path.startsWith('/api/') && req.method!=='GET'){
        activity.unshift({id:req.requestId,time:new Date().toISOString(),method:req.method,path:req.path,
          status:res.statusCode,sqlstate:res.locals.sqlstate||null,ms:Math.round(performance.now()-req.started),userId:req.user?.user_id});
        if(activity.length>100)activity.pop();
      }
    });
    if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin!==`${req.protocol}://${req.get('host')}`)
      return res.status(403).json({success:false,error:'Nguồn yêu cầu không hợp lệ.'});
    next();
  });
  const auth=route(async(req,res,next)=>{
    const token=cookie(req,'flight_test_session'),session=sessions.get(token);
    if(!session || session.expires<Date.now()){
      sessions.delete(token);return res.status(401).json({success:false,error:'Vui lòng đăng nhập.'});
    }
    const result=await q('SELECT user_id,username,email,role FROM flight_booking_test.users WHERE user_id=$1',[session.userId]);
    if(!result.rows.length){sessions.delete(token);return res.status(401).json({success:false,error:'Tài khoản không còn tồn tại.'});}
    req.user=result.rows[0];next();
  });
  const admin=(req,res,next)=>req.user.role==='ADMIN'?next():res.status(403).json({success:false,error:'Chức năng này cần tài khoản admin.'});
  app.get('/api/health',route(async(req,res)=>{
    await q('SELECT 1');res.json({success:true,engine:db.oracleInfo||'PostgreSQL 17 · PGlite',mode:db.oraclePool?'oracle-live':'embedded',concurrencyTested:false});
  }));
  app.post('/api/auth/login',route(async(req,res)=>{
    const {username,password}=req.body||{};
    if(typeof username!=='string'||typeof password!=='string'||!username.trim()||password.length>100)fail('Nhập tên đăng nhập và mật khẩu.');
    const found=await q('SELECT * FROM flight_booking_test.users WHERE username=$1',[username.trim()]);
    const user=found.rows[0];
    if(!user||!await bcrypt.compare(password,user.password_hash))fail('Tên đăng nhập hoặc mật khẩu không đúng.',401);
    for(const [key,value]of sessions)if(value.expires<Date.now())sessions.delete(key);
    if(sessions.size>=1000)fail('Có quá nhiều phiên đăng nhập. Hãy khởi động lại web test.',503);
    const token=randomBytes(32).toString('hex');sessions.set(token,{userId:user.user_id,expires:Date.now()+12*60*60*1000});
    res.cookie('flight_test_session',token,{httpOnly:true,sameSite:'strict',path:'/',maxAge:12*60*60*1000});
    req.user=user;
    res.json({success:true,data:{user_id:user.user_id,username:user.username,email:user.email,role:user.role}});
  }));
  app.post('/api/auth/register',route(async(req,res)=>{
    const {username,password,email}=req.body||{};
    if(typeof username!=='string'||!/^[-\p{L}\p{N}_.]{3,50}$/u.test(username)||typeof password!=='string'||password.length<6||Buffer.byteLength(password)>72)
      fail('Tên đăng nhập cần 3–50 ký tự; mật khẩu từ 6 ký tự, tối đa 72 byte.');
    const address=email||`${username}@flightlab.test`;
    if(typeof address!=='string'||address.length>100||!/^\S+@\S+\.\S+$/.test(address))fail('Email không hợp lệ.');
    const hash=await bcrypt.hash(password,10);
    if(db.execOracle){
      await db.execOracle(async conn=>{
        await conn.execute("INSERT INTO users(username,email,password_hash,role) VALUES(:1,:2,:3,'USER')",[username,address,hash]);
      });
    } else {
      await q("INSERT INTO flight_booking_test.users(username,email,password_hash,role) VALUES($1,$2,$3,'USER')",[username,address,hash]);
    }
    res.status(201).json({success:true,message:'Đã tạo tài khoản. Bạn có thể đăng nhập.'});
  }));
  app.post('/api/auth/logout',(req,res)=>{sessions.delete(cookie(req,'flight_test_session'));res.clearCookie('flight_test_session');res.json({success:true});});
  app.get('/api/me',auth,(req,res)=>res.json({success:true,data:{...req.user,engine:db.oracleInfo||'PostgreSQL 17 · PGlite'}}));
  app.get('/api/overview',auth,route(async(req,res)=>{
    if(db.syncFromOracle)await db.syncFromOracle();
    const result=await q(`SELECT (SELECT COUNT(*) FROM flight_booking_test.flight_schedules WHERE departure_time>clock_timestamp()) schedules,
      (SELECT COUNT(*) FROM flight_booking_test.flight_seats WHERE status='AVAILABLE') available_seats,
      (SELECT COUNT(*) FROM flight_booking_test.bookings WHERE user_id=$1 AND status='CONFIRMED') my_bookings,
      (SELECT COUNT(*) FROM flight_booking_test.seat_reservations WHERE user_id=$1 AND status='HOLDING' AND hold_expires_at>clock_timestamp()) my_holds`,[req.user.user_id]);
    res.json({success:true,data:{...result.rows[0],engine:db.oracleInfo||'PostgreSQL 17 · PGlite'}});
  }));
  app.get('/api/airports',auth,route(async(req,res)=>res.json({success:true,data:(await q('SELECT airport_id,code,name,city,country FROM flight_booking_test.airports ORDER BY code')).rows})));
  app.get('/api/flights',auth,route(async(req,res)=>{
    const origin=String(req.query.origin||''),destination=String(req.query.destination||'');
    if(origin.length>10||destination.length>10)fail('Mã sân bay không hợp lệ.');
    const result=await q(`SELECT sch.schedule_id,f.flight_number,sch.departure_time,sch.arrival_time,
      a.code origin_code,a.city origin_city,z.code dest_code,z.city dest_city,ac.model,
      COUNT(seat.seat_id) FILTER(WHERE seat.status='AVAILABLE') available,
      MIN(seat.base_price) FILTER(WHERE seat.status='AVAILABLE') min_price
      FROM flight_booking_test.flight_schedules sch JOIN flight_booking_test.flights f ON f.flight_id=sch.flight_id
      JOIN flight_booking_test.airports a ON a.airport_id=f.origin_airport_id
      JOIN flight_booking_test.airports z ON z.airport_id=f.destination_airport_id
      JOIN flight_booking_test.aircrafts ac ON ac.aircraft_id=f.aircraft_id
      LEFT JOIN flight_booking_test.flight_seats seat ON seat.schedule_id=sch.schedule_id
      WHERE sch.departure_time>clock_timestamp() AND ($1='' OR a.code=$1) AND ($2='' OR z.code=$2)
      GROUP BY sch.schedule_id,f.flight_number,a.code,a.city,z.code,z.city,ac.model ORDER BY sch.departure_time LIMIT 100`,[origin,destination]);
    res.json({success:true,data:result.rows});
  }));
  app.get('/api/flash-sales',auth,route(async(req,res)=>{
    const result=await q(`SELECT i.flash_sale_item_id,i.schedule_id,i.sale_price,i.quota,i.sold_count,s.end_time,
      f.flight_number,a.city origin_city,z.city dest_city,a.code origin_code,z.code dest_code
      FROM flight_booking_test.flash_sale_items i JOIN flight_booking_test.flash_sales s ON s.flash_sale_id=i.flash_sale_id
      JOIN flight_booking_test.flight_schedules sch ON sch.schedule_id=i.schedule_id
      JOIN flight_booking_test.flights f ON f.flight_id=sch.flight_id
      JOIN flight_booking_test.airports a ON a.airport_id=f.origin_airport_id
      JOIN flight_booking_test.airports z ON z.airport_id=f.destination_airport_id
      WHERE s.status='ACTIVE' AND s.start_time<=clock_timestamp() AND s.end_time>clock_timestamp()
        AND sch.departure_time>clock_timestamp() ORDER BY i.flash_sale_item_id`);
    res.json({success:true,data:result.rows});
  }));
  app.get('/api/schedules/:id/seats',auth,route(async(req,res)=>{
    const result=await q(`SELECT s.seat_id,s.seat_number,s.seat_class,s.base_price,s.status,s.version,
      CASE WHEN r.user_id=$2 THEN r.reservation_id END reservation_id,
      CASE WHEN r.user_id=$2 THEN r.hold_expires_at END hold_expires_at
      FROM flight_booking_test.flight_seats s LEFT JOIN flight_booking_test.seat_reservations r
      ON r.seat_id=s.seat_id AND r.status='HOLDING' WHERE s.schedule_id=$1 ORDER BY s.seat_number`,[id(req.params.id),req.user.user_id]);
    if(!result.rows.length)fail('Không tìm thấy sơ đồ ghế.',404);
    res.json({success:true,data:result.rows});
  }));
  const ownReservations=`SELECT r.*,s.seat_number,s.seat_class,f.flight_number,
    a.code origin_code,z.code dest_code FROM flight_booking_test.seat_reservations r
    JOIN flight_booking_test.flight_seats s ON s.seat_id=r.seat_id
    JOIN flight_booking_test.flight_schedules sch ON sch.schedule_id=r.schedule_id
    JOIN flight_booking_test.flights f ON f.flight_id=sch.flight_id
    JOIN flight_booking_test.airports a ON a.airport_id=f.origin_airport_id
    JOIN flight_booking_test.airports z ON z.airport_id=f.destination_airport_id`;
  app.get('/api/reservations',auth,route(async(req,res)=>res.json({success:true,data:(await q(ownReservations+" WHERE r.user_id=$1 AND r.status='HOLDING' ORDER BY r.reservation_id DESC",[req.user.user_id])).rows})));
  app.post('/api/reservations',auth,route(async(req,res)=>{
    const {schedule_id,seat_number,mode='PESSIMISTIC',version}=req.body||{};
    const schedule=id(schedule_id,'Lịch bay');
    if(!['PESSIMISTIC','OPTIMISTIC','AUTO'].includes(mode))fail('Chế độ giữ ghế không hợp lệ.');
    if(mode!=='AUTO'&&(typeof seat_number!=='string'||!/^[A-Z0-9-]{1,10}$/.test(seat_number)))fail('Chọn một ghế hợp lệ.');
    if(mode==='OPTIMISTIC'&&(!Number.isSafeInteger(version)||version<0))fail('Thiếu phiên bản ghế.');
    let reservationId;
    if(db.execOracle){
      reservationId=await db.execOracle(async(conn,oracledb)=>{
        if(mode==='AUTO'){
          const r=await conn.execute(
            "BEGIN pkg_flight_booking.hold_auto_seat(:s,:u,'ECONOMY',:rid); END;",
            {s:schedule,u:Number(req.user.user_id),rid:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}}
          );
          return r.outBinds.rid;
        }
        const r=await conn.execute(
          'BEGIN pkg_flight_booking.hold_seat(:s,:seat,:u,:m,:v,:rid); END;',
          {s:schedule,seat:seat_number,u:Number(req.user.user_id),m:mode,v:mode==='OPTIMISTIC'?version:null,rid:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}}
        );
        return r.outBinds.rid;
      });
    } else {
      const result=mode==='AUTO'?await q("SELECT flight_booking_test.hold_auto_seat_skip_locked($1,$2,'ECONOMY') reservation_id",[schedule,req.user.user_id]):
        await q('SELECT flight_booking_test.hold_seat($1,$2,$3,$4,$5) reservation_id',[schedule,seat_number,req.user.user_id,mode,mode==='OPTIMISTIC'?version:null]);
      reservationId=result.rows[0].reservation_id;
    }
    const held=await q(ownReservations+' WHERE r.reservation_id=$1',[reservationId]);
    res.status(201).json({success:true,data:held.rows[0],message:'Đã giữ ghế trong 10 phút.'});
  }));
  app.post('/api/reservations/:id/checkout',auth,route(async(req,res)=>{
    const resId=id(req.params.id),saleId=optionalId(req.body?.sale_item_id);
    if(db.execOracle){
      const out=await db.execOracle(async(conn,oracledb)=>{
        const r=await conn.execute(
          'BEGIN pkg_flight_booking.checkout(:rid,:u,:sale,:bid,:tkt); END;',
          {rid:resId,u:Number(req.user.user_id),sale:saleId,bid:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER},tkt:{dir:oracledb.BIND_OUT,type:oracledb.STRING,maxSize:60}}
        );
        return {booking_id:r.outBinds.bid,e_ticket:r.outBinds.tkt};
      });
      return res.json({success:true,data:out,message:'Đã thanh toán mô phỏng và xuất vé trên Oracle 23ai.'});
    }
    const result=await q('SELECT * FROM flight_booking_test.checkout($1,$2,$3)',[resId,req.user.user_id,saleId]);
    res.json({success:true,data:result.rows[0],message:'Đã thanh toán mô phỏng và xuất vé.'});
  }));
  app.post('/api/reservations/:id/expire',auth,route(async(req,res)=>{
    const resId=id(req.params.id);
    if(db.execOracle){
      await db.execOracle(async(conn,oracledb)=>{
        const owned=await conn.execute("SELECT seat_id FROM seat_reservations WHERE reservation_id=:1 AND user_id=:2 AND status='HOLDING'",[resId,Number(req.user.user_id)],{outFormat:oracledb.OUT_FORMAT_OBJECT});
        if(!owned.rows.length)fail('Không tìm thấy giữ chỗ đang hoạt động của bạn.',404);
        await conn.execute('SELECT seat_id FROM flight_seats WHERE seat_id=:1 FOR UPDATE',[owned.rows[0].SEAT_ID]);
        const changed=await conn.execute("UPDATE seat_reservations SET hold_expires_at=SYSTIMESTAMP-INTERVAL '1' SECOND WHERE reservation_id=:1 AND user_id=:2 AND status='HOLDING'",[resId,Number(req.user.user_id)]);
        if(!changed.rowsAffected)fail('Giữ chỗ đã được xử lý.',409);
        await conn.execute('BEGIN pkg_flight_booking.release_expired_reservations; END;');
      });
      return res.json({success:true,message:'Đã mô phỏng hết hạn và giải phóng ghế trên Oracle 23ai.'});
    }
    await db.transaction(async tx=>{
      const owned=await tx.query("SELECT seat_id FROM flight_booking_test.seat_reservations WHERE reservation_id=$1 AND user_id=$2 AND status='HOLDING'",[resId,req.user.user_id]);
      if(!owned.rows.length)fail('Không tìm thấy giữ chỗ đang hoạt động của bạn.',404);
      // Same lock order as checkout/expiry: seat first, then reservation.
      await tx.query('SELECT seat_id FROM flight_booking_test.flight_seats WHERE seat_id=$1 FOR UPDATE',[owned.rows[0].seat_id]);
      const changed=await tx.query("UPDATE flight_booking_test.seat_reservations SET hold_expires_at=clock_timestamp()-INTERVAL '1 second' WHERE reservation_id=$1 AND user_id=$2 AND status='HOLDING' RETURNING reservation_id",[resId,req.user.user_id]);
      if(!changed.rows.length)fail('Giữ chỗ đã được xử lý.',409);
      await tx.query('SELECT flight_booking_test.release_expired_reservations()');
    });
    res.json({success:true,message:'Đã mô phỏng hết hạn và giải phóng ghế.'});
  }));
  app.get('/api/bookings',auth,route(async(req,res)=>{
    const result=await q(`SELECT b.booking_id,b.total_amount,b.status,b.created_at,t.e_ticket_number,s.seat_number,s.seat_class,
      f.flight_number,sch.departure_time,sch.arrival_time,a.code origin_code,a.city origin_city,z.code dest_code,z.city dest_city,
      t.flash_sale_item_id FROM flight_booking_test.bookings b JOIN flight_booking_test.tickets t ON t.booking_id=b.booking_id
      JOIN flight_booking_test.flight_seats s ON s.seat_id=t.seat_id JOIN flight_booking_test.flight_schedules sch ON sch.schedule_id=s.schedule_id
      JOIN flight_booking_test.flights f ON f.flight_id=sch.flight_id JOIN flight_booking_test.airports a ON a.airport_id=f.origin_airport_id
      JOIN flight_booking_test.airports z ON z.airport_id=f.destination_airport_id WHERE b.user_id=$1 ORDER BY b.booking_id DESC LIMIT 100`,[req.user.user_id]);
    res.json({success:true,data:result.rows});
  }));
  app.get('/api/tickets/verify/:code',auth,route(async(req,res)=>{
    const code=String(req.params.code||'').trim().toUpperCase();
    if(!code||code.length>50)fail('Mã vé không hợp lệ.');
    const result=await q(`SELECT t.ticket_id,t.e_ticket_number,t.flash_sale_item_id,b.booking_id,b.user_id,b.total_amount,b.status,b.created_at,
      u.username,u.email,s.seat_number,s.seat_class,f.flight_number,sch.departure_time,sch.arrival_time,
      a.code origin_code,a.city origin_city,a.name origin_name,z.code dest_code,z.city dest_city,z.name dest_name,
      p.amount paid_amount,p.status payment_status,p.payment_date
      FROM flight_booking_test.tickets t JOIN flight_booking_test.bookings b ON b.booking_id=t.booking_id
      JOIN flight_booking_test.users u ON u.user_id=b.user_id
      JOIN flight_booking_test.flight_seats s ON s.seat_id=t.seat_id
      JOIN flight_booking_test.flight_schedules sch ON sch.schedule_id=s.schedule_id
      JOIN flight_booking_test.flights f ON f.flight_id=sch.flight_id
      JOIN flight_booking_test.airports a ON a.airport_id=f.origin_airport_id
      JOIN flight_booking_test.airports z ON z.airport_id=f.destination_airport_id
      LEFT JOIN flight_booking_test.payments p ON p.booking_id=b.booking_id
      WHERE UPPER(t.e_ticket_number)=$1 AND ($2='ADMIN' OR b.user_id=$3)`,[code,req.user.role,req.user.user_id]);
    if(!result.rows.length)fail('Không tìm thấy vé điện tử hoặc vé không thuộc tài khoản của bạn.',404);
    const logs=await q('SELECT old_status,new_status,changed_at FROM flight_booking_test.booking_logs WHERE booking_id=$1 ORDER BY log_id',[result.rows[0].booking_id]);
    res.json({success:true,data:{...result.rows[0],logs:logs.rows}});
  }));
  app.get('/api/passengers',auth,route(async(req,res)=>{
    const result=await q('SELECT passenger_id,first_name,last_name,passport_number FROM flight_booking_test.passengers WHERE user_id=$1 ORDER BY passenger_id DESC',[req.user.user_id]);
    res.json({success:true,data:result.rows});
  }));
  app.post('/api/passengers',auth,route(async(req,res)=>{
    const {first_name,last_name,passport_number}=req.body||{};
    if(typeof first_name!=='string'||!first_name.trim()||first_name.length>50||typeof last_name!=='string'||!last_name.trim()||last_name.length>50)
      fail('Vui lòng nhập đầy đủ họ và tên hành khách.');
    if(typeof passport_number!=='string'||!/^[A-Z0-9-]{5,30}$/i.test(passport_number.trim()))
      fail('Số hộ chiếu / CCCD cần từ 5–30 ký tự chữ hoặc số.');
    if(db.execOracle){
      const row=await db.execOracle(async(conn,oracledb)=>{
        const r=await conn.execute(
          'INSERT INTO passengers(user_id,first_name,last_name,passport_number) VALUES(:u,:f,:l,:p) RETURNING passenger_id INTO :id',
          {u:Number(req.user.user_id),f:first_name.trim(),l:last_name.trim(),p:passport_number.trim().toUpperCase(),id:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}}
        );
        return {passenger_id:r.outBinds.id[0],first_name:first_name.trim(),last_name:last_name.trim(),passport_number:passport_number.trim().toUpperCase()};
      });
      return res.status(201).json({success:true,data:row,message:'Đã lưu hồ sơ hành khách vào Oracle.'});
    }
    const inserted=await q('INSERT INTO flight_booking_test.passengers(user_id,first_name,last_name,passport_number) VALUES($1,$2,$3,$4) RETURNING passenger_id,first_name,last_name,passport_number',
      [req.user.user_id,first_name.trim(),last_name.trim(),passport_number.trim().toUpperCase()]);
    res.status(201).json({success:true,data:inserted.rows[0],message:'Đã lưu hồ sơ hành khách.'});
  }));
  app.delete('/api/passengers/:id',auth,route(async(req,res)=>{
    const pid=id(req.params.id);
    if(db.execOracle){
      await db.execOracle(async conn=>{
        const r=await conn.execute('DELETE FROM passengers WHERE passenger_id=:1 AND user_id=:2',[pid,Number(req.user.user_id)]);
        if(!r.rowsAffected)fail('Không tìm thấy hành khách.',404);
      });
      return res.json({success:true,message:'Đã xóa hồ sơ hành khách khỏi Oracle.'});
    }
    const deleted=await q('DELETE FROM flight_booking_test.passengers WHERE passenger_id=$1 AND user_id=$2 RETURNING passenger_id',[pid,req.user.user_id]);
    if(!deleted.rows.length)fail('Không tìm thấy hành khách.',404);
    res.json({success:true,message:'Đã xóa hồ sơ hành khách.'});
  }));
  app.get('/api/admin/summary',auth,admin,route(async(req,res)=>{
    const [stats,flightsList,bookings,users,logs]=await Promise.all([
      q(`SELECT
        (SELECT COALESCE(SUM(amount),0) FROM flight_booking_test.payments WHERE status='COMPLETED') revenue,
        (SELECT COUNT(*) FROM flight_booking_test.bookings WHERE status='CONFIRMED') confirmed_bookings,
        (SELECT COUNT(*) FROM flight_booking_test.users) total_users,
        (SELECT COUNT(*) FROM flight_booking_test.flight_seats WHERE status='BOOKED') booked_seats,
        (SELECT COUNT(*) FROM flight_booking_test.flight_seats WHERE status='HOLD') held_seats,
        (SELECT COUNT(*) FROM flight_booking_test.flight_seats WHERE status='AVAILABLE') available_seats`),
      q(`SELECT f.flight_id,f.flight_number,a.code origin_code,a.city origin_city,z.code dest_code,z.city dest_city,ac.model,ac.capacity
         FROM flight_booking_test.flights f JOIN flight_booking_test.airports a ON a.airport_id=f.origin_airport_id
         JOIN flight_booking_test.airports z ON z.airport_id=f.destination_airport_id
         JOIN flight_booking_test.aircrafts ac ON ac.aircraft_id=f.aircraft_id ORDER BY f.flight_id`),
      q(`SELECT b.booking_id,b.total_amount,b.status,b.created_at,u.username,t.e_ticket_number,s.seat_number,s.seat_class,
         f.flight_number,a.code origin_code,z.code dest_code,t.flash_sale_item_id
         FROM flight_booking_test.bookings b JOIN flight_booking_test.users u ON u.user_id=b.user_id
         JOIN flight_booking_test.tickets t ON t.booking_id=b.booking_id
         JOIN flight_booking_test.flight_seats s ON s.seat_id=t.seat_id
         JOIN flight_booking_test.flight_schedules sch ON sch.schedule_id=s.schedule_id
         JOIN flight_booking_test.flights f ON f.flight_id=sch.flight_id
         JOIN flight_booking_test.airports a ON a.airport_id=f.origin_airport_id
         JOIN flight_booking_test.airports z ON z.airport_id=f.destination_airport_id
         ORDER BY b.booking_id DESC LIMIT 50`),
      q('SELECT user_id,username,email,role FROM flight_booking_test.users ORDER BY user_id'),
      q(`SELECT l.log_id,l.booking_id,l.old_status,l.new_status,l.changed_at,u.username
         FROM flight_booking_test.booking_logs l JOIN flight_booking_test.bookings b ON b.booking_id=l.booking_id
         JOIN flight_booking_test.users u ON u.user_id=b.user_id ORDER BY l.log_id DESC LIMIT 30`)
    ]);
    res.json({success:true,data:{stats:stats.rows[0],flights:flightsList.rows,bookings:bookings.rows,users:users.rows,logs:logs.rows}});
  }));
  app.post('/api/admin/schedules',auth,admin,route(async(req,res)=>{
    const {flight_id,days_from_now=12,business_price=4500000,economy_price=1850000}=req.body||{};
    const flightId=id(flight_id,'Chuyến bay');
    const days=Number(days_from_now);
    if(!Number.isFinite(days)||days<1||days>90)fail('Số ngày khởi hành cần từ 1 đến 90 ngày tới.');
    const bPrice=Number(business_price),ePrice=Number(economy_price);
    if(!Number.isFinite(bPrice)||bPrice<0||!Number.isFinite(ePrice)||ePrice<0)fail('Giá vé không hợp lệ.');
    let createdScheduleId;
    await db.transaction(async tx=>{
      const sch=await tx.query(`INSERT INTO flight_booking_test.flight_schedules(flight_id,departure_time,arrival_time)
        VALUES($1,clock_timestamp()+make_interval(days=>$2),clock_timestamp()+make_interval(days=>$2,hours=>2)) RETURNING schedule_id`,[flightId,Math.trunc(days)]);
      createdScheduleId=sch.rows[0].schedule_id;
      for(const row of [1,2]){
        for(const letter of ['A','B','C','D','E','F']){
          await tx.query(`INSERT INTO flight_booking_test.flight_seats(schedule_id,seat_number,seat_class,base_price,status)
            VALUES($1,$2,$3,$4,'AVAILABLE')`,[createdScheduleId,`${row}${letter}`,row===1?'BUSINESS':'ECONOMY',row===1?bPrice:ePrice]);
        }
      }
    });
    res.status(201).json({success:true,data:{schedule_id:createdScheduleId},message:`Đã tạo lịch bay #${createdScheduleId} kèm 12 ghế.`});
  }));
  app.post('/api/admin/flash-sales',auth,admin,route(async(req,res)=>{
    const {schedule_id,sale_price,quota}=req.body||{};
    const scheduleId=id(schedule_id,'Lịch bay');
    const price=Number(sale_price),qVal=Number(quota);
    if(!Number.isFinite(price)||price<0||!Number.isSafeInteger(qVal)||qVal<1||qVal>12)fail('Giá ưu đãi và hạn ngạch (1–12) không hợp lệ.');
    const activeSale=await q("SELECT flash_sale_id FROM flight_booking_test.flash_sales WHERE status='ACTIVE' ORDER BY flash_sale_id LIMIT 1");
    if(!activeSale.rows.length)fail('Chưa có đợt Flash Sale đang mở.');
    const upserted=await q(`INSERT INTO flight_booking_test.flash_sale_items(flash_sale_id,schedule_id,sale_price,quota)
      VALUES($1,$2,$3,$4)
      ON CONFLICT(flash_sale_id,schedule_id) DO UPDATE SET sale_price=EXCLUDED.sale_price,quota=GREATEST(flight_booking_test.flash_sale_items.sold_count,EXCLUDED.quota)
      RETURNING flash_sale_item_id`,[activeSale.rows[0].flash_sale_id,scheduleId,price,qVal]);
    res.status(201).json({success:true,data:upserted.rows[0],message:'Đã lưu cấu hình Flash Sale cho lịch bay.'});
  }));
  app.post('/api/admin/release-expired',auth,admin,route(async(req,res)=>{
    await q('SELECT flight_booking_test.release_expired_reservations()');
    res.json({success:true,message:'Đã chạy worker giải phóng toàn bộ giữ chỗ quá hạn.'});
  }));
  app.get('/api/admin/airports',auth,admin,route(async(req,res)=>{
    const result=await q(`SELECT a.airport_id,a.code,a.name,a.city,a.country,
      (SELECT COUNT(*) FROM flight_booking_test.flights f WHERE f.origin_airport_id=a.airport_id) origin_flights,
      (SELECT COUNT(*) FROM flight_booking_test.flights f WHERE f.destination_airport_id=a.airport_id) dest_flights
      FROM flight_booking_test.airports a ORDER BY a.code`);
    res.json({success:true,data:result.rows});
  }));
  app.post('/api/admin/airports',auth,admin,route(async(req,res)=>{
    const {code,name,city,country='Việt Nam'}=req.body||{};
    if(typeof code!=='string'||!/^[A-Z]{3,10}$/i.test(code.trim()))fail('Mã sân bay (IATA) cần từ 3–10 chữ cái (VD: CXR, HPH, VCA).');
    if(typeof name!=='string'||!name.trim()||name.length>100||typeof city!=='string'||!city.trim()||city.length>100)
      fail('Vui lòng nhập đầy đủ tên sân bay và thành phố.');
    const cCode=code.trim().toUpperCase(),cName=name.trim(),cCity=city.trim(),cCountry=String(country||'Việt Nam').trim().slice(0,100);
    if(db.execOracle){
      const row=await db.execOracle(async(conn,oracledb)=>{
        const r=await conn.execute(
          'INSERT INTO airports(code,name,city,country) VALUES(:c,:n,:ci,:co) RETURNING airport_id INTO :id',
          {c:cCode,n:cName,ci:cCity,co:cCountry,id:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}}
        );
        return {airport_id:r.outBinds.id[0],code:cCode,name:cName,city:cCity,country:cCountry};
      });
      return res.status(201).json({success:true,data:row,message:`Đã thêm sân bay ${cCode} (${cName}) vào Oracle.`});
    }
    const inserted=await q('INSERT INTO flight_booking_test.airports(code,name,city,country) VALUES($1,$2,$3,$4) RETURNING *',[cCode,cName,cCity,cCountry]);
    res.status(201).json({success:true,data:inserted.rows[0],message:`Đã thêm sân bay ${inserted.rows[0].code} (${inserted.rows[0].name}).`});
  }));
  app.delete('/api/admin/airports/:id',auth,admin,route(async(req,res)=>{
    const airportId=id(req.params.id,'Sân bay');
    const used=await q('SELECT COUNT(*) count FROM flight_booking_test.flights WHERE origin_airport_id=$1 OR destination_airport_id=$1',[airportId]);
    if(Number(used.rows[0].count)>0)fail('Không thể xóa sân bay đã có tuyến bay khai thác.',409);
    if(db.execOracle){
      await db.execOracle(async conn=>{
        const r=await conn.execute('DELETE FROM airports WHERE airport_id=:1',[airportId]);
        if(!r.rowsAffected)fail('Không tìm thấy sân bay.',404);
      });
      return res.json({success:true,message:'Đã xóa sân bay khỏi Oracle.'});
    }
    const deleted=await q('DELETE FROM flight_booking_test.airports WHERE airport_id=$1 RETURNING code',[airportId]);
    if(!deleted.rows.length)fail('Không tìm thấy sân bay.',404);
    res.json({success:true,message:`Đã xóa sân bay ${deleted.rows[0].code}.`});
  }));
  app.get('/api/admin/flights',auth,admin,route(async(req,res)=>{
    const [flights,schedules,aircrafts,airports]=await Promise.all([
      q(`SELECT f.flight_id,f.flight_number,f.origin_airport_id,f.destination_airport_id,f.aircraft_id,
         EXTRACT(EPOCH FROM f.duration)::INT/60 duration_minutes,
         a.code origin_code,a.name origin_name,a.city origin_city,
         z.code dest_code,z.name dest_name,z.city dest_city,
         ac.model,ac.capacity,
         (SELECT COUNT(*) FROM flight_booking_test.flight_schedules s WHERE s.flight_id=f.flight_id) schedule_count
         FROM flight_booking_test.flights f
         JOIN flight_booking_test.airports a ON a.airport_id=f.origin_airport_id
         JOIN flight_booking_test.airports z ON z.airport_id=f.destination_airport_id
         JOIN flight_booking_test.aircrafts ac ON ac.aircraft_id=f.aircraft_id
         ORDER BY f.flight_id DESC`),
      q(`SELECT sch.schedule_id,sch.flight_id,sch.departure_time,sch.arrival_time,
         f.flight_number,a.code origin_code,a.city origin_city,a.name origin_name,
         z.code dest_code,z.city dest_city,z.name dest_name,ac.model,
         MAX(s.base_price) FILTER(WHERE s.seat_class='BUSINESS') business_price,
         MAX(s.base_price) FILTER(WHERE s.seat_class='ECONOMY') economy_price,
         COUNT(s.seat_id) FILTER(WHERE s.status='AVAILABLE') available_seats,
         COUNT(s.seat_id) FILTER(WHERE s.status='HOLD') held_seats,
         COUNT(s.seat_id) FILTER(WHERE s.status='BOOKED') booked_seats,
         COUNT(s.seat_id) FILTER(WHERE s.seat_class='BUSINESS' AND s.status='AVAILABLE') business_available,
         COUNT(s.seat_id) FILTER(WHERE s.seat_class='ECONOMY' AND s.status='AVAILABLE') economy_available,
         fsi.flash_sale_item_id,fsi.sale_price,fsi.quota sale_quota,fsi.sold_count sale_sold
         FROM flight_booking_test.flight_schedules sch
         JOIN flight_booking_test.flights f ON f.flight_id=sch.flight_id
         JOIN flight_booking_test.airports a ON a.airport_id=f.origin_airport_id
         JOIN flight_booking_test.airports z ON z.airport_id=f.destination_airport_id
         JOIN flight_booking_test.aircrafts ac ON ac.aircraft_id=f.aircraft_id
         LEFT JOIN flight_booking_test.flight_seats s ON s.schedule_id=sch.schedule_id
         LEFT JOIN flight_booking_test.flash_sale_items fsi ON fsi.schedule_id=sch.schedule_id
         GROUP BY sch.schedule_id,f.flight_number,a.code,a.city,a.name,z.code,z.city,z.name,ac.model,
           fsi.flash_sale_item_id,fsi.sale_price,fsi.quota,fsi.sold_count
         ORDER BY sch.departure_time ASC`),
      q('SELECT aircraft_id,model,capacity FROM flight_booking_test.aircrafts ORDER BY aircraft_id'),
      q('SELECT airport_id,code,name,city,country FROM flight_booking_test.airports ORDER BY code')
    ]);
    res.json({success:true,data:{flights:flights.rows,schedules:schedules.rows,aircrafts:aircrafts.rows,airports:airports.rows}});
  }));
  app.post('/api/admin/flights',auth,admin,route(async(req,res)=>{
    const {flight_number,origin_airport_id,destination_airport_id,aircraft_id,duration_minutes=120,days_from_now=10,business_price=4500000,economy_price=1850000}=req.body||{};
    if(typeof flight_number!=='string'||!/^[A-Z0-9-]{3,20}$/i.test(flight_number.trim()))
      fail('Mã số chuyến bay cần từ 3–20 ký tự chữ/số (VD: VN350, QH202).');
    const originId=id(origin_airport_id,'Sân bay khởi hành');
    const destId=id(destination_airport_id,'Sân bay đến');
    if(originId===destId)fail('Sân bay khởi hành và sân bay đến không được trùng nhau.');
    const checkAirports=await q('SELECT airport_id FROM flight_booking_test.airports WHERE airport_id=ANY($1::BIGINT[])',[[originId,destId]]);
    if(checkAirports.rows.length<2)fail('Chỉ được tạo chuyến bay từ các sân bay đã có trong hệ thống quản trị.');
    const dur=Number(duration_minutes),days=Number(days_from_now),bPrice=Number(business_price),ePrice=Number(economy_price);
    if(!Number.isFinite(dur)||dur<15||dur>1440)fail('Thời gian bay cần từ 15 đến 1440 phút.');
    if(!Number.isFinite(days)||days<1||days>180)fail('Ngày khởi hành cần từ 1 đến 180 ngày tới.');
    if(!Number.isFinite(bPrice)||bPrice<0||!Number.isFinite(ePrice)||ePrice<0)fail('Giá vé các hạng không hợp lệ.');
    let createdFlightId,createdScheduleId;
    if(db.execOracle){
      await db.execOracle(async(conn,oracledb)=>{
        const acRes=aircraft_id?await conn.execute('SELECT aircraft_id FROM aircrafts WHERE aircraft_id=:1',[id(aircraft_id,'Tàu bay')],{outFormat:oracledb.OUT_FORMAT_OBJECT}):
          await conn.execute('SELECT aircraft_id FROM aircrafts ORDER BY aircraft_id FETCH FIRST 1 ROWS ONLY',[],{outFormat:oracledb.OUT_FORMAT_OBJECT});
        if(!acRes.rows.length)fail('Không tìm thấy tàu bay.');
        const fl=await conn.execute(
          'INSERT INTO flights(flight_number,aircraft_id,origin_airport_id,destination_airport_id,duration) VALUES(:fn,:ac,:o,:d,NUMTODSINTERVAL(:dur,\'MINUTE\')) RETURNING flight_id INTO :fid',
          {fn:flight_number.trim().toUpperCase(),ac:acRes.rows[0].AIRCRAFT_ID,o:originId,d:destId,dur:Math.trunc(dur),fid:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}}
        );
        createdFlightId=fl.outBinds.fid[0];
        const sch=await conn.execute(
          'INSERT INTO flight_schedules(flight_id,departure_time,arrival_time) VALUES(:fid,SYSTIMESTAMP+NUMTODSINTERVAL(:days,\'DAY\'),SYSTIMESTAMP+NUMTODSINTERVAL(:days,\'DAY\')+NUMTODSINTERVAL(:dur,\'MINUTE\')) RETURNING schedule_id INTO :sid',
          {fid:createdFlightId,days:Math.trunc(days),dur:Math.trunc(dur),sid:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}}
        );
        createdScheduleId=sch.outBinds.sid[0];
        for(const row of [1,2]){
          for(const letter of ['A','B','C','D','E','F']){
            await conn.execute(
              "INSERT INTO flight_seats(schedule_id,seat_number,seat_class,base_price,status) VALUES(:1,:2,:3,:4,'AVAILABLE')",
              [createdScheduleId,`${row}${letter}`,row===1?'BUSINESS':'ECONOMY',row===1?bPrice:ePrice]
            );
          }
        }
      });
    } else {
      await db.transaction(async tx=>{
        const acRes=aircraft_id?await tx.query('SELECT aircraft_id FROM flight_booking_test.aircrafts WHERE aircraft_id=$1',[id(aircraft_id,'Tàu bay')]):
          await tx.query('SELECT aircraft_id FROM flight_booking_test.aircrafts ORDER BY aircraft_id LIMIT 1');
        if(!acRes.rows.length)fail('Không tìm thấy tàu bay.');
        const fl=await tx.query(`INSERT INTO flight_booking_test.flights(flight_number,aircraft_id,origin_airport_id,destination_airport_id,duration)
          VALUES($1,$2,$3,$4,make_interval(mins=>$5)) RETURNING flight_id`,
          [flight_number.trim().toUpperCase(),acRes.rows[0].aircraft_id,originId,destId,Math.trunc(dur)]);
        createdFlightId=fl.rows[0].flight_id;
        const sch=await tx.query(`INSERT INTO flight_booking_test.flight_schedules(flight_id,departure_time,arrival_time)
          VALUES($1,clock_timestamp()+make_interval(days=>$2),clock_timestamp()+make_interval(days=>$2,mins=>$3)) RETURNING schedule_id`,
          [createdFlightId,Math.trunc(days),Math.trunc(dur)]);
        createdScheduleId=sch.rows[0].schedule_id;
        for(const row of [1,2]){
          for(const letter of ['A','B','C','D','E','F']){
            await tx.query(`INSERT INTO flight_booking_test.flight_seats(schedule_id,seat_number,seat_class,base_price,status)
              VALUES($1,$2,$3,$4,'AVAILABLE')`,[createdScheduleId,`${row}${letter}`,row===1?'BUSINESS':'ECONOMY',row===1?bPrice:ePrice]);
          }
        }
      });
    }
    res.status(201).json({success:true,data:{flight_id:createdFlightId,schedule_id:createdScheduleId},
      message:`Đã tạo chuyến bay ${flight_number.trim().toUpperCase()} kèm lịch bay #${createdScheduleId} và 12 ghế.`});
  }));
  app.put('/api/admin/fares/:scheduleId',auth,admin,route(async(req,res)=>{
    const scheduleId=id(req.params.scheduleId,'Lịch bay');
    const {business_price,economy_price,sale_price,sale_quota}=req.body||{};
    const bPrice=Number(business_price),ePrice=Number(economy_price);
    if(!Number.isFinite(bPrice)||bPrice<0||!Number.isFinite(ePrice)||ePrice<0)fail('Giá vé Thương gia và Phổ thông không hợp lệ.');
    if(db.execOracle){
      await db.execOracle(async(conn,oracledb)=>{
        const exists=await conn.execute('SELECT schedule_id FROM flight_schedules WHERE schedule_id=:1',[scheduleId]);
        if(!exists.rows.length)fail('Không tìm thấy lịch bay.',404);
        await conn.execute("UPDATE flight_seats SET base_price=:1 WHERE schedule_id=:2 AND seat_class='BUSINESS' AND status='AVAILABLE'",[bPrice,scheduleId]);
        await conn.execute("UPDATE flight_seats SET base_price=:1 WHERE schedule_id=:2 AND seat_class='ECONOMY' AND status='AVAILABLE'",[ePrice,scheduleId]);
        if(sale_price!==undefined&&sale_price!==''&&sale_price!==null){
          const sPrice=Number(sale_price),sQuota=Number(sale_quota||3);
          if(!Number.isFinite(sPrice)||sPrice<0||!Number.isSafeInteger(sQuota)||sQuota<1||sQuota>12)
            fail('Giá Flash Sale hoặc hạn ngạch (1–12) không hợp lệ.');
          const activeSale=await conn.execute("SELECT flash_sale_id FROM flash_sales WHERE status='ACTIVE' ORDER BY flash_sale_id FETCH FIRST 1 ROWS ONLY",[],{outFormat:oracledb.OUT_FORMAT_OBJECT});
          if(activeSale.rows.length){
            const fid=activeSale.rows[0].FLASH_SALE_ID;
            const upd=await conn.execute('UPDATE flash_sale_items SET sale_price=:1, quota=GREATEST(sold_count,:2) WHERE flash_sale_id=:3 AND schedule_id=:4',[sPrice,sQuota,fid,scheduleId]);
            if(!upd.rowsAffected){
              await conn.execute('INSERT INTO flash_sale_items(flash_sale_id,schedule_id,sale_price,quota) VALUES(:1,:2,:3,:4)',[fid,scheduleId,sPrice,sQuota]);
            }
          }
        }
      });
      return res.json({success:true,message:`Đã cập nhật bảng giá các loại vé cho lịch bay #${scheduleId} trên Oracle.`});
    }
    await db.transaction(async tx=>{
      const exists=await tx.query('SELECT schedule_id FROM flight_booking_test.flight_schedules WHERE schedule_id=$1',[scheduleId]);
      if(!exists.rows.length)fail('Không tìm thấy lịch bay.',404);
      await tx.query("UPDATE flight_booking_test.flight_seats SET base_price=$1 WHERE schedule_id=$2 AND seat_class='BUSINESS' AND status='AVAILABLE'",[bPrice,scheduleId]);
      await tx.query("UPDATE flight_booking_test.flight_seats SET base_price=$1 WHERE schedule_id=$2 AND seat_class='ECONOMY' AND status='AVAILABLE'",[ePrice,scheduleId]);
      if(sale_price!==undefined&&sale_price!==''&&sale_price!==null){
        const sPrice=Number(sale_price),sQuota=Number(sale_quota||3);
        if(!Number.isFinite(sPrice)||sPrice<0||!Number.isSafeInteger(sQuota)||sQuota<1||sQuota>12)
          fail('Giá Flash Sale hoặc hạn ngạch (1–12) không hợp lệ.');
        const activeSale=await tx.query("SELECT flash_sale_id FROM flight_booking_test.flash_sales WHERE status='ACTIVE' ORDER BY flash_sale_id LIMIT 1");
        if(activeSale.rows.length){
          await tx.query(`INSERT INTO flight_booking_test.flash_sale_items(flash_sale_id,schedule_id,sale_price,quota)
            VALUES($1,$2,$3,$4)
            ON CONFLICT(flash_sale_id,schedule_id) DO UPDATE SET sale_price=EXCLUDED.sale_price,
              quota=GREATEST(flight_booking_test.flash_sale_items.sold_count,EXCLUDED.quota)`,
            [activeSale.rows[0].flash_sale_id,scheduleId,sPrice,sQuota]);
        }
      }
    });
    res.json({success:true,message:`Đã cập nhật bảng giá các loại vé cho lịch bay #${scheduleId}.`});
  }));
  app.get('/api/admin/users',auth,admin,route(async(req,res)=>{
    const result=await q(`SELECT u.user_id,u.username,u.email,u.role,
      COUNT(DISTINCT b.booking_id) FILTER(WHERE b.status='CONFIRMED') tickets_bought,
      COALESCE(SUM(b.total_amount) FILTER(WHERE b.status='CONFIRMED'),0) total_spent,
      (SELECT COUNT(*) FROM flight_booking_test.seat_reservations r WHERE r.user_id=u.user_id AND r.status='HOLDING' AND r.hold_expires_at>clock_timestamp()) active_holds
      FROM flight_booking_test.users u
      LEFT JOIN flight_booking_test.bookings b ON b.user_id=u.user_id
      GROUP BY u.user_id,u.username,u.email,u.role
      ORDER BY u.user_id ASC`);
    res.json({success:true,data:result.rows});
  }));
  app.get('/api/admin/users/:id/history',auth,admin,route(async(req,res)=>{
    const userId=id(req.params.id,'Người dùng');
    const userRes=await q('SELECT user_id,username,email,role FROM flight_booking_test.users WHERE user_id=$1',[userId]);
    if(!userRes.rows.length)fail('Không tìm thấy người dùng.',404);
    const [bookings,holds,passengers]=await Promise.all([
      q(`SELECT b.booking_id,b.total_amount,b.status,b.created_at,t.e_ticket_number,t.flash_sale_item_id,
         s.seat_number,s.seat_class,f.flight_number,sch.departure_time,
         a.code origin_code,a.city origin_city,z.code dest_code,z.city dest_city
         FROM flight_booking_test.bookings b
         JOIN flight_booking_test.tickets t ON t.booking_id=b.booking_id
         JOIN flight_booking_test.flight_seats s ON s.seat_id=t.seat_id
         JOIN flight_booking_test.flight_schedules sch ON sch.schedule_id=s.schedule_id
         JOIN flight_booking_test.flights f ON f.flight_id=sch.flight_id
         JOIN flight_booking_test.airports a ON a.airport_id=f.origin_airport_id
         JOIN flight_booking_test.airports z ON z.airport_id=f.destination_airport_id
         WHERE b.user_id=$1 ORDER BY b.booking_id DESC`,[userId]),
      q(`SELECT r.reservation_id,r.status,r.hold_expires_at,r.quoted_price,s.seat_number,s.seat_class,
         f.flight_number,a.code origin_code,z.code dest_code
         FROM flight_booking_test.seat_reservations r
         JOIN flight_booking_test.flight_seats s ON s.seat_id=r.seat_id
         JOIN flight_booking_test.flight_schedules sch ON sch.schedule_id=r.schedule_id
         JOIN flight_booking_test.flights f ON f.flight_id=sch.flight_id
         JOIN flight_booking_test.airports a ON a.airport_id=f.origin_airport_id
         JOIN flight_booking_test.airports z ON z.airport_id=f.destination_airport_id
         WHERE r.user_id=$1 ORDER BY r.reservation_id DESC LIMIT 20`,[userId]),
      q('SELECT passenger_id,first_name,last_name,passport_number FROM flight_booking_test.passengers WHERE user_id=$1 ORDER BY passenger_id DESC',[userId])
    ]);
    const userViolations=violations.filter(v=>Number(v.userId)===Number(userId));
    res.json({success:true,data:{user:userRes.rows[0],bookings:bookings.rows,holds:holds.rows,passengers:passengers.rows,violations:userViolations}});
  }));
  app.get('/api/admin/violations',auth,admin,(req,res)=>res.json({success:true,data:violations}));
  app.delete('/api/admin/violations',auth,admin,(req,res)=>{violations.length=0;res.json({success:true,message:'Đã xóa nhật ký cảnh báo vi phạm.'});});
  app.post('/api/simulate-violation',auth,route(async(req,res)=>{
    const {case_type}=req.body||{};
    await db.transaction(async tx=>{
      const sch=(await tx.query('SELECT schedule_id FROM flight_booking_test.flight_schedules ORDER BY schedule_id DESC LIMIT 1')).rows[0].schedule_id;
      if(case_type==='BOOKED_SEAT'){
        const booked=(await tx.query("SELECT schedule_id,seat_number FROM flight_booking_test.flight_seats WHERE status='BOOKED' LIMIT 1")).rows[0];
        if(booked)await tx.query("SELECT flight_booking_test.hold_seat($1,$2,$3,'PESSIMISTIC',NULL)",[booked.schedule_id,booked.seat_number,req.user.user_id]);
        else await tx.query("SELECT flight_booking_test.hold_seat($1,'99Z',$2,'PESSIMISTIC',NULL)",[sch,req.user.user_id]);
      } else if(case_type==='STALE_VERSION'){
        await tx.query("SELECT flight_booking_test.hold_seat($1,'2F',$2,'OPTIMISTIC',999999)",[sch,req.user.user_id]);
      } else if(case_type==='EXPIRED_CHECKOUT'){
        await tx.query('SELECT * FROM flight_booking_test.checkout(-1,$1,NULL)',[req.user.user_id]);
      } else if(case_type==='REOPEN_BOOKED'){
        const booked=(await tx.query("SELECT seat_id FROM flight_booking_test.flight_seats WHERE status='BOOKED' LIMIT 1")).rows[0];
        if(booked)await tx.query("UPDATE flight_booking_test.flight_seats SET status='AVAILABLE' WHERE seat_id=$1",[booked.seat_id]);
        fail('Chưa có ghế đã bán để thử mở lại.',409);
      } else if(case_type==='QUOTA_EXCEEDED'){
        const sale=(await tx.query('SELECT flash_sale_item_id,quota FROM flight_booking_test.flash_sale_items LIMIT 1')).rows[0];
        await tx.query('UPDATE flight_booking_test.flash_sale_items SET sold_count=$1 WHERE flash_sale_item_id=$2',[sale.quota+1,sale.flash_sale_item_id]);
      } else if(case_type==='CAPACITY_EXCEEDED'){
        await tx.query("INSERT INTO flight_booking_test.flight_seats(schedule_id,seat_number,seat_class,base_price,status) VALUES($1,'9A','ECONOMY',1000000,'AVAILABLE')",[sch]);
      } else if(case_type==='WRONG_OWNER'){
        const otherHold=(await tx.query('SELECT reservation_id,user_id FROM flight_booking_test.seat_reservations LIMIT 1')).rows[0];
        if(otherHold){
          await tx.query('SELECT * FROM flight_booking_test.checkout($1,$2,NULL)',[otherHold.reservation_id,otherHold.user_id+999]);
        }
        await tx.query('SELECT * FROM flight_booking_test.checkout(-1,$1,NULL)',[req.user.user_id]);
      } else {
        fail('Kịch bản mô phỏng lỗi không hợp lệ.',400);
      }
    });
    res.json({success:true});
  }));
  app.get('/api/activity',auth,(req,res)=>res.json({success:true,data:activity.filter(a=>a.userId===req.user.user_id)}));
  app.get('/api/diagnostics',auth,admin,route(async(req,res)=>{
    const [integrity,diagnostics]=await Promise.all([q('SELECT * FROM flight_booking_test.vw_project_integrity ORDER BY check_name'),
      q('SELECT category,check_name,status,details FROM flight_booking_test.project_diagnostics ORDER BY diagnostic_id')]);
    res.json({success:true,data:{integrity:integrity.rows,diagnostics:diagnostics.rows,concurrencyTested:false}});
  }));
  app.post('/api/tests/run',auth,admin,route(async(req,res)=>{
    if(checkRun)fail('Bộ kiểm thử đang chạy, vui lòng đợi.',409);
    checkRun=checks();
    try{res.json({success:true,data:await checkRun});}finally{checkRun=null;}
  }));
  app.use('/api',(req,res)=>res.status(404).json({success:false,error:'API không tồn tại.'}));
  app.use(express.static(path.join(root,'public'),{etag:false}));
  app.use((error,req,res,next)=>{
    if(res.headersSent)return next(error);
    const code=error.code;res.locals.sqlstate=code||null;
    const status=error.status||(['P2002','55P03'].includes(code)?503:code==='P2010'?403:messages[code]?409:500);
    const errorMessage=error.status?error.message:messages[code]||'Không thể hoàn tất thao tác. Hãy thử lại.';
    const scenario=violationScenarios[code]||(status>=400?`HTTP_${status} · Dữ liệu đầu vào hoặc quyền truy cập không hợp lệ`:null);
    if(status>=400&&req.path.startsWith('/api/')&&req.path!=='/api/me'){
      violations.unshift({
        id:req.requestId,
        time:new Date().toISOString(),
        userId:req.user?.user_id||null,
        username:req.user?.username||req.body?.username||'Khách chưa đăng nhập',
        role:req.user?.role||'GUEST',
        method:req.method,
        path:req.path,
        status,
        sqlstate:code||'APP_RULE',
        scenario,
        message:errorMessage
      });
      if(violations.length>100)violations.pop();
    }
    if(status===500)console.error(req.requestId,error);
    res.status(status).json({success:false,error:errorMessage,sqlstate:code||null,scenario,request_id:req.requestId});
  });
  return app;
}
