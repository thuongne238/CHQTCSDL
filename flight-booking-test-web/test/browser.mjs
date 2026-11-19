import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {root,createDatabase} from '../database.mjs';
import {createApp} from '../app.mjs';
const output=path.join(root,'test-results');await mkdir(output,{recursive:true});
const executable=process.env.BROWSER_EXECUTABLE||[
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if(!executable)throw new Error('Set BROWSER_EXECUTABLE to your Chromium browser, or install Playwright Chromium.');
const db=await createDatabase();
const app=createApp(db);
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
let browser;
const errors=[];
try{
  browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('401'))errors.push(message.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('heading',{name:'Đăng nhập để bắt đầu'}).waitFor();
  await page.screenshot({path:path.join(output,'login.png'),fullPage:true});

  // 1. Customer Portal: bright VNA layout, no 4 stat cards, 4-col flight cards, seat modal opens on "Mua ngay"
  await page.locator('[data-action="demo"][data-user="nguyenvanan"]').click();
  await page.getByRole('heading',{name:/Lịch bay có thể đặt/}).waitFor();
  assert.equal(await page.locator('.stats').count(),0,'Customer portal must not render the 4 stat cards');
  assert.equal(await page.locator('.vna-flight-card').count(),8);
  assert.equal(await page.locator('#seat-panel').count(),0,'Seat modal must be hidden until Mua ngay is clicked');
  await page.screenshot({path:path.join(output,'customer-home.png'),fullPage:true});

  await page.locator('.vna-flight-card [data-action="select-flight"]').last().click();
  await page.locator('#seat-panel').waitFor();
  await page.screenshot({path:path.join(output,'seat-modal.png'),fullPage:true});
  await page.locator('[data-seat-number="2F"]').click();
  await page.locator('[data-action="hold"]').click();
  await page.locator('.checkout-box').waitFor();
  await page.locator('[data-action="checkout"]').click();
  await page.getByRole('heading',{name:'Vé bạn đã đặt'}).waitFor();
  assert.ok(await page.locator('.ticket').count()>=1);
  assert.match(await page.locator('.ticket-bottom code').first().textContent(),/^ETKT-/);
  await page.screenshot({path:path.join(output,'ticket.png'),fullPage:true});

  // 2. Flash sale + Optimistic hold + Expiry simulation
  await page.locator('[data-action="nav"][data-view="sales"]').first().click();
  await page.getByRole('heading',{name:'Flash sale đang mở'}).waitFor();
  await page.locator('.sale-card [data-action="sale"]').first().click();
  await page.locator('#seat-panel').waitFor();
  await page.locator('[data-seat-number="2E"]').click();
  await page.locator('#hold-mode').click();
  await page.locator('#seat-panel').waitFor();
  await page.selectOption('#hold-mode','OPTIMISTIC');
  assert.equal(await page.locator('#hold-mode').inputValue(),'OPTIMISTIC');
  await page.locator('[data-action="hold"]').click();
  await page.locator('.checkout-box').waitFor();

  // Test dedicated Yes/No Confirm Component: "No" cancels, "Yes" executes
  await page.locator('[data-action="expire"]').click();
  await page.locator('[data-confirm-choice="no"]').waitFor();
  await page.locator('[data-confirm-choice="no"]').click();
  await page.locator('.checkout-box').waitFor();

  await page.locator('[data-action="expire"]').click();
  await page.locator('[data-confirm-choice="yes"]').waitFor();
  await page.screenshot({path:path.join(output,'confirm-dialog.png'),fullPage:true});
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/expire')&&response.request().method()==='POST'),
    page.locator('[data-confirm-choice="yes"]').click()]);
  await page.waitForFunction(()=>!document.querySelector('.checkout-box'));
  await page.locator('[data-action="close-seat"]').click();
  await page.waitForFunction(()=>!document.querySelector('#seat-panel'));

  // 3. Mobile check (390px)
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
  const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dimensions.scroll<=dimensions.width+1,`Mobile horizontal overflow: ${JSON.stringify(dimensions)}`);

  // 4. Admin Portal separated
  await page.setViewportSize({width:1440,height:1050});
  await page.locator('[data-action="logout"]').click();
  await page.locator('[data-action="demo"][data-user="admin"]').click();
  await page.getByRole('heading',{name:'Quản trị chuyến bay & lịch khởi hành'}).waitFor();
  await page.locator('[data-action="nav"][data-view="admin-users"]').click();
  await page.getByRole('heading',{name:'Quản lý người dùng & lịch sử mua vé'}).waitFor();
  assert.equal(await page.locator('.user-history-modal').count(),0);
  await page.locator('tr[data-action="inspect-user"]').nth(1).click();
  await page.locator('.user-history-modal').waitFor();
  await page.screenshot({path:path.join(output,'admin-user-modal.png'),fullPage:true});
  await page.locator('[data-action="close-user-history"]').click();
  await page.waitForFunction(()=>!document.querySelector('.user-history-modal'));
  await page.locator('[data-action="nav"][data-view="lab"]').click();
  await page.getByRole('heading',{name:'Kịch bản nghiệp vụ'}).waitFor();
  await page.locator('[data-action="run-tests"]').click();
  await page.locator('.lab-result').waitFor({timeout:30000});
  assert.equal(await page.locator('.test-row').count(),12);
  assert.equal(await page.locator('.integrity-row').count(),8);
  await page.screenshot({path:path.join(output,'admin-lab.png'),fullPage:true});

  assert.deepEqual(errors,[]);
  const result={browser:path.basename(executable),login:'PASS',customerBrightVnaLayout:'PASS',
    seatModalOnBuyNow:'PASS',holdAndCheckout:'PASS',optimisticHoldAndExpiry:'PASS',
    adminPortalSeparated:'PASS',isolatedSqlTests:12,integrityChecks:8,
    mobile:'PASS',pageErrors:errors};
  await writeFile(path.join(output,'browser-result.json'),JSON.stringify(result,null,2));
  console.log(result);
}catch(error){console.error(error);if(browser){const pages=browser.contexts().flatMap(context=>context.pages());if(pages[0])await pages[0].screenshot({path:path.join(output,'failure.png'),fullPage:true});}process.exitCode=1;}
finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));await db.close();}
