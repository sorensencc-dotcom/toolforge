const fs = require('node:fs'); const path = require('node:path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function atomicWrite(target, data, options = {}) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'); const dir = path.dirname(target); fs.mkdirSync(dir, { recursive: true });
  const id = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`; const tmp = `${target}.tmp.${id}`; const bak = `${target}.bak.${id}`;
  let backup = false;
  try {
    const fd = fs.openSync(tmp, 'w'); try { fs.writeFileSync(fd, buffer); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (fs.existsSync(target)) { const bfd = fs.openSync(bak, 'w'); try { fs.writeFileSync(bfd, fs.readFileSync(target)); fs.fsyncSync(bfd); } finally { fs.closeSync(bfd); } backup = true; }
    let last;
    for (let i = 0; i < 5; i++) { try { fs.renameSync(tmp, target); last = null; break; } catch (e) { last = e; if (!['EPERM','EBUSY','EEXIST'].includes(e.code) || i === 4) throw e; await sleep(25 * 2 ** i); } }
    if (last) throw last;
    if (fs.statSync(target).size !== buffer.length) throw Object.assign(new Error('Atomic write length mismatch'), { code: 'ERR_WRITE_VERIFY' });
  } catch (e) { if (backup && !fs.existsSync(target)) { try { fs.renameSync(bak, target); } catch {} } throw e; }
  finally { for (const f of [tmp, bak]) { try { fs.unlinkSync(f); } catch {} } }
}
module.exports = { atomicWrite };
