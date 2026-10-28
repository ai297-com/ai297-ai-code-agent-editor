/**
 * `npm i -g` sırasında uygulamayı hemen kuruyor: ilk `ai297` beklemeden açılsın. Hata kurulumu
 * düşürmüyor (çevrimdışı, CI, `--ignore-scripts`): ilk `ai297` çağrısı kurulumu yeniden deniyor.
 */
const { install, installed } = require('./app.js')

if (process.env.CI || process.env.AI297_SKIP_INSTALL || process.env.npm_config_global !== 'true') process.exit(0)
if (installed()) process.exit(0)
install().catch((err) => console.error(`ai297: install will be retried on first run (${err.message})`))
