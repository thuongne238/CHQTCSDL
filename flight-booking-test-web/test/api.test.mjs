import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '../database.mjs';
import {createApp} from '../app.mjs';
let db,server,base,customer,admin,lastSchedule,previousSchedule,customerId;
async function request(url,{data,method=data?'POST':'GET',cookie,origin}={}){
  const response=await fetch(base+url,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{}),...(origin?{Origin:origin}:{})},body:data?JSON.stringify(data):undefined});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};
}
async function login(username,password){const result=await request('/api/auth/login',{data:{username,password}});assert.equal(result.status,200);return result.cookie.split(';')[0];}
async function hold(seat='2F',schedule=lastSchedule){const result=await request('/api/reservations',{cookie:customer,data:{schedule_id:schedule,seat_number:seat}});assert.equal(result.status,201,JSON.stringify(result.body));return result.body.data;}
before(async()=>{
  db=await createDatabase();
  const app=createApp(db);
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve)});
  base=`http://127.0.0.1:${server.address().port}`;
  admin=await login('admin','admin123');customer=await login('nguyenvanan','user123');
  const data=await db.query('SELECT schedule_id FROM flight_booking_test.flight_schedules ORDER BY schedule_id DESC LIMIT 2');
  [lastSchedule,previousSchedule]=data.rows.map(r=>r.schedule_id);
  customerId=(await db.query("SELECT user_id FROM flight_booking_test.users WHERE username='nguyenvanan'")).rows[0].user_id;
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
test('health is public but customer data requires a session',async()=>{
  assert.equal((await request('/api/health')).status,200);
  for(const url of ['/api/me','/api/bookings','/api/reservations','/api/flights'])assert.equal((await request(url)).status,401);
});
test('incorrect credentials fail and valid sessions use HttpOnly SameSite cookies',async()=>{
  assert.equal((await request('/api/auth/login',{data:{username:'admin',password:'wrong'}})).status,401);
  const success=await request('/api/auth/login',{data:{username:'admin',password:'admin123'}});
  assert.match(success.cookie,/HttpOnly/i);assert.match(success.cookie,/SameSite=Strict/i);
  assert.ok(!JSON.stringify(success.body).includes('password_hash'));
});
test('registration cannot grant ADMIN and duplicate accounts are reported',async()=>{
  const values={username:'new_customer',password:'test12345',email:'new@flightlab.test',role:'ADMIN'};
  assert.equal((await request('/api/auth/register',{data:values})).status,201);
  const cookie=await login(values.username,values.password);
  assert.equal((await request('/api/me',{cookie})).body.data.role,'USER');
  assert.equal((await request('/api/diagnostics',{cookie})).status,403);
  assert.equal((await request('/api/auth/register',{data:values})).status,409);
});
test('invalid inputs and foreign origins fail before database writes',async()=>{
  for(const data of [{},{schedule_id:-1,seat_number:'2A'},{schedule_id:lastSchedule,seat_number:'<script>'},
    {schedule_id:lastSchedule,seat_number:'2A',mode:'BAD'},
    {schedule_id:lastSchedule,seat_number:'2A',mode:'OPTIMISTIC'}]){
    assert.equal((await request('/api/reservations',{cookie:customer,data})).status,400);
  }
  assert.equal((await request('/api/reservations',{cookie:customer,data:{},origin:'http://other.invalid'})).status,403);
});
test('search filters match actual airport routes',async()=>{
  const filtered=await request('/api/flights?origin=SGN&destination=HAN',{cookie:customer});
  assert.equal(filtered.status,200);assert.ok(filtered.body.data.length>0);
  assert.ok(filtered.body.data.every(f=>f.origin_code==='SGN'&&f.dest_code==='HAN'));
  assert.equal((await request('/api/flights?origin=HAN&destination=PQC',{cookie:customer})).body.data.length,0);
});
test('hold is committed, wrong owner cannot checkout, correct checkout creates exactly one paid ticket',async()=>{
  const held=await hold('2F');
  const wrong=await request(`/api/reservations/${held.reservation_id}/checkout`,{cookie:admin,data:{}});
  assert.equal(wrong.status,403);assert.equal(wrong.body.sqlstate,'P2010');
  const paid=await request(`/api/reservations/${held.reservation_id}/checkout`,{cookie:customer,data:{}});
  assert.equal(paid.status,200);assert.match(paid.body.data.e_ticket,/^ETKT-/);
  const rows=(await db.query('SELECT amount,status FROM flight_booking_test.payments WHERE booking_id=$1',[paid.body.data.booking_id])).rows;
  assert.equal(rows.length,1);assert.equal(Number(rows[0].amount),1850000);assert.equal(rows[0].status,'COMPLETED');
  const repeated=await request(`/api/reservations/${held.reservation_id}/checkout`,{cookie:customer,data:{}});
  assert.equal(repeated.status,409);assert.equal(repeated.body.sqlstate,'P2004');
  assert.equal((await request('/api/reservations',{cookie:customer,data:{schedule_id:lastSchedule,seat_number:'2F'}})).body.sqlstate,'P2001');
});
test('ticket and hold lists expose only the authenticated user',async()=>{
  const cookie=await login('new_customer','test12345');
  assert.deepEqual((await request('/api/bookings',{cookie})).body.data,[]);
  assert.deepEqual((await request('/api/reservations',{cookie})).body.data,[]);
  assert.ok((await request('/api/bookings',{cookie:customer})).body.data.length>=3);
});
test('simulated expiry releases a seat and invalidates stale optimistic versions',async()=>{
  const original=(await request(`/api/schedules/${lastSchedule}/seats`,{cookie:customer})).body.data.find(s=>s.seat_number==='2D');
  const held=await hold('2D');
  assert.equal((await request(`/api/reservations/${held.reservation_id}/expire`,{cookie:admin,data:{}})).status,404);
  assert.equal((await request(`/api/reservations/${held.reservation_id}/expire`,{cookie:customer,data:{}})).status,200);
  const expired=await request(`/api/reservations/${held.reservation_id}/checkout`,{cookie:customer,data:{}});
  assert.equal(expired.body.sqlstate,'P2004');
  const stale=await request('/api/reservations',{cookie:customer,data:{schedule_id:lastSchedule,seat_number:'2D',mode:'OPTIMISTIC',version:original.version}});
  assert.equal(stale.body.sqlstate,'P2003');
  const fresh=(await request(`/api/schedules/${lastSchedule}/seats`,{cookie:customer})).body.data.find(s=>s.seat_number==='2D');
  assert.equal(fresh.status,'AVAILABLE');assert.equal(fresh.version,original.version+2);
});
test('auto allocation returns its actual reservation and seat',async()=>{
  const result=await request('/api/reservations',{cookie:customer,data:{schedule_id:lastSchedule,mode:'AUTO'}});
  assert.equal(result.status,201);assert.equal(result.body.data.seat_class,'ECONOMY');
  assert.equal(result.body.data.user_id,customerId);
  await request(`/api/reservations/${result.body.data.reservation_id}/expire`,{cookie:customer,data:{}});
});
test('the final flash-sale unit is consumed once; failed checkout preserves the prior hold',async()=>{
  const item=(await db.query('SELECT * FROM flight_booking_test.flash_sale_items WHERE schedule_id=$1',[previousSchedule])).rows[0];
  await db.query('UPDATE flight_booking_test.flash_sale_items SET quota=sold_count+1,sale_price=0 WHERE flash_sale_item_id=$1',[item.flash_sale_item_id]);
  const first=await hold('2A',previousSchedule);
  const firstPayment=await request(`/api/reservations/${first.reservation_id}/checkout`,{cookie:customer,data:{sale_item_id:item.flash_sale_item_id}});
  assert.equal(firstPayment.status,200);
  const payment=(await db.query('SELECT amount FROM flight_booking_test.payments WHERE booking_id=$1',[firstPayment.body.data.booking_id])).rows[0];
  assert.equal(Number(payment.amount),0);
  const second=await hold('2B',previousSchedule);
  const failure=await request(`/api/reservations/${second.reservation_id}/checkout`,{cookie:customer,data:{sale_item_id:item.flash_sale_item_id}});
  assert.equal(failure.body.sqlstate,'P2006');
  const remaining=(await db.query('SELECT status FROM flight_booking_test.seat_reservations WHERE reservation_id=$1',[second.reservation_id])).rows[0];
  assert.equal(remaining.status,'HOLDING');
  await request(`/api/reservations/${second.reservation_id}/expire`,{cookie:customer,data:{}});
});
test('an item for another schedule does not mutate quota or issue a ticket',async()=>{
  const item=(await db.query('SELECT flash_sale_item_id,sold_count FROM flight_booking_test.flash_sale_items WHERE schedule_id=$1',[previousSchedule])).rows[0];
  const held=await hold('2C');
  const bad=await request(`/api/reservations/${held.reservation_id}/checkout`,{cookie:customer,data:{sale_item_id:item.flash_sale_item_id}});
  assert.equal(bad.body.sqlstate,'P2004');
  assert.equal((await db.query('SELECT sold_count FROM flight_booking_test.flash_sale_items WHERE flash_sale_item_id=$1',[item.flash_sale_item_id])).rows[0].sold_count,item.sold_count);
  await request(`/api/reservations/${held.reservation_id}/expire`,{cookie:customer,data:{}});
});
test('live integrity and action history reflect successful and rejected requests',async()=>{
  const result=await request('/api/diagnostics',{cookie:admin});assert.equal(result.status,200);
  assert.equal(result.body.data.integrity.length,8);
  assert.ok(result.body.data.integrity.every(r=>Number(r.anomaly_count)===0));
  const activity=(await request('/api/activity',{cookie:customer})).body.data;
  assert.ok(activity.some(r=>r.sqlstate==='P2006'));assert.ok(activity.some(r=>r.status===200));
  assert.ok(!JSON.stringify(activity).includes('password'));
});
test('an admin reruns the 12 SQL cases in isolation without changing web bookings',async()=>{
  const count=Number((await db.query('SELECT COUNT(*) FROM flight_booking_test.bookings')).rows[0].count);
  const result=await request('/api/tests/run',{cookie:admin,data:{}});
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(result.body.data.tests.length,12);assert.equal(result.body.data.plans.length,4);
  assert.ok(result.body.data.tests.every(t=>t.status==='PASS'));
  assert.equal(result.body.data.isolated,true);assert.equal(result.body.data.concurrencyTested,false);
  assert.equal(Number((await db.query('SELECT COUNT(*) FROM flight_booking_test.bookings')).rows[0].count),count);
  assert.equal((await request('/api/tests/run',{cookie:customer,data:{}})).status,403);
});
test('logout revokes the session and the UI requires local assets only',async()=>{
  const cookie=await login('new_customer','test12345');
  await request('/api/auth/logout',{cookie,data:{}});
  assert.equal((await request('/api/me',{cookie})).status,401);
  const response=await fetch(base);assert.equal(response.status,200);
  assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'"));
  assert.ok(!(await response.text()).includes('cdn.'));
});
