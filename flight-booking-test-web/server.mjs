import path from 'node:path';
import {mkdir,writeFile,rm,access} from 'node:fs/promises';
import {createDatabase,claimRuntime,root} from './database.mjs';
import {createApp} from './app.mjs';
const port=Number(process.env.PORT||3001);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error('PORT không hợp lệ.');
const release=await claimRuntime();
let db,server,worker,stopPoll;
const runtime=path.join(root,'runtime');
const cleanup=async()=>{clearInterval(worker);clearInterval(stopPoll);await rm(path.join(runtime,'web.json'),{force:true});if(db)await db.close();await release();};
try {
  console.log('Đang kết nối CSDL (Oracle 23ai @ 192.168.2.27:1521/FREEPDB1)...');
  db=await createDatabase(path.join(root,'data'));
  if(db.execOracle){
    await db.execOracle(async conn=>{await conn.execute('BEGIN pkg_flight_booking.release_expired_reservations; END;');});
  } else {
    await db.query('SELECT flight_booking_test.release_expired_reservations()');
  }
  const app=createApp(db);
  server=await new Promise((resolve,reject)=>{const s=app.listen(port,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
  let running=false;
  worker=setInterval(async()=>{
    if(running)return;running=true;
    try{
      if(db.execOracle)await db.execOracle(async conn=>{await conn.execute('BEGIN pkg_flight_booking.release_expired_reservations; END;');});
      else await db.query('SELECT flight_booking_test.release_expired_reservations()');
    }catch(error){console.error('Expiry:',error.message);}finally{running=false;}
  },15000);
  let stopping=false;
  async function stop(){if(stopping)return;stopping=true;console.log('Đang dừng web...');clearInterval(worker);clearInterval(stopPoll);await new Promise(resolve=>server.close(resolve));await cleanup();await rm(path.join(runtime,'stop.request'),{force:true});process.exit(0);}
  await mkdir(runtime,{recursive:true});await rm(path.join(runtime,'stop.request'),{force:true});
  await writeFile(path.join(runtime,'web.json'),JSON.stringify({pid:process.pid,url:`http://localhost:${port}`,port,engine:'PGlite PostgreSQL',database:path.join(root,'data')},null,2));
  stopPoll=setInterval(async()=>{try{await access(path.join(runtime,'stop.request'));await stop();}catch(error){if(error.code!=='ENOENT')console.error(error.message);}},1000);
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,stop);
  console.log(`READY http://localhost:${port}`);
  console.log('Admin: admin/admin123 | Khách: nguyenvanan/user123');
} catch(error){console.error(error);if(server)server.close();await cleanup();process.exitCode=1;}
