// ============================================================
// CKR BOUTIQUE — Backend (Google Apps Script)
// 1) Recibe productos vendidos via Wompi y actualiza stock.json
// 2) Crea guias de envio en Envia.com y le avisa al cliente por correo
// 3) Guarda pedidos de Addi/WhatsApp pendientes de guia en pedidos.json
// Todo corre gratis sobre Google Apps Script, sin servidor propio.
//
// INSTRUCCIONES DE CONFIGURACION:
// 1. Ir a script.google.com -> Nuevo proyecto
// 2. Pegar este codigo completo (reemplazar el anterior si ya existia)
// 3. Menu: Proyecto -> Propiedades del proyecto -> Propiedades del script
//    Agregar estas propiedades:
//      GITHUB_TOKEN          = tu token de GitHub (el mismo de siempre)
//      ENVIA_API_KEY         = tu llave de Envia.com (Desarrolladores -> Acceso de API -> Agregar)
//      ORIGEN_NOMBRE         = nombre de quien recoge el paquete (ej: CKR Boutique)
//      ORIGEN_EMAIL          = correo de contacto para el transportador
//      ORIGEN_TELEFONO       = telefono de contacto (solo numeros, ej: 3017604292)
//      ORIGEN_CALLE          = direccion de recogida (calle y numero)
//      ORIGEN_CIUDAD         = ciudad de recogida (ej: Cali)
//      ORIGEN_DEPARTAMENTO   = departamento de recogida (ej: Valle del Cauca)
//      ORIGEN_CODIGO_POSTAL  = codigo postal de recogida
// 4. Menu: Implementar -> Nueva implementacion
//    Tipo: Aplicacion web
//    Ejecutar como: Yo (alvapas75@gmail.com)
//    Acceso: Cualquier persona
//    -> Copiar la URL que genera
// 5. En js/main.js, pegar esa URL en: const CKR_STOCK_WEBHOOK = '...'
// 6. git add + commit + push
//
// IMPORTANTE: revisar el saldo de la billetera de Envia.com (Pagos y
// facturacion -> Recargar) antes de esperar guias reales — sin saldo,
// Envia rechaza la creacion y este script le avisa por correo a la
// propietaria para que la cree manualmente como respaldo.
// ============================================================

var GITHUB_REPO   = 'alvapas75-afk/ckrnow-website';
var STOCK_FILE    = 'stock.json';
var PEDIDOS_FILE  = 'pedidos.json';
var ENVIA_BASE    = 'https://api.envia.com';
var QUERIES_BASE  = 'https://queries.envia.com';
var OWNER_EMAIL   = 'alvapas75@gmail.com';

function doPost(e) {
  try {
    var accion = e.parameter.accion;
    if (!accion) {
      // Compatibilidad con el flujo original (solo marcar agotados)
      var nombres = (e.parameter.productos || '').split(',').map(function(n){ return n.trim(); }).filter(Boolean);
      if (nombres.length) marcarAgotados(nombres);
      return ContentService.createTextOutput('ok');
    }
    if (accion === 'stock') {
      var nombres2 = (e.parameter.productos || '').split(',').map(function(n){ return n.trim(); }).filter(Boolean);
      if (nombres2.length) marcarAgotados(nombres2);
    } else if (accion === 'crear_guia') {
      var pedido = JSON.parse(e.parameter.pedido);
      crearGuia(pedido, null);
    } else if (accion === 'registrar_pedido') {
      var pedido2 = JSON.parse(e.parameter.pedido);
      registrarPedido(pedido2);
    } else if (accion === 'marcar_guia_creada_manual') {
      // Usado desde gestion.html cuando la propietaria confirma un pedido de Addi/WhatsApp
      var pedidoId = e.parameter.pedidoId;
      var d = leerJsonGitHub(PEDIDOS_FILE);
      var p = d.contenido.pedidos.find(function(x){ return x.id === pedidoId; });
      if (p) crearGuia(p, pedidoId);
    }
  } catch (err) {
    Logger.log('Error en doPost: ' + err);
  }
  return ContentService.createTextOutput('ok');
}

function doGet() {
  return ContentService.createTextOutput('CKR Backend activo ✓');
}

// ============================================================
// STOCK (igual que antes)
// ============================================================
function marcarAgotados(nombres) {
  var r = leerJsonGitHub(STOCK_FILE);
  var stock = r.contenido;
  nombres.forEach(function(n) {
    if (stock.agotados.indexOf(n) === -1) stock.agotados.push(n);
  });
  escribirJsonGitHub(STOCK_FILE, stock, 'Stock auto: vendido via Wompi — ' + nombres.join(', '), r.sha);
}

