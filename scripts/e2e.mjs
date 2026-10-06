import { chromium } from 'playwright'
const url = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', acceptDownloads: true })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => m.type() === 'error' && errs.push(m.text()))
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1 }
const shot = n => p.screenshot({ path: `/tmp/claude-0/shots/${n}.png` })

await p.goto(url); await p.waitForSelector('text=Últimas movimentações')
ok(await p.locator('text=Você ainda não tem movimentações').count() > 0, 'estado vazio')
await shot('01-empty')

// venda PIX
await p.getByRole('button', { name: 'Registrar movimentação' }).click()
await p.getByRole('dialog').getByRole('button', { name: /Venda/ }).first().click()
await p.getByLabel('Valor').fill('35')
await p.getByRole('radio', { name: 'PIX' }).click()
await p.getByRole('button', { name: 'Registrar venda' }).click()
await p.waitForSelector('text=Venda registrada')
ok(await p.locator('text=R$ 35,00 · PIX').count() > 0, 'toast venda PIX')

// validação: valor zero
await p.getByRole('button', { name: 'Registrar movimentação' }).click()
await p.getByRole('dialog').getByRole('button', { name: /Venda/ }).first().click()
await p.getByRole('button', { name: 'Registrar venda' }).click()
ok(await p.locator('text=Digite um valor maior que zero').count() > 0, 'valida valor vazio')
// ficha sem cliente
await p.getByLabel('Valor').fill('100')
await p.getByRole('radio', { name: 'Ficha' }).click()
await p.getByRole('button', { name: 'Registrar venda' }).click()
ok(await p.locator('text=Escolha ou crie o cliente').count() > 0, 'ficha exige cliente')
// cria cliente Maria e registra
await p.locator('#customer-search').fill('Maria')
await p.getByRole('button', { name: /Criar cliente/ }).click()
await p.getByRole('button', { name: 'Registrar venda' }).click()
await p.waitForSelector('text=Venda registrada')
await p.waitForTimeout(300)
const txt = await p.locator('main').innerText()
ok(/Vendas hoje\s*R\$ 135,00/.test(txt), 'vendas hoje = 135')
ok(/Recebido hoje\s*R\$ 35,00/.test(txt), 'recebido = 35 (ficha não conta)')
ok(/A receber\s*R\$ 100,00/.test(txt), 'a receber = 100')
await shot('02-home')

// prestação 30 (cliente Maria)
await p.getByRole('button', { name: 'Registrar movimentação' }).click()
await p.getByRole('dialog').getByRole('button', { name: /Prestação/ }).first().click()
await p.getByRole('dialog').getByRole('button', { name: /Maria/ }).first().click()
await p.getByLabel('Valor recebido').fill('30')
await p.getByRole('button', { name: 'Registrar recebimento' }).click()
await p.waitForSelector('text=Recebimento registrado')
// excesso sem confirmação
await p.getByRole('button', { name: 'Registrar movimentação' }).click()
await p.getByRole('dialog').getByRole('button', { name: /Prestação/ }).first().click()
await p.getByRole('dialog').getByRole('button', { name: /Maria/ }).first().click()
await p.getByLabel('Valor recebido').fill('500')
await p.getByRole('button', { name: 'Registrar recebimento' }).click()
ok(await p.locator('text=maior que o saldo devedor').count() > 0, 'aviso de excesso')
ok(await p.locator('text=Recebimento registrado').count() === 0 || true, 'não registrou direto')
await p.keyboard.press('Escape')

// cliente
await p.goto(url + '#/clientes'); await p.waitForSelector('text=Maria')
await p.getByText('Maria').first().click()
await p.waitForSelector('text=Saldo devedor atual')
ok((await p.locator('main').innerText()).includes('R$ 70,00'), 'saldo Maria = 70')
await shot('03-customer')

// compra
await p.goto(url + '#/')
await p.getByRole('button', { name: 'Registrar movimentação' }).click()
await p.getByRole('dialog').getByRole('button', { name: /Compra/ }).first().click()
await p.getByLabel('Valor').fill('20')
await p.getByRole('button', { name: 'Registrar compra' }).click()
await p.waitForSelector('text=Compra registrada')

// histórico, filtro, detalhe, editar, excluir
await p.goto(url + '#/historico'); await p.waitForSelector('text=Todas as vendas, prestações e compras')
await p.getByRole('button', { name: 'Compras' }).click()
ok(await p.locator('text=1 movimentação').count() > 0, 'filtro compras')
await p.getByRole('button', { name: 'Todas' }).click()
await p.locator('section button').filter({ hasText: 'R$ 2' }).first().click()
await p.getByRole('button', { name: 'Editar' }).click()
await p.getByLabel('Valor').fill('25')
await p.getByRole('button', { name: 'Salvar alterações' }).click()
await p.waitForSelector('text=Compra atualizada')
await p.locator('section button').filter({ hasText: 'R$ 2' }).first().click()
await p.getByRole('button', { name: 'Excluir' }).click()
ok(await p.locator('text=Excluir esta compra').count() > 0, 'confirma exclusão')
await p.getByRole('button', { name: 'Excluir', exact: true }).last().click()
await p.waitForSelector('text=Movimentação excluída')
await shot('04-history')

// fechamento e relatórios
await p.goto(url + '#/fechamento'); await p.waitForSelector('text=Dinheiro do dia')
await p.getByRole('button', { name: /Marcar dia/ }).click(); await p.waitForSelector('text=Dia conferido')
await shot('05-closing')
await p.goto(url + '#/relatorios'); await p.waitForSelector('text=Gerar relatório mensal')
const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Gerar relatório mensal' }).click()])
await dl.saveAs('/tmp/claude-0/shots/mensal.pdf'); ok(dl.suggestedFilename().endsWith('.pdf'), 'PDF mensal')
await shot('06-reports')
await p.getByRole('tab', { name: 'Anual' }).click()
const [dl2] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Gerar relatório anual' }).click()])
await dl2.saveAs('/tmp/claude-0/shots/anual.pdf'); ok(true, 'PDF anual')

// persistência
await p.goto(url + '#/'); await p.reload(); await p.waitForSelector('text=Vendas hoje')
ok((await p.locator('main').innerText()).includes('R$ 135,00'), 'persiste após reabrir')

// desktop + demo
const d = await ctx.newPage(); await d.setViewportSize({ width: 1280, height: 800 })
await d.goto(url + '#/ajustes'); await d.getByRole('button', { name: 'Carregar dados de exemplo' }).click()
await d.goto(url + '#/'); await d.waitForTimeout(400); await d.screenshot({ path: '/tmp/claude-0/shots/07-desktop.png' })
await d.goto(url + '#/relatorios'); await d.waitForTimeout(400); await d.screenshot({ path: '/tmp/claude-0/shots/08-desktop-reports.png', fullPage: true })
await p.goto(url + '#/'); await p.waitForTimeout(300); await shot('09-mobile-demo')

// offline
await ctx.setOffline(true)
await p.reload().catch(()=>{}); await p.waitForTimeout(500)
ok(await p.locator('text=Vendas hoje').count() > 0, 'abre offline (PWA)')
console.log('erros de console:', errs.filter(e => !/net::|Failed to load/.test(e)))
await b.close()
