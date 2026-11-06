// @ts-check
const { test, expect } = require('@playwright/test');

/** Fill the three weights (empty string = leave blank) and press 計算熱量. */
async function calc(page, can, water = '', left = '') {
  await page.fill('#can', String(can));
  await page.fill('#water', String(water));
  await page.fill('#left', String(left));
  await page.click('.btn-calc');
}

const steps = (page) => page.locator('#steps .eq').allTextContents();
const prevSteps = (page) => page.locator('#prevSteps .eq').allTextContents();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('標題是「老婆大人」，打開網頁時動畫不會擋住輸入', async ({ page }) => {
  await expect(page).toHaveTitle(/老婆大人/);
  await expect(page.locator('h1')).toHaveText('老婆大人');
  await expect(page.locator('#figure')).toBeVisible();
  // 一打開就能點罐頭重量輸入框：輸入框正中間最上面的就是它自己，沒有東西蓋住
  const can = page.locator('#can');
  const coveredBy = await can.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top === el ? null : (top && top.outerHTML.slice(0, 80));
  });
  expect(coveredBy).toBeNull();
  await can.click();
  await can.pressSequentially('85');
  await expect(can).toHaveValue('85');
});

test('主畫面圖示檔案存在，而且是 PNG 圖片', async ({ page, request }) => {
  const href = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const res = await request.get('/' + href);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
});

test('按計算或點她，她會再揮一次手', async ({ page }) => {
  const figure = page.locator('#figure');
  await calc(page, '10', '2', '3');
  await expect(figure).toHaveClass(/play/);
  await figure.click();
  await expect(figure).toHaveClass(/play/);
});

test('每次算好熱量，會有一隻貓咪跳出來說「媽咪我愛你」，而且不會擋住按鈕', async ({ page }) => {
  const pop = page.locator('#catPop');
  await expect(pop.locator('.cat-face')).toHaveCount(5);
  await calc(page, '10', '2', '3');
  await expect(pop).toHaveClass(/show/);
  await expect(pop.locator('.bubble')).toContainText('媽咪我愛你');
  await expect(pop.locator('.cat-face.on')).toHaveCount(1);
  // 貓咪還在畫面上的時候，按鈕照樣按得到
  await page.click('#resetBtn');
  await expect(page.locator('#can')).toHaveValue('');
});

test('五隻貓隨機出現，不會連續兩次都是同一隻', async ({ page }) => {
  await page.fill('#can', '10');
  const seen = [];
  for (let i = 0; i < 25; i++) {
    await page.click('.btn-calc');
    seen.push(await page.locator('#catPop .cat-face.on').getAttribute('data-cat'));
  }
  for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  expect(new Set(seen).size).toBeGreaterThanOrEqual(3);
});

test('每個輸入框都會跳出有小數點的數字鍵盤', async ({ page }) => {
  for (const id of ['can', 'density', 'water', 'left']) {
    await expect(page.locator('#' + id)).toHaveAttribute('inputmode', 'decimal');
  }
});

test('重量最多輸入到小數點後兩位', async ({ page }) => {
  const can = page.locator('#can');
  const cases = [
    ['10.567', '10.56'],   // 第三位小數擋掉
    ['1,5', '1.5'],        // 逗號當小數點
    ['.5', '0.5'],         // 開頭直接打小數點
    ['1.2.3', '1.23'],     // 只能有一個小數點
    ['007', '7'],          // 前面的 0 拿掉
  ];
  for (const [typed, expected] of cases) {
    await can.fill('');
    await can.pressSequentially(typed);
    await expect(can, `輸入 ${typed}`).toHaveValue(expected);
  }
});

test('自訂每公克熱量可以到小數點後三位', async ({ page }) => {
  await page.click('label.radio:has(input[value="custom"])');
  const density = page.locator('#density');
  await expect(density).toBeEnabled();
  await density.pressSequentially('1.23456');
  await expect(density).toHaveValue('1.234');
});

test('三個 0 按鈕都能用，按 0 之後再打數字不會留下前面的 0', async ({ page }) => {
  for (const id of ['can', 'water', 'left']) {
    await page.click(`[data-zero="${id}"]`);
    await expect(page.locator('#' + id)).toHaveValue('0');
  }
  await page.locator('#can').press('End');
  await page.locator('#can').pressSequentially('7');
  await expect(page.locator('#can')).toHaveValue('7');
});

test('截圖的例子：罐頭 10g、0.85、加水 2g、剩 3g → 6.38 大卡，並列出算式', async ({ page }) => {
  await calc(page, '10', '2', '3');
  await expect(page.locator('#kcal')).toHaveText('6.38');
  expect(await steps(page)).toEqual([
    '10.00g + 2.00g = 12.00g',
    '12.00g − 3.00g = 9.00g',
    '10.00g ÷ 12.00g = 83.33%',
    '83.33% × 9.00g = 7.50g',
    '7.50g × 0.85 = 6.38 大卡',
    '9.00g − 7.50g = 1.50g',
  ]);
});

test('選 0.966、沒加水也沒剩：算式正確', async ({ page }) => {
  await page.click('label.radio:has(input[value="0.966"])');
  await calc(page, '85', '', '');
  await expect(page.locator('#kcal')).toHaveText('82.11');
  expect(await steps(page)).toEqual([
    '85.00g + 0.00g = 85.00g',
    '85.00g − 0.00g = 85.00g',
    '85.00g ÷ 85.00g = 100.00%',
    '100.00% × 85.00g = 85.00g',
    '85.00g × 0.966 = 82.11 大卡',
  ]);
});

