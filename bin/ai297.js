#!/usr/bin/env node
/**
 * **`ai297` komutu** — `ai297 [klasör | dosya[:satır]]…`. Masaüstü uygulamasını açıyor ve konsolu
 * bırakıyor (VS Code'un `code`u gibi); uygulama kurulu değilse önce indirip kuruyor (bkz. lib/app.js).
 * Argümansız: bulunulan klasör açılıyor; ev dizininde boş pencere.
 */
const { homedir } = require('node:os')
const { resolve } = require('node:path')
const { install, installed, launch } = require('../lib/app.js')

const args = process.argv.slice(2)
if (args[0] === '--version' || args[0] === '-v') {
  console.log(require('../package.json').version)
  process.exit(0)
}
if (args[0] === '--help' || args[0] === '-h') {
  console.log('Usage: ai297 [folder | file[:line]]...\n\n  ai297              open the current folder\n  ai297 src/app.ts:42\n  ai297 --reinstall  download and install the latest desktop app again\n  ai297 --version')
  process.exit(0)
}
const reinstall = args[0] === '--reinstall'
if (reinstall) args.shift()
if (!args.length && resolve(process.cwd()) !== resolve(homedir())) args.push('.')

;(async () => {
  const exe = (!reinstall && installed()) || (await install())
  launch(exe, args)
})().catch((err) => {
  console.error(`ai297: ${err.message}`)
  process.exit(1)
})