// ============================================================
// PEDIDOS PENDIENTES (Addi / WhatsApp — confirmacion manual)
// ============================================================
function registrarPedido(pedido) {
  var r = leerJsonGitHub(PEDIDOS_FILE);
  var data = r.contenido;
  pedido.id = Utilities.getUuid();
  pedido.fecha = new Date().toISOString();
  pedido.estado = 'pendiente_guia';
  data.pedidos.push(pedido);
  escribirJsonGitHub(PEDIDOS_FILE, data, 'Pedido registrado (' + pedido.metodo + '): ' + pedido.cliente.nombre, r.sha);
}

function actualizarPedido(pedidoId, cambios) {
  if (!pedidoId) return; // pedidos de Wompi no quedan pre-registrados, no hay nada que actualizar
  var r = leerJsonGitHub(PEDIDOS_FILE);
  var data = r.contenido;
  var p = data.pedidos.find(function(x){ return x.id === pedidoId; });
  if (!p) return;
  Object.keys(cambios).forEach(function(k){ p[k] = cambios[k]; });
  escribirJsonGitHub(PEDIDOS_FILE, data, 'Pedido actualizado: ' + p.cliente.nombre, r.sha);
}

// ============================================================
// ENVIA.COM — cotizar + generar guia + avisar al cliente
// ============================================================
function crearGuia(pedido, pedidoId) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('ENVIA_API_KEY');
  if (!apiKey) {
    Logger.log('Falta ENVIA_API_KEY en las propiedades del script.');
    avisarFalloAPropietaria(pedido, 'No hay llave de Envia.com configurada todavia.');
    return;
  }

  try {
    var origen = construirOrigen(apiKey);
    var destino = construirDestino(pedido.cliente, apiKey);
    var totalPrendas = pedido.items.reduce(function(s, it){ return s + (it.qty || 1); }, 0);
    var paquetes = [{
      type: 'box',
      content: 'Ropa y accesorios',
      amount: 1,
      lengthUnit: 'CM',
      weightUnit: 'KG',
      weight: 1,
      dimensions: { length: 30, width: 25, height: 10 }
    }];

    var cotizacion = llamarEnvia('/ship/rate/', { origin: origen, destination: destino, packages: paquetes }, apiKey);
    var tarifas = cotizacion.data || cotizacion.rates || cotizacion;
    if (!tarifas || !tarifas.length) {
      throw new Error('Envia no devolvio tarifas disponibles: ' + JSON.stringify(cotizacion).slice(0, 300));
    }
    tarifas.sort(function(a, b){
      return (a.totalPrice || a.total || a.price || 0) - (b.totalPrice || b.total || b.price || 0);
    });
    var elegida = tarifas[0];

    var guia = llamarEnvia('/ship/generate/', {
      settings: { printFormat: 'PDF', printSize: 'PAPER_4X6' },
      shipment: { carrier: elegida.carrier, service: elegida.service, type: 1 },
      origin: origen,
      destination: destino,
      packages: paquetes
    }, apiKey);

    var info = guia.data || guia;
    var tracking = info.trackingNumber || info.tracking_number || info.tracking || '(revisar en Envia.com)';
    var label = info.label || (info.files && info.files.label) || info.labelUrl || '';

    avisarClienteGuia(pedido.cliente, tracking, label, elegida.carrier);
    actualizarPedido(pedidoId, { estado: 'guia_creada', guia: { tracking: tracking, label: label, carrier: elegida.carrier } });
    Logger.log('Guia creada OK: ' + tracking);
  } catch (err) {
    Logger.log('Error creando guia: ' + err);
    avisarFalloAPropietaria(pedido, String(err));
  }
}

function construirOrigen(apiKey) {
  var p = PropertiesService.getScriptProperties();
  var ciudad = p.getProperty('ORIGEN_CIUDAD');
  var depto = p.getProperty('ORIGEN_DEPARTAMENTO');
  return {
    name: p.getProperty('ORIGEN_NOMBRE') || 'CKR Boutique',
    email: p.getProperty('ORIGEN_EMAIL') || OWNER_EMAIL,
    phone: (p.getProperty('ORIGEN_TELEFONO') || '').replace(/\D/g, ''),
    street: p.getProperty('ORIGEN_CALLE') || '',
    city: ciudad || '',
    state: resolverCodigoEstado(depto, apiKey),
    country: 'CO',
    postalCode: p.getProperty('ORIGEN_CODIGO_POSTAL') || ''
  };
}

