const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.CABIN_URL||'http://127.0.0.1:8787';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
(async()=>{
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 const errors=[],checks=[];
 async function open(mobile=false){
   const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:mobile?'reduce':'no-preference'});
   page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>{localStorage.setItem('starlit-name','测试旅人');localStorage.setItem('starlit-history','{"invalid":true}');});
   await page.goto(base);await page.waitForTimeout(mobile?100:1200);return page;
 }
 async function physicalClick(page,name,mobile){
   const point=await page.evaluate(async object=>{const scene=await import('/scene.js');return scene.interactionPoint(object);},name);
   assert(point&&point.x>0&&point.y>0,'Object must appear on screen');
   if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
 }
 for(const mobile of [false,true]){
   const page=await open(mobile);
   await page.locator('#history-button').click();assert.match(await page.locator('#history-list').textContent(),/手记还是空白/);await page.locator('[data-close="history-modal"]').click();
   await physicalClick(page,'crystal',mobile);await page.locator('body[data-stage="question"]').waitFor();
   await page.locator('.spread-option').filter({has:page.locator('input[value="single"]')}).click();assert(await page.locator('input[value="single"]').isChecked());
   await page.locator('.spread-option').filter({has:page.locator('input[value="three"]')}).click();assert(await page.locator('input[value="three"]').isChecked());
   if(mobile)await page.locator('.spread-option').filter({has:page.locator('input[value="single"]')}).click();
   await page.locator('#question').fill('回归测试：我可以如何更好地认识自己的感受？');
   await page.locator('#begin-button').click();await page.locator('body[data-stage="ready"]').waitFor();await page.waitForTimeout(mobile?100:1250);
   await physicalClick(page,'deck',mobile);await page.locator('body[data-stage="spread"]').waitFor();
   await page.waitForFunction(()=>document.querySelectorAll('.card-back:not(:disabled)').length===78);
   assert.equal(await page.locator('.card-back').count(),78);
   await page.screenshot({path:path.join(__dirname,mobile?'bugfix-mobile-spread.png':'bugfix-desktop-spread.png')});
   const indexes=mobile?[77]:[0,38,77];for(const index of indexes){await page.locator(`[data-index="${index}"]`).click();await page.waitForFunction(expected=>document.querySelectorAll('.draw-slot strong').length===expected,indexes.indexOf(index)+1);}
   assert.equal(await page.locator('body').getAttribute('data-stage'),'reveal');assert.equal(await page.locator('.draw-slot strong').count(),indexes.length);
   const token=await page.evaluate(()=>JSON.parse(localStorage.getItem('starlit-history'))[0].token);
   const actual=await (await page.request.get(base+'/api/sessions/'+token)).json();
   const cards=actual.draws.map(d=>({card_id:d.card.id,name:d.card.name,position:d.position,reversed:d.reversed,excerpt:'用于测试重试流程的引用。',sources:[{pages:[108],subsection:'测试依据',text:'回归测试原文。'}]}));
   let current={...actual},calls=0;
   await page.route('**/api/sessions/'+token+'/interpret',async route=>{calls++;assert.equal(Boolean(route.request().postDataJSON().retry),calls===2);current={...actual,status:'complete',reading:{mode:calls===1?'evidence':'model',can_retry:calls===1,cards,summary:'回归测试综合解读（PDF 第108页）。',note:calls===1?'测试模拟接口暂时失败':'综合解读由模型依据本次牌阵与原书证据生成'}};await route.fulfill({json:current});});
   await page.route('**/api/sessions/'+token,route=>route.fulfill({json:current}));
   await page.locator('#interpret-button').click();await page.locator('body[data-stage="reading"]').waitFor();await page.locator('#retry-reading').click();await page.waitForFunction(()=>document.body.dataset.stage==='reading'&&document.querySelector('#retry-reading').hidden);
   assert.equal(calls,2);assert.equal(await page.locator('.draw-slot strong').count(),indexes.length);
   await page.locator('#scene-back').click();assert.equal(await page.locator('body').getAttribute('data-stage'),'home');
   checks.push(mobile?'手机：牌阵切换、真实家具点击、78张展开、选牌、解读重试':'桌面：牌阵切换、真实家具点击、78张展开、选牌、解读重试');await page.close();
 }
 const race=await open();await race.locator('.room-locations [data-object="crystal"]').click();
 let releaseFirst,firstArrived;const waitFirst=new Promise(r=>firstArrived=r),held=new Promise(r=>releaseFirst=r);let posts=0;
 await race.route('**/api/sessions',async route=>{if(route.request().method()!=='POST')return route.continue();const n=++posts;const response=await route.fetch();if(n===1){firstArrived();await held;}await route.fulfill({response});});
 await race.locator('#question').fill('旧问题请求：我可以如何更好地认识自己？');await race.locator('#begin-button').click();await waitFirst;
 await race.locator('#scene-back').click();await race.locator('.room-locations [data-object="crystal"]').click();await race.locator('#question').fill('新问题请求：我可以如何整理工作中的变化？');await race.locator('#begin-button').click();await race.locator('body[data-stage="ready"]').waitFor();releaseFirst();await pause(500);
 assert.equal(await race.locator('body').getAttribute('data-stage'),'ready');assert.match(await race.evaluate(()=>JSON.parse(localStorage.getItem('starlit-history'))[0].question),/^新问题/);
 checks.push('旧请求延迟返回不会覆盖新问题或页面步骤');
 let releaseSearch,searchArrived;const startedSearch=new Promise(r=>searchArrived=r),searchHeld=new Promise(r=>releaseSearch=r);
 await race.route('**/api/knowledge?*',async route=>{const query=new URL(route.request().url()).searchParams.get('q');if(query==='愚人'){searchArrived();await searchHeld;}await route.fulfill({json:{answer:query+'的测试牌义'}});});
 await race.locator('#library-button').click();await race.locator('[data-search="愚人"]').click();await startedSearch;await race.locator('[data-search="女祭司"]').click();await race.waitForFunction(()=>document.querySelector('#library-result').textContent.startsWith('女祭司'));releaseSearch();await pause(300);assert.match(await race.locator('#library-result').textContent(),/^女祭司/);checks.push('藏书快速连续查询显示最后一次结果');await race.close();
 const offline=await browser.newPage();offline.on('pageerror',e=>errors.push(e.message));await offline.addInitScript(()=>localStorage.setItem('starlit-name','测试旅人'));await offline.route('**/api/health',route=>route.abort());await offline.goto(base);await offline.locator('#notice').waitFor({state:'visible'});checks.push('首页连接错误可见，不再被隐藏面板遮住');await offline.close();
 assert.equal(errors.length,0,errors.join('\n'));
 fs.writeFileSync(path.join(__dirname,'bugfix-results.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,errors}));
 await browser.close();
})().catch(async error=>{console.error(error);if(browser)await browser.close();process.exit(1);});
