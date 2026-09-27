// Uses the bundled Playwright runtime and the isolated API started by backend/tests/test_model_isolation.py --serve.
// No requests are allowed through to the production API.
const { chromium } = require('C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const run = JSON.parse(fs.readFileSync(path.join(root, 'reports/phase2_validation/latest_run.json'))).run_directory;
const cases = [], requests = [];
let failName = null, hold = null;

function field(body, name) {
  return body.match(new RegExp('name="' + name + '"\\r\\n\\r\\n([^\\r]+)'))?.[1];
}
function media(product, name) {
  const dir = path.join(root, 'dataset', product, 'non_defective');
  const source = fs.readdirSync(dir).find(n => n.endsWith('.jpg'));
  return { name, mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(dir, source)) };
}
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('accessToken', 'isolated-test-token'));
  await page.route('http://localhost:8000/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (pathname === '/predictions/classify') {
      const body = request.postDataBuffer().toString('latin1');
      const record = { filename: body.match(/filename="([^"]+)"/)?.[1], product: field(body, 'product_type'), job_id: field(body, 'job_id'), expected_model_version: field(body, 'expected_model_version') };
      requests.push(record);
      if (hold) await hold;
      if (record.filename === failName) {
        failName = null;
        record.status = 500;
        return route.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ detail: 'Controlled failure for pending-file retry test' }) });
      }
      const response = await route.fetch({ url: 'http://127.0.0.1:8765' + pathname, timeout: 120000 });
      record.status = response.status();
      record.response = await response.json();
      return route.fulfill({ response, headers: { ...response.headers(), ...cors } });
    }
    // Forward all API traffic to the isolated server, including history/report reads.
    const response = await route.fetch({ url: 'http://127.0.0.1:8765' + new URL(request.url()).pathname + new URL(request.url()).search });
    await route.fulfill({ response, headers: { ...response.headers(), ...cors } });
  });
  const queue = () => page.locator('.p-5').filter({ has: page.getByRole('heading', { name: 'Batch queue', exact: true }) });
  const cards = () => page.locator('.p-5').filter({ has: page.getByRole('heading', { name: 'Prediction result cards', exact: true }) });
  const runButton = () => page.getByRole('button', { name: 'Run AI', exact: true });
  async function uploadPage() {
    await page.goto('http://127.0.0.1:5174/upload');
    await page.getByRole('heading', { name: 'Upload detection system' }).waitFor();
  }
  async function choose(product, names, browse = false) {
    await page.locator('select').selectOption(product);
    const files = names.map(name => media(product, name));
    if (browse) {
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Browse files' }).click();
      await (await chooser).setFiles(files);
    } else await page.locator('#upload-input').setInputFiles(files);
  }
  async function runSuccess() {
    await runButton().click();
    await page.waitForFunction(() => [...document.querySelectorAll('p')].some(n => /Job .*Completed/.test(n.textContent)), null, { timeout: 120000 });
    assert.equal(await runButton().isDisabled(), true);
    assert.match(await queue().innerText(), /No pending files/);
  }
  async function test(name, fn) {
    const before = requests.length;
    try {
      await fn();
      cases.push({ name, status: 'PASS', request_range: [before, requests.length] });
      console.log('PASS', name);
    } catch (e) {
      cases.push({ name, status: 'FAIL', error: String(e), request_range: [before, requests.length] });
      throw e;
    } finally {
      fs.writeFileSync(path.join(run, 'browser_results.json'), JSON.stringify({ cases, requests, page_errors: errors }, null, 2));
    }
  }
  try {
    await test('single Cars input; Browse files; repeat without upload disabled', async () => {
      await uploadPage();
      await choose('cars', ['car_A.jpg'], true);
      const before = requests.length;
      await runSuccess();
      assert.deepEqual(requests.slice(before).map(r => r.filename), ['car_A.jpg']);
      await runButton().evaluate(button => button.click());
      assert.equal(requests.length, before + 1);
    });
    await test('all six model switches submit only the newly selected input', async () => {
      const products = ['cars', 'cardboard_boxes', 'mobile'];
      for (const from of products) for (const to of products) if (from !== to) {
        await choose(from, [from + '_before_switch.jpg']);
        await runSuccess();
        await choose(to, [to + '_after_switch.jpg']);
        const before = requests.length;
        await runSuccess();
        assert.equal(requests.length, before + 1);
        const r = requests.at(-1);
        assert.equal(r.filename, to + '_after_switch.jpg');
        assert.equal(r.product, to);
        assert.equal(r.response.model_used, to + '_model');
        assert.equal(r.response.job_id, r.job_id);
      }
    });
    await test('intentional three-image batch pins one job and model version', async () => {
      await choose('cars', ['car_A.jpg', 'car_B.jpg', 'car_C.jpg']);
      const before = requests.length;
      await runSuccess();
      const batch = requests.slice(before);
      assert.deepEqual(batch.map(r => r.filename), ['car_A.jpg', 'car_B.jpg', 'car_C.jpg']);
      assert.equal(new Set(batch.map(r => r.job_id)).size, 1);
      assert.equal(new Set(batch.map(r => r.response.model_version)).size, 1);
      assert.equal(batch[1].expected_model_version, batch[0].response.model_version);
      assert.equal(batch[2].expected_model_version, batch[0].response.model_version);
      await choose('cardboard_boxes', ['box_A.jpg']);
      const next = requests.length;
      await runSuccess();
      assert.deepEqual(requests.slice(next).map(r => r.filename), ['box_A.jpg']);
    });
    await test('change product before prediction clears pending files and results', async () => {
      await choose('cars', ['never_submit_car.jpg']);
      await page.locator('select').selectOption('cardboard_boxes');
      assert.match(await queue().innerText(), /No pending files/);
      assert.equal(await runButton().isDisabled(), true);
      assert.match(await cards().innerText(), /Results appear after prediction/);
      assert.equal(requests.some(r => r.filename === 'never_submit_car.jpg'), false);
    });
    await test('Mobile then Cardboard then Cars each contains one fresh input', async () => {
      const before = requests.length;
      for (const [product, name] of [['mobile', 'mobile_A.jpg'], ['cardboard_boxes', 'box_A.jpg'], ['cars', 'car_A.jpg']]) {
        await choose(product, [name]);
        await runSuccess();
      }
      assert.deepEqual(requests.slice(before).map(r => [r.product, r.filename]), [
        ['mobile', 'mobile_A.jpg'], ['cardboard_boxes', 'box_A.jpg'], ['cars', 'car_A.jpg'],
      ]);
      assert.equal(new Set(requests.slice(before).map(r => r.job_id)).size, 3);
    });
    await test('two-car batch followed by Cardboard submits box only', async () => {
      await choose('cars', ['car_A.jpg', 'car_B.jpg']);
      await runSuccess();
      await choose('cardboard_boxes', ['box_A.jpg']);
      const before = requests.length;
      await runSuccess();
      assert.deepEqual(requests.slice(before).map(r => r.filename), ['box_A.jpg']);
    });
    await test('partial failure removes successes and retries only unresolved input', async () => {
      await choose('cars', ['partial_A.jpg', 'partial_B.jpg', 'partial_C.jpg']);
      failName = 'partial_C.jpg';
      await runButton().click();
      await page.getByText('Controlled failure for pending-file retry test', { exact: true }).waitFor();
      const text = await queue().innerText();
      assert.ok(text.includes('partial_C.jpg'));
      assert.ok(!text.includes('partial_A.jpg') && !text.includes('partial_B.jpg'));
      const before = requests.length;
      await runSuccess();
      assert.deepEqual(requests.slice(before).map(r => r.filename), ['partial_C.jpg']);
      assert.ok(!(await cards().innerText()).includes('partial_A.jpg'));
    });
    await test('in-flight inputs frozen; double click/drop cannot add another request', async () => {
      await choose('mobile', ['frozen_mobile.jpg']);
      let release;
      hold = new Promise(resolve => { release = resolve; });
      const before = requests.length;
      await runButton().evaluate(button => { button.click(); button.click(); });
      await page.waitForFunction(() => document.querySelector('select').disabled);
      assert.equal(await page.getByRole('button', { name: 'Browse files' }).isDisabled(), true);
      assert.equal(await page.locator('#upload-input').isDisabled(), true);
      await page.getByText('Drop product media here', { exact: true }).evaluate(el => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(['ignored'], 'ignored.jpg', { type: 'image/jpeg' }));
        el.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
      });
      hold = null;
      release();
      await page.getByText(/Job .*Completed/).waitFor({ timeout: 120000 });
      assert.deepEqual(requests.slice(before).map(r => r.filename), ['frozen_mobile.jpg']);
      assert.match(await queue().innerText(), /No pending files/);
    });
    await test('middle failure preserves failed and unattempted files only', async () => {
      await choose('cars', ['middle_A.jpg', 'middle_B.jpg', 'middle_C.jpg']);
      failName = 'middle_B.jpg';
      await runButton().click();
      await page.getByText('Controlled failure for pending-file retry test', { exact: true }).waitFor();
      const text = await queue().innerText();
      assert.ok(!text.includes('middle_A.jpg') && text.includes('middle_B.jpg') && text.includes('middle_C.jpg'));
      const before = requests.length;
      await runSuccess();
      assert.deepEqual(requests.slice(before).map(r => r.filename), ['middle_B.jpg', 'middle_C.jpg']);
    });
    await test('drag/drop and identical filenames remain separate intentional inputs', async () => {
      await page.locator('select').selectOption('cars');
      const bytes = [...media('cars', 'same.jpg').buffer];
      await page.getByText('Drop product media here', { exact: true }).evaluate((el, payload) => {
        const transfer = new DataTransfer();
        transfer.items.add(new File([new Uint8Array(payload)], 'same.jpg', { type: 'image/jpeg' }));
        transfer.items.add(new File([new Uint8Array(payload)], 'same.jpg', { type: 'image/jpeg' }));
        el.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
      }, bytes);
      const before = requests.length;
      await runSuccess();
      assert.deepEqual(requests.slice(before).map(r => r.filename), ['same.jpg', 'same.jpg']);
      assert.equal(await cards().getByText('same.jpg', { exact: true }).count(), 2);
    });
    await test('history and reports remain available; navigation never restores old queue', async () => {
      await page.getByRole('link', { name: 'History', exact: true }).click();
      await page.getByRole('heading', { name: 'Prediction history' }).waitFor();
      await page.getByRole('cell', { name: 'cars', exact: true }).first().waitFor();
      assert.ok(await page.getByRole('cell', { name: 'mobile', exact: true }).count());
      assert.ok(await page.getByRole('cell', { name: 'cardboard_boxes', exact: true }).count());
      const reportLoaded = page.waitForResponse(r => r.url().endsWith('/predictions/me') && r.status() === 200);
      await page.getByRole('link', { name: 'Reports', exact: true }).click();
      await reportLoaded;
      await page.getByRole('heading', { name: 'Quality Reports' }).waitFor();
      await page.locator('tbody input[type="checkbox"]').first().check();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: /Export/ }).click();
      const artifact = await download;
      await artifact.saveAs(path.join(run, 'isolated_quality_report.html'));
      assert.match(fs.readFileSync(path.join(run, 'isolated_quality_report.html'), 'utf8'), /sha256:/);
      await uploadPage();
      assert.match(await queue().innerText(), /No pending files/);
      assert.equal(await runButton().isDisabled(), true);
      assert.equal(await page.locator('select option[value="plastic_bottles"]').count(), 0);
    });
    await test('current results cleared before a failed next job', async () => {
      await choose('mobile', ['visible_mobile.jpg']);
      await runSuccess();
      await choose('cars', ['new_failure.jpg']);
      failName = 'new_failure.jpg';
      await runButton().click();
      await page.getByText('Controlled failure for pending-file retry test', { exact: true }).waitFor();
      assert.ok(!(await cards().innerText()).includes('visible_mobile.jpg'));
    });
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(run, 'upload_final.png'), fullPage: true });
  } finally {
    fs.writeFileSync(path.join(run, 'browser_results.json'), JSON.stringify({ cases, requests, page_errors: errors }, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify({ passed: cases.length, requests: requests.length, run_directory: run }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