function construirDestino(cliente, apiKey) {
  return {
    name: cliente.nombre,
    email: cliente.email,
    phone: (cliente.tel || '').replace(/\D/g, ''),
    street: cliente.dir,
    city: cliente.ciudad,
    state: resolverCodigoEstado(cliente.depto, apiKey),
    country: 'CO',
    postalCode: cliente.cp || ''
  };
}

// Busca el codigo de departamento (ej "Valle del Cauca" -> "VAC") consultando
// la API de Envia en vez de mantener una tabla fija — evita errores por codigos
// desactualizados o mal escritos.
var _cacheEstadosCO = null;
function resolverCodigoEstado(nombreDepto, apiKey) {
  if (!nombreDepto) return '';
  if (!_cacheEstadosCO) {
    var res = UrlFetchApp.fetch(QUERIES_BASE + '/state?country_code=CO', {
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Accept': 'application/json' },
      muteHttpExceptions: true
    });
    var json = JSON.parse(res.getContentText());
    _cacheEstadosCO = json.data || json.states || json || [];
  }
  var normal = normalizarTexto(nombreDepto);
  var match = _cacheEstadosCO.find(function(s){
    return normalizarTexto(s.name || s.nombre || '') === normal;
  });
  return match ? (match.code || match.codigo || '') : nombreDepto;
}

function normalizarTexto(s) {
  return (s || '').toString().toLowerCase()
    .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i')
    .replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').replace(/ñ/g,'n').trim();
}

function llamarEnvia(ruta, cuerpo, apiKey) {
  var res = UrlFetchApp.fetch(ENVIA_BASE + ruta, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Accept': 'application/json' },
    payload: JSON.stringify(cuerpo),
    muteHttpExceptions: true
  });
  var texto = res.getContentText();
  var json;
  try { json = JSON.parse(texto); } catch (e) { throw new Error('Respuesta invalida de Envia: ' + texto.slice(0, 300)); }
  if (res.getResponseCode() >= 400) {
    throw new Error('Envia respondio ' + res.getResponseCode() + ': ' + texto.slice(0, 300));
  }
  return json;
}

function avisarClienteGuia(cliente, tracking, label, carrier) {
  var cuerpo = 'Hola ' + cliente.nombre + ',\n\n' +
    '¡Tu pedido en CKR Boutique ya está en camino! 📦\n\n' +
    'Transportadora: ' + (carrier || 'N/A') + '\n' +
    'Número de guía: ' + tracking + '\n' +
    (label ? 'Puedes ver/descargar tu guía aquí: ' + label + '\n' : '') +
    '\nCualquier duda, escríbenos por WhatsApp: https://wa.me/573017604292\n\n' +
    '¡Gracias por tu compra!\nCKR Boutique';
  MailApp.sendEmail(cliente.email, '📦 Tu guía de envío — CKR Boutique', cuerpo);
}

function avisarFalloAPropietaria(pedido, motivo) {
  try {
    var cuerpo = 'No se pudo crear automáticamente la guía de Envia.com para este pedido.\n\n' +
      'Motivo: ' + motivo + '\n\n' +
      'Cliente: ' + pedido.cliente.nombre + ' · ' + pedido.cliente.tel + ' · ' + pedido.cliente.email + '\n' +
      'Dirección: ' + pedido.cliente.dir + ', ' + pedido.cliente.ciudad + ', ' + pedido.cliente.depto + '\n' +
      'Total: ' + pedido.total + '\n\n' +
      'Por favor crea la guía manualmente desde tu cuenta de Envia.com.';
    MailApp.sendEmail(OWNER_EMAIL, '⚠️ Revisar: guía de envío no se pudo crear', cuerpo);
  } catch (e) { Logger.log('No se pudo avisar a la propietaria: ' + e); }
}

// ============================================================
// GITHUB — helpers genericos de lectura/escritura de JSON
// ============================================================
function leerJsonGitHub(archivo) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  var apiUrl = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + archivo;
  var headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' };
  var res = UrlFetchApp.fetch(apiUrl, { headers: headers });
  var meta = JSON.parse(res.getContentText());
  var raw = Utilities.newBlob(Utilities.base64Decode(meta.content.replace(/\n/g,''))).getDataAsString();
  return { contenido: JSON.parse(raw), sha: meta.sha };
}

function escribirJsonGitHub(archivo, contenidoObj, mensaje, sha) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  var apiUrl = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + archivo;
  var headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' };
  var newContent = Utilities.base64Encode(JSON.stringify(contenidoObj, null, 2), Utilities.Charset.UTF_8);
  UrlFetchApp.fetch(apiUrl, {
    method: 'PUT',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    payload: JSON.stringify({ message: mensaje, content: newContent, sha: sha })
  });
}
