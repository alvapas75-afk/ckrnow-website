// ===== CKR BOUTIQUE — Main JS + Carrito de Compras =====

// ===== ADDI — CONFIGURACIÓN =====
const ADDI_ALLY_SLUG = 'cloakroomstore-ecommerce';

// ===== BREVO — EMAIL MARKETING (sin API key, via formulario público) =====
const BREVO_FORM_URL = 'https://47b1f749.sibforms.com/serve/MUIFAA-IsvjPheutjKfFn3MDr4wtyygWknBQ-3LRZ6zcMVkrL6cHkZUv9rg-3WcO_L3rvvedlcz07gCsbgNEIZfiRfBcWFkbmuqbZuikLBoW2WAopiFAL18t3RbbOJZcEJCCeFpzqYb4upPWBGgrSNnyALLw00jVDHfJl7gNje6rJvaVeIJLU6LmQQHvf1L9tdBIRzRDBPLVK_tkgQ==';

async function saveContactBrevo({ nombre, email, tel, dir }) {
  try {
    const body = new URLSearchParams({
      EMAIL: email,
      FIRSTNAME: nombre,
      SMS: tel,
      ADDRESS: dir,
      email_address_check: '',
      locale: 'es'
    });
    await fetch(BREVO_FORM_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
  } catch(e) { /* silencioso — no bloquea el checkout */ }
}

// ---- NAVBAR & MENU ----
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('open');
}

window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 50) {
    nav.style.background = 'rgba(10,10,10,0.98)';
  } else {
    nav.style.background = 'rgba(10,10,10,0.92)';
  }
});

// ---- FADE-IN ANIMACIONES ----
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.product-card, .contact-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});


// ===== STOCK WEBHOOK (Google Apps Script) =====
const CKR_STOCK_WEBHOOK = 'https://script.google.com/macros/s/AKfycbwg9Exn5g-aEe3hpP3-MCHZz-mAUKXYve_FU1Sha7xwSbhLy7B6eWnvf1XrcrF29bs/exec';

// ===== CARRITO DE COMPRAS =====

let cart = JSON.parse(localStorage.getItem('ckr_cart') || '[]');

function saveCart() {
  localStorage.setItem('ckr_cart', JSON.stringify(cart));
}

function parsePrice(priceText) {
  // "$380.000 COP" → 380000
  return parseInt(priceText.replace(/\./g, '').replace(/\D/g, ''));
}

function formatPrice(num) {
  return '$' + num.toLocaleString('es-CO') + ' COP';
}

// ---- BADGE ----
function updateCartBadge() {
  const total = cart.reduce((sum, i) => sum + i.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (total > 0) {
    badge.textContent = total;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ---- TOAST ----
function showToast() {
  const toast = document.getElementById('cartToast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ---- AGREGAR AL CARRITO ----
function addToCart(name, price, size, isSale) {
  const existing = cart.find(i => i.name === name && i.size === size);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ name, price, size, qty: 1, isSale: !!isSale });
  }
  saveCart();
  updateCartBadge();
  showToast();
  if (typeof fbq !== 'undefined') {
    fbq('track', 'AddToCart', { value: price, currency: 'COP', content_name: name, content_type: 'product' });
  }
}

// ---- QUITAR DEL CARRITO ----
function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  updateCartBadge();
  renderCartItems();
}

function changeQty(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }
  saveCart();
  updateCartBadge();
  renderCartItems();
}

// ---- RENDERIZAR ITEMS ----
function renderCartItems() {
  const container = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <p>Tu carrito está vacío</p>
        <p style="font-size:0.8rem;color:#999;margin-top:8px">¡Agrega tus prendas favoritas!</p>
      </div>`;
    totalEl.textContent = '$0 COP';
    return;
  }

  let total = 0;
  container.innerHTML = cart.map((item, i) => {
    total += item.price * item.qty;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-size">Talla: <strong>${item.size}</strong></div>
          <div class="cart-item-price">${formatPrice(item.price)}</div>
        </div>
        <div class="cart-item-controls">
          <button onclick="changeQty(${i}, -1)">−</button>
          <span>${item.qty}</span>
          <button onclick="changeQty(${i}, 1)">+</button>
          <button class="remove-btn" onclick="removeFromCart(${i})" title="Eliminar">🗑</button>
        </div>
      </div>`;
  }).join('');

  totalEl.textContent = formatPrice(total);
}

// ---- ABRIR / CERRAR CARRITO ----
function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  renderCartItems();
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
}

// ---- SELECTOR DE TALLA ----
let pendingProduct = null;