test('上一筆是真正的前一筆，而且排法和這一筆一樣', async ({ page }) => {
  // 第一筆：還沒有上一筆
  await calc(page, '10', '2', '3');
  const first = await steps(page);
  await expect(page.locator('#prev')).toBeHidden();

  // 同樣的數字再按一次計算，不能把自己變成上一筆
  await page.click('.btn-calc');
  await expect(page.locator('#prev')).toBeHidden();

  // 第二筆：上一筆 = 第一筆
  await calc(page, '85', '10', '7.5');
  await expect(page.locator('#kcal')).toHaveText('66.55');
  await expect(page.locator('#prev')).toBeVisible();
  await expect(page.locator('#prevKcal')).toHaveText('6.38');
  expect(await prevSteps(page)).toEqual(first);
  const second = await steps(page);

  // 第三筆：上一筆 = 第二筆
  await calc(page, '80', '20', '33.33');
  await expect(page.locator('#prevKcal')).toHaveText('66.55');
  expect(await prevSteps(page)).toEqual(second);
});

test('修改數字但還沒重算時，舊結果會標示要重算', async ({ page }) => {
  await calc(page, '10', '2', '3');
  await expect(page.locator('#result')).not.toHaveClass(/stale/);
  await page.locator('#left').pressSequentially('5');
  await expect(page.locator('#result')).toHaveClass(/stale/);
});

test('重新整理後，打到一半的數字、熱量選項和紀錄都還在', async ({ page }) => {
  await page.click('label.radio:has(input[value="custom"])');
  await page.locator('#density').pressSequentially('1.05');
  await calc(page, '80', '20', '33.33');
  await page.fill('#can', '70');   // 打到一半

  await page.reload();
  await expect(page.locator('#can')).toHaveValue('70');
  await expect(page.locator('#water')).toHaveValue('20');
  await expect(page.locator('input[value="custom"]')).toBeChecked();
  await expect(page.locator('#density')).toHaveValue('1.05');
  await expect(page.locator('#prev')).toBeVisible();
  await expect(page.locator('#prevKcal')).toHaveText('56.01');
});

test('重置會清空重量，剛剛那筆變成上一筆', async ({ page }) => {
  await calc(page, '10', '2', '3');
  await page.click('#resetBtn');
  for (const id of ['can', 'water', 'left']) {
    await expect(page.locator('#' + id)).toHaveValue('');
  }
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('#prevKcal')).toHaveText('6.38');
});

test('輸入有問題時會提醒', async ({ page }) => {
  const error = page.locator('#error');

  await page.click('.btn-calc');
  await expect(error).toContainText('罐頭重量');

  await calc(page, '10', '2', '20');
  await expect(error).toContainText('不能比總重量');
  await expect(page.locator('#result')).toBeHidden();

  await page.click('[data-zero="can"]');
  await page.click('[data-zero="water"]');
  await page.click('[data-zero="left"]');
  await page.click('.btn-calc');
  await expect(error).toContainText('總重量是 0');
});

test('罐頭 0g、只有水 → 0 大卡', async ({ page }) => {
  await page.click('[data-zero="can"]');
  await page.fill('#water', '5');
  await page.click('.btn-calc');
  await expect(page.locator('#kcal')).toHaveText('0.00');
});

test('隨機 500 組數字：畫面上每一行算式都對得起來，上一筆也都正確', async ({ page }) => {
  const result = await page.evaluate(() => {
    // Seeded random numbers, so a failure can be reproduced.
    let seed = 20261106;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const num = (s) => parseFloat(s.replace(/[g%大卡\s]/g, ''));
    const set = (id, v) => {
      const el = /** @type {HTMLInputElement} */ (document.getElementById(id));
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const texts = (sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent || '');
    const problems = [];
    let last = null;

    for (let i = 0; i < 500; i++) {
      const can = (Math.floor(rand() * 20000) + 1) / 100;
      const water = rand() < 0.3 ? 0 : Math.floor(rand() * 5000) / 100;
      const left = Math.floor(rand() * (can + water) * 100) / 100;
      const dens = ['0.85', '0.966'][i % 2];
      const radio = /** @type {HTMLInputElement} */ (document.querySelector(`input[value="${dens}"]`));
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      set('can', String(can));
      set('water', String(water));
      set('left', String(left));
      /** @type {HTMLElement} */ (document.querySelector('.btn-calc')).click();

      const eqs = texts('#steps .eq');
      const [a, b, total] = eqs[0].split(/[+=]/).map(num);
      const [t2, l, eaten] = eqs[1].split(/[−=]/).map(num);
      const [c0, t3, pct] = eqs[2].split(/[÷=]/).map(num);
      const [p2, e2, eatenCan] = eqs[3].split(/[×=]/).map(num);
      const [c2, d, kcal] = eqs[4].split(/[×=]/).map(num);
      const close = (x, y) => Math.abs(x - y) <= 0.005 + 1e-9;
      const ok =
        a === can && b === water && l === left && c0 === can && d === Number(dens) &&
        close(total, a + b) && t2 === total && close(eaten, t2 - l) &&
        t3 === total && close(pct, (c0 / t3) * 100) &&
        p2 === pct && e2 === eaten && close(eatenCan, (p2 / 100) * e2) &&
        c2 === eatenCan && close(kcal, c2 * d) &&
        document.getElementById('kcal')?.textContent === kcal.toFixed(2);
      if (!ok) problems.push({ can, water, left, dens, eqs });

      if (last) {
        const prev = texts('#prevSteps .eq').join('|');
        if (prev !== last) problems.push({ prevMismatch: true, expected: last, got: prev });
      }
      last = eqs.join('|');
    }
    return problems.slice(0, 5);
  });
  expect(result).toEqual([]);
});

test('小螢幕手機（320px 寬）不會左右滑動', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await calc(page, '85.25', '10.5', '17.75');
  await calc(page, '10', '2', '3');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
