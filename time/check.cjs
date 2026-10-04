const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const html = readFileSync(`${__dirname}/index.html`, 'utf8');
assert.equal(html.trim().split('\n').length, 1, 'HTML must be minified');
assert.equal((html.match(/<section>/g) || []).length, 3);
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
for (const [instant, expected] of [
  ['2026-01-01T00:00:00Z', ['00:00:00', '08:00:00', '11:00:00']],
  ['2026-07-01T00:00:00Z', ['01:00:00', '08:00:00', '10:00:00']],
  ['2026-10-03T15:59:59Z', ['16:59:59', '23:59:59', '01:59:59']],
  ['2026-10-03T16:00:00Z', ['17:00:00', '00:00:00', '03:00:00']],
]) {
  let now = Date.parse(instant), refresh;
  const clocks = [{}, {}, {}];
  runInNewContext(script, {
    Intl, Date: class extends Date { constructor() { super(now); } },
    document: {querySelectorAll: () => clocks},
    setInterval: (callback, delay) => { assert.equal(delay, 1000); refresh = callback; },
  });
  assert.deepEqual(clocks.map(clock => clock.textContent), expected, instant);
  assert.ok(clocks.every(clock => clock.dateTime === new Date(now).toISOString()));
  now += 1000;
  refresh();
  assert.ok(clocks.every(clock => clock.dateTime === new Date(now).toISOString()));
}
console.log('Passed: minified HTML, three clocks, midnight, DST, and live refresh.');
