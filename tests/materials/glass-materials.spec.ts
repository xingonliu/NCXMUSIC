import { expect, test, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { resolve } from 'node:path'

let app: ElectronApplication
let page: Page
let errors: string[]
test.beforeEach(async () => {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  delete env['ELECTRON_RUN_AS_NODE']
  app = await electron.launch({ args: [resolve('tests/fixtures/glass-materials/electron.mjs')], env })
  page = await app.firstWindow()
  errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.getByTestId('clear').waitFor()
})
test.afterEach(async () => { await app?.close(); expect(errors).toEqual([]) })

test('all tiers render independently, resize, and follow theme', async () => {
  for (const material of ['clear', 'tinted', 'dialog']) {
    await expect(page.getByTestId(material).locator('.ncx-glass-surface').first()).toHaveAttribute('data-material', material)
    await expect(page.getByTestId(material).locator('feDisplacementMap').first()).toHaveCount(1)
  }
  await expect(page.getByTestId('blur').locator('svg')).toHaveCount(0)
  await page.screenshot({ path: 'output/playwright/materials/light.png', fullPage: true })
  const before = await page.getByTestId('dialog').locator('feImage').first().getAttribute('href')
  await page.getByRole('button', { name: '调整尺寸' }).click()
  await expect.poll(() => page.getByTestId('dialog').locator('feImage').first().getAttribute('href')).not.toBe(before)
  await page.getByRole('button', { name: '切换主题' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({ path: 'output/playwright/materials/dark.png', fullPage: true })
})

test('press deformation, release, keyboard and disabled behavior', async () => {
  for (const material of ['clear', 'tinted', 'blur', 'icon']) {
    const button = page.getByTestId(material)
    const box = (await button.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await expect.poll(() => button.evaluate(el => Number(el.style.getPropertyValue('--ncx-press-progress')))).toBeGreaterThan(0.8)
    expect(await button.boundingBox()).toEqual(box)
    await page.mouse.up()
    await expect.poll(() => button.evaluate(el => el.style.getPropertyValue('--ncx-press-progress'))).toBe('')
  }
  await expect(page.getByRole('status')).toHaveText('4')
  await page.getByTestId('blur').focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('status')).toHaveText('5')
  await expect(page.getByTestId('disabled')).toBeDisabled()
})

test('real refraction affects pixels and samples live backdrop without rebuilding maps', async () => {
  const button = page.getByTestId('clear')
  await expect(button.locator('.ncx-glass-surface')).toHaveAttribute('data-material', 'clear')
  const refracted = await button.screenshot()
  expect((await button.screenshot()).equals(refracted)).toBe(true)
  await button.locator('feDisplacementMap').evaluate(el => el.setAttribute('scale', '0'))
  const flat = await button.screenshot()
  expect(refracted.equals(flat)).toBe(false)
  await button.locator('feDisplacementMap').evaluate(el => el.setAttribute('scale', '48'))
  const map = await button.locator('feImage').getAttribute('href')
  await page.locator('.glass-lab-backdrop').evaluate(el => { (el as HTMLElement).style.transform = 'translateX(53px)' })
  const changed = await button.screenshot()
  expect(changed.equals(refracted)).toBe(false)
  expect(await button.locator('feImage').getAttribute('href')).toBe(map)
})

test('integrated dialog and drawer keep focus, scrolling and material separate', async () => {
  const trigger = page.getByRole('button', { name: '打开弹窗', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: '材质弹窗', exact: true })
  await expect(dialog.locator(':scope > .ncx-glass-surface')).toHaveAttribute('data-material', 'dialog')
  await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await expect(dialog.getByRole('button', { name: '完成' }).locator('.ncx-glass-surface')).toHaveAttribute('data-material', 'tinted')
  await page.screenshot({ path: 'output/playwright/materials/integrated-dialog.png' })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await page.getByRole('button', { name: '打开抽屉', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: '材质抽屉', exact: true })
  await expect(drawer.locator(':scope > .ncx-glass-surface')).toHaveAttribute('data-material', 'dialog')
  const body = drawer.locator('.ncx-common-drawer-body')
  await body.evaluate(el => { el.scrollTop = 300 })
  expect(await body.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  await page.screenshot({ path: 'output/playwright/materials/integrated-drawer.png' })
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
})

test('reduced motion and forced colors retain usable controls', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const button = page.getByTestId('clear')
  await button.focus()
  await page.keyboard.down('Space')
  expect(await button.evaluate(el => el.style.getPropertyValue('--ncx-press-progress'))).toBe('')
  await page.keyboard.up('Space')
  await expect(page.getByRole('status')).toHaveText('1')
  await page.emulateMedia({ forcedColors: 'active' })
  await expect(button.locator('.ncx-glass-surface')).toHaveAttribute('data-material', 'solid')
  await expect(button.locator('svg')).toHaveCount(0)
})