function parseTallas(text) {
  const clean = (text || '').replace(/tallas?\s*:\s*/i, '').trim();
  if (!clean) return [];
  return clean.split(/[\s\/\-,]+/).map(s => s.trim()).filter(Boolean).map(s =>
    /^u[ní]ica$/i.test(s) ? 'Única' : s.toUpperCase()
  );
}

function showSizeSelector(name, price, sizes, imgSrc, waUrl) {
  pendingProduct = { name, price, talla: null };
  const available = sizes && sizes.length > 0 ? sizes : ['XS','S','M','L','XL','Única'];

  document.getElementById('sizeProductName').textContent = name;
  document.getElementById('pmPrice').textContent = formatPrice(price);
  document.getElementById('pmImg').src = imgSrc || '';
  document.getElementById('pmImg').alt = name;
  document.getElementById('pmWa').href = waUrl || 'https://wa.me/573017604292';
  document.getElementById('pmSizes').innerHTML = available.map(s =>
    `<button class="pm-talla-btn" onclick="highlightTalla('${s}')">${s}</button>`
  ).join('');
  const hint = document.getElementById('pmNoTalla');
  if (hint) hint.style.display = 'none';
  document.getElementById('sizeModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function highlightTalla(size) {
  if (!pendingProduct) return;
  pendingProduct.talla = size;
  document.querySelectorAll('#pmSizes .pm-talla-btn').forEach(b => b.classList.remove('selected'));
  const btn = [...document.querySelectorAll('#pmSizes .pm-talla-btn')].find(b => b.textContent === size);
  if (btn) btn.classList.add('selected');
  const hint = document.getElementById('pmNoTalla');
  if (hint) hint.style.display = 'none';
}

function addToCartFromModal() {
  if (!pendingProduct) return;
  if (!pendingProduct.talla) {
    const hint = document.getElementById('pmNoTalla');
    if (hint) hint.style.display = 'block';
    return;
  }
  addToCart(pendingProduct.name, pendingProduct.price, pendingProduct.talla);
  closeSizeModal();
  openCart();
}

function selectSize(size) {
  highlightTalla(size);
  addToCartFromModal();
}

function closeSizeModal() {
  document.getElementById('sizeModal').style.display = 'none';
  document.body.style.overflow = '';
  pendingProduct = null;
}

// ---- INICIALIZAR BOTONES CON TALLA DINÁMICA ----
function initSizeButtons() {
  document.querySelectorAll('.btn-agregar').forEach(btn => {
    const m = (btn.getAttribute('onclick') || '').match(/showSizeSelector\('(.+?)',\s*(\d+)\)/);
    if (!m) return;
    const name = m[1], price = parseInt(m[2]);
    const card = btn.closest('.product-card');
    const sizesText = card?.querySelector('.product-sizes')?.textContent || '';
    const sizes = parseTallas(sizesText);
    const imgSrc = card?.querySelector('img')?.src || '';
    const waHref = card?.querySelector('.btn-whatsapp')?.getAttribute('href') || '';
    const open = () => showSizeSelector(name, price, sizes, imgSrc, waHref);
    btn.removeAttribute('onclick');
    btn.addEventListener('click', open);
  });
}

// ---- FORMULARIO DE DATOS DEL CLIENTE ----
let _checkoutCallback = null;

function showCustomerForm(callback) {
  _checkoutCallback = callback;
  document.getElementById('customerFormModal').style.display = 'flex';
}

function closeCustomerForm() {
  document.getElementById('customerFormModal').style.display = 'none';
  _checkoutCallback = null;
}

function submitCustomerForm() {
  const nombre = document.getElementById('cf-nombre').value.trim();
  const email  = document.getElementById('cf-email').value.trim();
  const tel    = document.getElementById('cf-tel').value.trim();
  const dir    = document.getElementById('cf-dir').value.trim();
  const ciudad = document.getElementById('cf-ciudad').value.trim();
  const depto  = document.getElementById('cf-depto').value.trim();
  const cp     = document.getElementById('cf-cp').value.trim();
  if (!nombre || !email || !tel || !dir || !ciudad || !depto || !cp) {
    alert('Por favor completa todos los campos para continuar.');
    return;
  }
  const callback = _checkoutCallback; // guardar antes de cerrar, closeCustomerForm() lo pone en null
  closeCustomerForm();
  saveContactBrevo({ nombre, email, tel, dir: `${dir}, ${ciudad}, ${depto}` }); // guarda en Brevo en paralelo
  if (callback) callback({ nombre, email, tel, dir, ciudad, depto, cp });
}

// ---- REGISTRAR PEDIDO PENDIENTE DE GUÍA (Addi / WhatsApp — confirmación manual) ----
function registrarPedidoPendiente(cliente, total) {
  if (!CKR_STOCK_WEBHOOK) return;
  const pedido = {
    cliente,
    items: cart.map(i => ({ nombre: i.name, talla: i.size, qty: i.qty, precio: i.price })),
    total,
    metodo: cliente.metodo
  };
  fetch(CKR_STOCK_WEBHOOK, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ accion: 'registrar_pedido', pedido: JSON.stringify(pedido) }).toString()
  }).catch(function(){});
}

