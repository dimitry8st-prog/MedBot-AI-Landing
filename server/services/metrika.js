'use strict';

function injectMetrika(html) {
  const id = (process.env.YANDEX_METRIKA_ID || '').trim();
  if (!id) {
    return html.replace(
      '</head>',
      `<script>window.__YM_ID__=null;</script>\n<!-- Yandex.Metrika: задайте YANDEX_METRIKA_ID в .env -->\n</head>`
    );
  }

  const snippet = `
<script>window.__YM_ID__=${JSON.stringify(id)};</script>
<!-- Yandex.Metrika counter -->
<script type="text/javascript">
(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();
for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
ym(${JSON.stringify(id)}, "init", {clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true});
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/${id}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->
`;
  return html.replace('</head>', `${snippet}\n</head>`);
}

module.exports = { injectMetrika };
