const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{
 const browser=await chromium.launch({...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{}),headless:true});
 const errors=[];
 async function run(viewport,mobile){
  const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile,reducedMotion:mobile?'reduce':'no-preference'});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:8787');await page.locator('#welcome-modal').waitFor({state:'visible'});
  await page.locator('#visitor-name').fill(mobile?'小月':'星旅人');await page.locator('#welcome-form .primary').click();
  await page.waitForTimeout(1600);await page.screenshot({path:path.join(__dirname,mobile?'v2-mobile-home.png':'v2-home.png')});
  assert.equal(await page.locator('body').getAttribute('data-stage'),'home');
  await page.locator('.room-locations [data-object="crystal"]').click();await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(__dirname,mobile?'v2-mobile-question.png':'v2-question.png')});
  await page.locator('#question').fill('面对工作中的变化，我可以怎样找到自己的方向？');
  if(mobile)await page.locator('input[value="single"]').check();
  await page.locator('#begin-button').click();await page.locator('body[data-stage="ready"]').waitFor();
  await page.locator('#open-deck').click();await page.locator('.card-back:not([disabled])').first().waitFor();
  await page.waitForTimeout(mobile?100:2300);assert.equal(await page.locator('.card-back').count(),78);
  await page.screenshot({path:path.join(__dirname,mobile?'v2-mobile-spread.png':'v2-spread.png')});
  const indexes=mobile?[77]:[0,38,77];for(const i of indexes){await page.locator(`[data-index="${i}"]`).click();await page.waitForTimeout(150);}
  assert.equal(await page.locator('body').getAttribute('data-stage'),'reveal');await page.waitForTimeout(1300);
  await page.screenshot({path:path.join(__dirname,mobile?'v2-mobile-reveal.png':'v2-reveal.png')});
  await page.locator('#interpret-button').click();await page.locator('body[data-stage="reading"]').waitFor({timeout:210000});
  await page.screenshot({path:path.join(__dirname,mobile?'v2-mobile-reading.png':'v2-reading.png')});
  assert.equal(await page.locator('.reading-card').count(),indexes.length);
  assert((await page.locator('#reading-note').textContent()).includes('综合解读由模型'),'Expected a real LLM synthesis, not the fallback');
  assert((await page.locator('#audit-result').textContent()).includes('校验通过'));
  await page.locator('#sound-button').click();await page.waitForFunction(()=>document.querySelector('#sound-button').getAttribute('aria-pressed')==='true');
  await page.locator('#sound-button').click();assert.equal(await page.locator('#sound-button').getAttribute('aria-pressed'),'false');
  await page.locator('#library-button').click();await page.locator('[data-search="愚人"]').click();await page.waitForFunction(()=>document.querySelector('#library-result').textContent.includes('PDF'));await page.locator('[data-close="library-modal"]').click();
  await page.reload();assert.equal(await page.locator('#welcome-modal').isVisible(),false);
  await page.locator('#history-button').click();await page.locator('.history-entry').first().click();await page.locator('body[data-stage="reading"]').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#scene-back').click();await page.locator('.room-locations [data-object="crystal"]').click();
  await page.locator('#question').fill('如何更清楚地认识自己的感受？');await page.locator('#begin-button').click();await page.locator('body[data-stage="ready"]').waitFor();await page.locator('#open-deck').click();await page.locator('#scene-back').click();await page.waitForTimeout(1800);assert.equal(await page.locator('body').getAttribute('data-stage'),'home');
  await page.locator('.room-locations [data-object="deck"]').click();await page.waitForTimeout(2200);assert.equal(await page.locator('.card-back:not([disabled])').count(),78);
  console.log(mobile?'mobile passed':'desktop passed');await page.close();
 }
 await run({width:1440,height:1000},false);await run({width:390,height:844},true);
 fs.writeFileSync(path.join(__dirname,'immersive-results.json'),JSON.stringify({date:'2026-10-02',errors,desktop:true,mobile:true,cards:78,namePersistence:true,audio:true,history:true,library:true,llmSynthesis:true,cancelAndResume:true},null,2));
 await browser.close();assert.equal(errors.length,0,errors.join('\n'));
})().catch(e=>{console.error(e);process.exit(1)});
