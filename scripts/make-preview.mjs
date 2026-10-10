// Arma la página de vista previa (un solo archivo) a partir de dist-demo/.
// Las fuentes salen de Google Fonts porque la página publicada no puede traer archivos propios.
import { readFileSync, writeFileSync } from 'node:fs'

const js = readFileSync('dist-demo/app.js', 'utf8').replace(/<\/script/gi, '<\\/script')
const css = readFileSync('dist-demo/app.css', 'utf8').replace(/<\/style/gi, '<\\/style')

const html = `<title>HaxMatch</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&display=swap">
<style>
${css}
/* La página publicada ya deja libre el espacio de las barras del sistema. */
:root { --safe-top: 0px; --safe-bottom: 0px; }
</style>
<div id="root"></div>
<script>
${js}
</script>
`
writeFileSync('dist-demo/haxmatch-demo.html', html)
console.log(`dist-demo/haxmatch-demo.html · ${(html.length / 1024).toFixed(0)} KB`)
