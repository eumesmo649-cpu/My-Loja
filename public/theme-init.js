// Aplica o tema antes da 1ª pintura (evita "piscar" claro). Arquivo externo por causa da CSP.
(function () {
  try {
    var pref = localStorage.getItem('myloja:theme:v1')
    var dark = pref === 'dark' || ((pref === 'system' || !pref) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    var m = document.querySelector('meta[name="theme-color"]')
    if (m) m.setAttribute('content', dark ? '#171311' : '#9f3a5c')
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light')
  }
})()
