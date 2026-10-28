/**
 * **Masaüstü uygulamasını bulur, yoksa kurar.** npm paketi uygulamanın kodunu taşımıyor:
 * cihaza uygun kurulum dosyasını GitHub Releases'tan (`releases/latest/download/…`, sürümsüz
 * adlar — bkz. electronjs/electron-builder.yml) indirip kuruyor. Kurulan uygulama paketlenmiş
 * hâliyle kendini güncelliyor (electron-updater); npm paketi yalnız başlatıcı.
 *
 * Node ile indirilen dosya "internetten geldi" işareti taşımıyor: Windows SmartScreen ve
 * macOS Gatekeeper uyarısı çıkmıyor.
 */
const { spawn, spawnSync } = require('node:child_process')
const { createWriteStream, existsSync, mkdirSync, mkdtempSync, rmSync, chmodSync } = require('node:fs')
const { homedir, tmpdir } = require('node:os')
const { join } = require('node:path')
const { Readable } = require('node:stream')
const { pipeline } = require('node:stream/promises')

const RELEASES = process.env.AI297_DOWNLOADS_URL || 'https://github.com/ai297-com/ai-code-editor/releases/latest/download'
const home = homedir()

/** Bu cihazın kurulum dosyası ve uygulamanın kurulduğu (aranacağı) yerler. */
function platform() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')
    return {
      asset: 'ai297-Setup-x64.exe',
      // NSIS kullanıcı başına kuruyor (perMachine: false); eski kurulumlar Program Files'ta.
      candidates: [join(local, 'Programs', 'ai297', 'ai297.exe'), join(process.env.ProgramFiles || 'C:\\Program Files', 'ai297', 'ai297.exe')],
    }
  }
  if (process.platform === 'darwin') {
    const exe = (dir) => join(dir, 'ai297.app', 'Contents', 'MacOS', 'ai297')
    return { asset: `ai297-mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}.dmg`, candidates: [exe('/Applications'), exe(join(home, 'Applications'))] }
  }
  if (process.platform === 'linux' && process.arch === 'x64') {
    return { asset: 'ai297-linux-x86_64.AppImage', candidates: [join(home, '.local', 'share', 'ai297', 'ai297.AppImage')] }
  }
  throw new Error(`ai297 has no build for ${process.platform}-${process.arch} yet. See https://ai297.com/download`)
}

const installed = () => platform().candidates.find((p) => existsSync(p)) ?? null

async function download(url, file) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30 * 60_000) })
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status}): ${url}`)
  const total = Number(res.headers.get('content-length')) || 0
  let done = 0
  let shown = -1
  const body = Readable.fromWeb(res.body)
  body.on('data', (chunk) => {
    done += chunk.length
    const pct = total ? Math.floor((done / total) * 100) : -1
    if (process.stderr.isTTY && pct !== shown) {
      shown = pct
      process.stderr.write(`\r  downloading ${(done / 1048576).toFixed(0)} MB${total ? ` / ${(total / 1048576).toFixed(0)} MB (${pct}%)` : ''}`)
    }
  })
  await pipeline(body, createWriteStream(file))
  if (process.stderr.isTTY) process.stderr.write('\n')
}

const must = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'ignore' })
  if (r.status !== 0) throw new Error(`${cmd} ${args[0] ?? ''} failed (${r.status ?? r.error?.message})`)
}

/** Kurulum dosyasını indirip kuruyor; kurulan uygulamanın yolunu döndürüyor. */
async function install() {
  const { asset, candidates } = platform()
  console.error(`ai297: installing the desktop app (${asset})…`)
  const tmp = mkdtempSync(join(tmpdir(), 'ai297-'))
  try {
    const file = join(tmp, asset)
    await download(`${RELEASES}/${asset}`, file)
    if (process.platform === 'win32') {
      // Sessiz NSIS kurulumu: kullanıcı başına, yönetici izni istemiyor.
      must(file, ['/S'])
    } else if (process.platform === 'darwin') {
      const mnt = join(tmp, 'mnt')
      must('hdiutil', ['attach', '-nobrowse', '-quiet', '-mountpoint', mnt, file])
      try {
        mkdirSync(join(home, 'Applications'), { recursive: true })
        rmSync(join(home, 'Applications', 'ai297.app'), { recursive: true, force: true })
        must('ditto', [join(mnt, 'ai297.app'), join(home, 'Applications', 'ai297.app')])
      } finally {
        spawnSync('hdiutil', ['detach', '-quiet', mnt])
      }
    } else {
      mkdirSync(join(candidates[0], '..'), { recursive: true })
      must('cp', [file, candidates[0]])
      chmodSync(candidates[0], 0o755)
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  const exe = installed()
  if (!exe) throw new Error('installation finished but ai297 was not found')
  console.error(`ai297: installed → ${exe}`)
  return exe
}

/** Uygulamayı argümanlarla başlatıp konsolu bırakıyor (tek örnek: açıksa yeni pencere). */
function launch(exe, args) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  spawn(exe, args, { cwd: process.cwd(), env, detached: true, stdio: 'ignore' }).unref()
}

module.exports = { installed, install, launch }
