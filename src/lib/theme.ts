/** Aparência: "system" segue o aparelho. Preferência só deste aparelho (não vai para a nuvem). */
export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'myloja:theme:v1'

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(pref: ThemePref = getThemePref()) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171311' : '#9f3a5c')
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* sem armazenamento: vale só até recarregar */
  }
  applyTheme(pref)
}

/** Reage a mudanças do aparelho quando a preferência é "system". */
export function watchSystemTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', () => getThemePref() === 'system' && applyTheme('system'))
}