// ---- CHECKOUT POR WHATSAPP ----
function checkoutWhatsApp() {
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Agrega productos primero.');
    return;
  }
  closeCart();
  showCustomerForm(({ nombre, email, tel, dir, ciudad, depto, cp }) => {
    let msg = '¡Hola CKR Boutique! 🛍️ Quiero hacer el siguiente pedido:\n\n';
    let total = 0;
    cart.forEach((item, i) => {
      msg += `${i + 1}. *${item.name}*\n`;
      msg += `   Talla: ${item.size} · Cant: ${item.qty}\n`;
      msg += `   ${formatPrice(item.price * item.qty)}\n\n`;
      total += item.price * item.qty;
    });
    msg += `━━━━━━━━━━━━━━━\n*TOTAL: ${formatPrice(total)}*\n\n`;
    if (cart.some(i => i.isSale)) {
      msg += `⚠️ *Incluye productos en SALE — código CKR10 no aplica sobre precios de liquidación.*\n\n`;
    }
    msg += `📋 *Datos de envío:*\n`;
    msg += `👤 ${nombre}\n📧 ${email}\n📞 ${tel}\n📍 ${dir}, ${ciudad}, ${depto}`;
    if (typeof fbq !== 'undefined') {
      fbq('track', 'InitiateCheckout', { value: total, currency: 'COP', num_items: cart.reduce((s,i)=>s+i.qty,0), content_type: 'product' });
    }
    registrarPedidoPendiente({ nombre, email, tel, dir, ciudad, depto, cp, metodo: 'whatsapp' }, total);
    window.open('https://wa.me/573017604292?text=' + encodeURIComponent(msg), '_blank');
  });
}

// ---- CHECKOUT CON ADDI (vía WhatsApp — el link Addi lo genera la vendedora desde su portal) ----
function checkoutAddi() {
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Agrega productos primero.');
    return;
  }
  closeCart();
  showCustomerForm(({ nombre, email, tel, dir, ciudad, depto, cp }) => {
    const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    if (typeof fbq !== 'undefined') {
      fbq('track', 'InitiateCheckout', { value: total, currency: 'COP', num_items: cart.reduce((s,i)=>s+i.qty,0), content_type: 'product' });
    }
    let msg = '¡Hola CKR Boutique! 🛍️ Quiero pagar en cuotas con *Addi*. Mi pedido:\n\n';
    cart.forEach((item, i) => {
      msg += `${i + 1}. *${item.name}*\n`;
      msg += `   Talla: ${item.size} · Cant: ${item.qty}\n`;
      msg += `   ${formatPrice(item.price * item.qty)}\n\n`;
    });
    msg += `━━━━━━━━━━━━━━━\n*TOTAL: ${formatPrice(total)}*\n\n`;
    if (cart.some(i => i.isSale)) {
      msg += `⚠️ *Incluye productos en SALE — código CKR10 no aplica sobre precios de liquidación.*\n\n`;
    }
    msg += `📋 *Datos de envío:*\n`;
    msg += `👤 ${nombre}\n📧 ${email}\n📞 ${tel}\n📍 ${dir}, ${ciudad}, ${depto}\n\n`;
    msg += `¿Me puedes enviar el link de pago Addi?`;
    registrarPedidoPendiente({ nombre, email, tel, dir, ciudad, depto, cp, metodo: 'addi' }, total);
    window.open('https://wa.me/573017604292?text=' + encodeURIComponent(msg), '_blank');
  });
}

// ---- WIDGET DE CUOTAS ADDI EN PRODUCTOS ----
function injectAddiWidgets() {
  document.querySelectorAll('.product-info').forEach(info => {
    const priceEl = info.querySelector('.product-price');
    if (!priceEl || info.querySelector('addi-widget')) return;
    const price = parsePrice(priceEl.textContent);
    if (price < 100000) return;
    const widget = document.createElement('addi-widget');
    widget.setAttribute('price', String(price));
    widget.setAttribute('ally-slug', ADDI_ALLY_SLUG);
    widget.className = 'addi-cuotas';
    priceEl.after(widget);
  });
}


