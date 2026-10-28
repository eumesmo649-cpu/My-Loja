// Teste de ponta a ponta da Etapa 1: serve dist/ com os cabeçalhos do vercel.json (CSP incluída).
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const dist = path.resolve('dist')
const headers = Object.fromEntries(JSON.parse(fs.readFileSync('vercel.json', 'utf8')).headers[0].headers.map((h) => [h.key, h.value]))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' }
const server = http.createServer((req, res) => {
  let f = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html')
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', ...headers })
  fs.createReadStream(f).pipe(res)
}).listen(0)
const url = `http://localhost:${server.address().port}/`

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', serviceWorkers: 'block' })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
p.on('dialog', (d) => d.accept('EXCLUIR'))
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1 }
const shot = (n) => p.screenshot({ path: `/tmp/claude-0/shots/${n}.png` })

await p.goto(url); await p.waitForSelector('text=Últimas movimentações')
ok(true, 'app abre sob a CSP do vercel.json')

// despesa -> lixeira -> restaurar
await p.getByRole('button', { name: 'Registrar movimentação' }).click()
await p.getByRole('dialog').getByRole('button', { name: /Despesa/ }).first().click()
await p.getByLabel('Valor').fill('12')
await p.getByLabel(/Descri|O que/).first().fill('sacolas').catch(() => {})
await p.getByRole('button', { name: /Registrar despesa/ }).click()
await p.waitForTimeout(400)

// loja + PIN
await p.goto(url + '#/ajustes'); await p.waitForSelector('text=Minha loja')
await p.getByLabel('Nome da loja').fill('Loja da Maria')
await p.getByRole('button', { name: 'Salvar', exact: true }).first().click()
await p.getByRole('button', { name: 'Criar PIN' }).click()
await p.getByLabel(/Novo PIN/).fill('4821')
await p.getByLabel('Repita o PIN').fill('4821')
await p.getByRole('button', { name: 'Salvar PIN' }).click()
await p.waitForSelector('text=Desativar')
ok(await p.locator('text=Bloquear agora').count() > 0, 'PIN criado')

// recarrega: bloqueado, com nome da loja
await p.reload()
await p.waitForSelector('[role=dialog][aria-label="App bloqueado"]')
ok(await p.locator('h1:has-text("Loja da Maria")').count() > 0, 'tela de bloqueio mostra o nome da loja')
ok(await p.locator('[inert]').count() > 0, 'conteúdo do app fica inerte enquanto bloqueado')
await shot('lock')
for (const d of '1111') await p.keyboard.press(d)
await p.waitForSelector('text=PIN incorreto')
ok(true, 'PIN errado recusado')
for (const d of '4821') await p.keyboard.press(d)
await p.waitForSelector('[role=dialog][aria-label="App bloqueado"]', { state: 'detached' })
ok(true, 'PIN certo destrava')

// lixeira
await p.goto(url + '#/historico'); await p.waitForSelector('text=Despesa')
await p.locator('button:has-text("sacolas")').first().click()
await p.getByRole('button', { name: 'Excluir', exact: true }).click()
await p.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).last().click().catch(() => {})
await p.waitForTimeout(400)
await p.goto(url + '#/lixeira'); await p.waitForSelector('h1:has-text("Lixeira")')
ok(await p.locator('text=Restaurar').count() > 0, 'item excluído aparece na lixeira')
await p.getByRole('button', { name: 'Restaurar' }).first().click()
await p.waitForTimeout(300)
ok(await p.locator('text=Lixeira vazia').count() > 0, 'restaurar esvazia a lixeira')
await shot('trash')

// privacidade
await p.goto(url + '#/privacidade'); await p.waitForSelector('h1:has-text("Aviso de privacidade")')
ok(true, 'página de privacidade')

// esqueci o PIN (sem conta): apaga dados do aparelho e remove o bloqueio
await p.goto(url + '#/ajustes'); await p.getByRole('button', { name: 'Bloquear agora' }).click()
await p.getByRole('button', { name: 'Esqueci meu PIN' }).click()
await p.getByRole('button', { name: 'Apagar dados deste aparelho' }).click()
await p.getByRole('button', { name: 'Apagar tudo e remover bloqueio' }).click()
await p.waitForSelector('[role=dialog][aria-label="App bloqueado"]', { state: 'detached' })
await p.goto(url + '#/'); await p.reload(); await p.waitForSelector('text=Últimas movimentações')
ok(await p.locator('[aria-label="App bloqueado"]').count() === 0, 'após recuperar, o bloqueio não volta')

const csp = errs.filter((e) => /Content Security Policy|Refused to/i.test(e))
ok(csp.length === 0, 'nenhuma violação de CSP' + (csp.length ? ': ' + csp.join(' | ') : ''))
const other = errs.filter((e) => !/Content Security Policy|Refused to/i.test(e))
ok(other.length === 0, 'sem erros no console' + (other.length ? ': ' + other.join(' | ') : ''))
await b.close(); server.close()
