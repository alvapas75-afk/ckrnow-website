// ============================================================
// CKR BOUTIQUE — Stock Webhook (Google Apps Script)
// Recibe productos vendidos via Wompi y actualiza stock.json
// en GitHub automáticamente.
//
// INSTRUCCIONES DE CONFIGURACIÓN:
// 1. Ir a script.google.com → Nuevo proyecto
// 2. Pegar este código completo
// 3. Menú: Proyecto → Propiedades del proyecto → Propiedades del script
//    Agregar: GITHUB_TOKEN = (tu token de GitHub)
// 4. Menú: Implementar → Nueva implementación
//    Tipo: Aplicación web
//    Ejecutar como: Yo (alvapas75@gmail.com)
//    Acceso: Cualquier persona
//    → Copiar la URL que genera
// 5. En js/main.js, pegar esa URL en: const CKR_STOCK_WEBHOOK = '...'
// 6. git add + commit + push
// ============================================================

var GITHUB_REPO = 'alvapas75-afk/ckrnow-website';
var STOCK_FILE  = 'stock.json';

function doPost(e) {
  try {
    var nombres = (e.parameter.productos || '').split(',').map(function(n){ return n.trim(); }).filter(Boolean);
    if (nombres.length) marcarAgotados(nombres);
  } catch(err) {
    Logger.log('Error: ' + err);
  }
  return ContentService.createTextOutput('ok');
}

function doGet() {
  return ContentService.createTextOutput('CKR Stock Webhook activo ✓');
}

function marcarAgotados(nombres) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  var apiUrl = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + STOCK_FILE;
  var headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json'
  };

  // Leer stock.json actual
  var res  = UrlFetchApp.fetch(apiUrl, { headers: headers });
  var meta = JSON.parse(res.getContentText());
  var raw  = Utilities.newBlob(Utilities.base64Decode(meta.content.replace(/\n/g,''))).getDataAsString();
  var stock = JSON.parse(raw);

  // Agregar nombres nuevos sin duplicar
  nombres.forEach(function(n) {
    if (stock.agotados.indexOf(n) === -1) stock.agotados.push(n);
  });

  // Escribir stock.json actualizado en GitHub
  var newContent = Utilities.base64Encode(JSON.stringify(stock, null, 2), Utilities.Charset.UTF_8);
  UrlFetchApp.fetch(apiUrl, {
    method: 'PUT',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    payload: JSON.stringify({
      message: 'Stock auto: vendido via Wompi — ' + nombres.join(', '),
      content: newContent,
      sha: meta.sha
    })
  });
}