// ---- WOMPI CHECKOUT ----
const WOMPI_PUBLIC_KEY = 'pub_prod_q37sErxb7ePerWO5XBkg8EtkaEtNtedu';
const WOMPI_INTEGRITY_SECRET = 'prod_integrity_MIosK6AhGAV4IQsL3Tv05VSEKhKW4fvW';

async function generateIntegrityHash(reference, amountInCents) {
  const data = `${reference}${amountInCents}COP${WOMPI_INTEGRITY_SECRET}`;
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function checkoutWompi() {
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Agrega productos primero.');
    return;
  }
  closeCart();
  showCustomerForm(async ({ nombre, email, tel, dir, ciudad, depto, cp }) => {
    const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const amountInCents = total * 100;
    const reference = 'CKR-' + Date.now();
    const integrityHash = await generateIntegrityHash(reference, amountInCents);

    if (typeof fbq !== 'undefined') {
      fbq('track', 'InitiateCheckout', {
        value: total, currency: 'COP',
        num_items: cart.reduce((sum, i) => sum + i.qty, 0),
        content_type: 'product'
      });
    }

    const params = new URLSearchParams({
      'public-key': WOMPI_PUBLIC_KEY,
      'currency': 'COP',
      'amount-in-cents': amountInCents,
      'reference': reference,
      'signature:integrity': integrityHash,
      'redirect-url': 'https://ckrnow.com/?pago=exitoso'
    });

    localStorage.setItem('ckr_pending_payment', JSON.stringify(cart.map(i => i.name)));
    localStorage.setItem('ckr_pending_total', total.toString());
    localStorage.setItem('ckr_pending_order', JSON.stringify({
      cliente: { nombre, email, tel, dir, ciudad, depto, cp },
      items: cart.map(i => ({ nombre: i.name, talla: i.size, qty: i.qty, precio: i.price })),
      total,
      metodo: 'wompi'
    }));

    // Usar form submit para evitar bloqueo de navegación async en Safari/móvil
    const form = document.createElement('form');
    form.method = 'GET';
    form.action = 'https://checkout.wompi.co/p/';
    params.forEach((value, key) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  });
}

function closeSuccessModal() {
  document.getElementById('wompiSuccessModal').style.display = 'none';
}

// Detectar retorno desde Wompi con ?pago=exitoso
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);

  if (params.get('pago') === 'exitoso') {
    const metodo = params.get('metodo') || 'wompi';
    const _purchaseTotal = parseFloat(localStorage.getItem('ckr_pending_total') || '0');
    localStorage.removeItem('ckr_pending_total');
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Purchase', { value: _purchaseTotal, currency: 'COP', content_type: 'product', content_category: metodo });
    }
    const _pending = JSON.parse(localStorage.getItem('ckr_pending_payment') || '[]');
    if (_pending.length && CKR_STOCK_WEBHOOK) {
      fetch(CKR_STOCK_WEBHOOK, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ productos: _pending.join(',') }).toString()
      }).catch(function(){});
      localStorage.removeItem('ckr_pending_payment');
    }
    const _pendingOrder = JSON.parse(localStorage.getItem('ckr_pending_order') || 'null');
    if (_pendingOrder && CKR_STOCK_WEBHOOK) {
      fetch(CKR_STOCK_WEBHOOK, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ accion: 'crear_guia', pedido: JSON.stringify(_pendingOrder) }).toString()
      }).catch(function(){});
      localStorage.removeItem('ckr_pending_order');
    }
    cart = [];
    saveCart();
    updateCartBadge();
    const modal = document.getElementById('wompiSuccessModal');
    if (metodo === 'addi') {
      modal.querySelector('h2').textContent = '¡Pago con Addi aprobado!';
      modal.querySelector('p').textContent = 'Tu pedido está confirmado. Te escribiremos por WhatsApp con los detalles del envío.';
    }
    modal.style.display = 'flex';
    history.replaceState({}, '', '/');
  }

  // Link de Instagram/WhatsApp directo → dispara Lead y redirige a WhatsApp
  if (params.get('wa') === '1') {
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Lead', { content_name: 'WhatsApp Instagram' });
    }
    const msg = '¡Hola CKR Boutique! 👗 Vi sus productos en Instagram y quiero más información.';
    window.location.replace('https://wa.me/573017604292?text=' + encodeURIComponent(msg));
  }
});


// ---- INICIALIZAR ----
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  setTimeout(() => {
    initSizeButtons();
  }, 600);
});
