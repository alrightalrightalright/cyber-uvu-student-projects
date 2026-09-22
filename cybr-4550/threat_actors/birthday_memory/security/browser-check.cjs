// Local-only browser verification. Set PLAYWRIGHT_MODULE if Playwright is not on NODE_PATH.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), output = path.join(__dirname, 'evidence/after');
const users = JSON.parse(fs.readFileSync(path.join(root,'.secrets/demo-users.json'),'utf8'));
(async () => {
  const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  const records = [], errors = [];
  const alice = await browser.newContext({viewport:{width:1440,height:1000}});
  const page = await alice.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const shot = async (page,name,description) => {
    await page.locator('.loader').waitFor({state:'hidden'});
    await page.screenshot({path:path.join(output,name)});
    records.push({file:name,capturedAt:new Date().toISOString(),url:page.url(),description});
  };
  try {
    await page.goto('http://127.0.0.1:4000');
    await page.getByRole('heading',{name:'Sign in to your private list'}).waitFor();
    await shot(page,'login-after.png','Anonymous browser sees sign-in instead of birthday records.');
    await page.getByLabel('Username',{exact:true}).fill(users[0].username);
    await page.getByLabel('Password',{exact:true}).fill(users[0].password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByText('Signed in as alice',{exact:false}).waitFor();
    const initialMe=await (await alice.request.get('http://127.0.0.1:4000/api/auth/me')).json();
    const existing=await (await alice.request.get('http://127.0.0.1:4000/api/birthdays?q=Synthetic%20Alice&limit=50')).json();
    for(const item of existing.items.filter(b=>b.firstName==='Synthetic Alice' && b.lastName==='Private birthday'))
      await alice.request.delete(`http://127.0.0.1:4000/api/birthdays/${item.id}`,{headers:{'X-CSRF-Token':initialMe.csrfToken}});
    await page.reload();
    await page.locator('.loader').waitFor({state:'hidden'});
    await page.getByLabel('First name',{exact:false}).fill('Synthetic Alice');
    await page.getByLabel('Last name',{exact:false}).fill('Private birthday');
    await page.getByLabel('Birthdate',{exact:false}).fill('1990-02-28');
    await page.getByRole('button',{name:'Save birthday'}).click();
    await page.getByText('Synthetic Alice Private birthday',{exact:true}).first().waitFor();
    await page.evaluate(()=>window.scrollTo(0,0));
    await shot(page,'alice-private-list.png','Alice signed in and created a synthetic birthday through the form.');
    // Browser-bound API requests use this same cookie jar, so this also tests CSRF integration.
    const me = await (await alice.request.get('http://127.0.0.1:4000/api/auth/me')).json();
    const payload='<img src=x onerror=window.__xss=1>';
    const response=await alice.request.post('http://127.0.0.1:4000/api/birthdays',{
      headers:{'X-CSRF-Token':me.csrfToken},data:{firstName:payload,lastName:'Literal text test',birthdate:'1995-01-01'}});
    assert.equal(response.status(),201);
    const xss=await response.json();
    await page.reload();
    await page.getByText(payload,{exact:false}).first().waitFor();
    assert.equal(await page.evaluate(()=>window.__xss),undefined);
    assert.equal(await page.locator('img[onerror]').count(),0);
    await page.getByText(payload,{exact:false}).first().scrollIntoViewIfNeeded();
    await shot(page,'literal-text-test.png','Stored markup is rendered as literal text; no img element or event execution.');
    await alice.request.delete(`http://127.0.0.1:4000/api/birthdays/${xss.id}`,{headers:{'X-CSRF-Token':me.csrfToken}});
    const bob=await browser.newContext({viewport:{width:1440,height:1000}}), bobPage=await bob.newPage();
    await bobPage.goto('http://127.0.0.1:4000');
    await bobPage.getByLabel('Username',{exact:true}).fill(users[1].username);
    await bobPage.getByLabel('Password',{exact:true}).fill(users[1].password);
    await bobPage.getByRole('button',{name:'Sign in',exact:true}).click();
    await bobPage.getByText('Signed in as bob',{exact:false}).waitFor();
    await bobPage.getByText('no birthdays yet',{exact:true}).waitFor();
    assert.equal(await bobPage.getByText('Synthetic Alice Private birthday',{exact:true}).count(),0);
    await shot(bobPage,'bob-private-list.png','Bob has an empty private list while Alice owns a birthday.');
    await page.getByRole('button',{name:'Sign out',exact:true}).click();
    await page.getByRole('heading',{name:'Sign in to your private list'}).waitFor();
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'browser-tests.json'),JSON.stringify({passed:true,capturedAt:new Date().toISOString(),
      checks:['login gate','valid sign-in','UI create','two-account isolation','literal output encoding','logout'],screenshots:records,pageErrors:errors},null,2));
    console.log('Browser checks passed; four original screenshots saved.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
