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
function addToCart(name, price, size) {
  const existing = cart.find(i => i.name === name && i.size === size);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ name, price, size, qty: 1 });
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

function showSizeSelector(name, price, sizes) {
  pendingProduct = { name, price };
  const sizeOptions = document.querySelector('#sizeModal .size-options');

  const available = sizes && sizes.length > 0 ? sizes : ['XS','S','M','L','XL','Única'];

  if (available.length === 1) {
    addToCart(name, price, available[0]);
    openCart();
    return;
  }

  document.getElementById('sizeProductName').textContent = name;
  sizeOptions.innerHTML = available.map(s =>
    `<button onclick="selectSize('${s}')">${s}</button>`
  ).join('');
  document.getElementById('sizeModal').style.display = 'flex';
}

function selectSize(size) {
  if (!pendingProduct) return;
  addToCart(pendingProduct.name, pendingProduct.price, size);
  closeSizeModal();
  openCart();
}

function closeSizeModal() {
  document.getElementById('sizeModal').style.display = 'none';
  pendingProduct = null;
}

// ---- INICIALIZAR BOTONES CON TALLA DINÁMICA ----
function initSizeButtons() {
  document.querySelectorAll('.btn-agregar').forEach(btn => {
    const m = (btn.getAttribute('onclick') || '').match(/showSizeSelector\('(.+?)',\s*(\d+)\)/);
    if (!m) return;
    const name = m[1], price = parseInt(m[2]);
    const sizesText = btn.closest('.product-info')?.querySelector('.product-sizes')?.textContent || '';
    const sizes = parseTallas(sizesText);
    btn.removeAttribute('onclick');
    btn.addEventListener('click', () => showSizeSelector(name, price, sizes));
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
  if (!nombre || !email || !tel || !dir) {
    alert('Por favor completa todos los campos para continuar.');
    return;
  }
  closeCustomerForm();
  saveContactBrevo({ nombre, email, tel, dir }); // guarda en Brevo en paralelo
  if (_checkoutCallback) _checkoutCallback({ nombre, email, tel, dir });
}

// ---- CHECKOUT POR WHATSAPP ----
function checkoutWhatsApp() {
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Agrega productos primero.');
    return;
  }
  closeCart();
  showCustomerForm(({ nombre, email, tel, dir }) => {
    let msg = '¡Hola CKR Boutique! 🛍️ Quiero hacer el siguiente pedido:\n\n';
    let total = 0;
    cart.forEach((item, i) => {
      msg += `${i + 1}. *${item.name}*\n`;
      msg += `   Talla: ${item.size} · Cant: ${item.qty}\n`;
      msg += `   ${formatPrice(item.price * item.qty)}\n\n`;
      total += item.price * item.qty;
    });
    msg += `━━━━━━━━━━━━━━━\n*TOTAL: ${formatPrice(total)}*\n\n`;
    msg += `📋 *Datos de envío:*\n`;
    msg += `👤 ${nombre}\n📧 ${email}\n📞 ${tel}\n📍 ${dir}`;
    if (typeof fbq !== 'undefined') {
      fbq('track', 'InitiateCheckout', { value: total, currency: 'COP', num_items: cart.reduce((s,i)=>s+i.qty,0), content_type: 'product' });
    }
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
  showCustomerForm(({ nombre, email, tel, dir }) => {
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
    msg += `📋 *Datos de envío:*\n`;
    msg += `👤 ${nombre}\n📧 ${email}\n📞 ${tel}\n📍 ${dir}\n\n`;
    msg += `¿Me puedes enviar el link de pago Addi?`;
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

async function checkoutWompi() {
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Agrega productos primero.');
    return;
  }

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

  closeCart();
  window.location.href = 'https://checkout.wompi.co/p/?' + params.toString();
}

function closeSuccessModal() {
  document.getElementById('wompiSuccessModal').style.display = 'none';
}

// Detectar retorno desde Wompi con ?pago=exitoso
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);

  if (params.get('pago') === 'exitoso') {
    const metodo = params.get('metodo') || 'wompi';
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Purchase', { value: 0, currency: 'COP', content_type: 'product', content_category: metodo });
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

// ---- ACORDEONES DE PRODUCTO ----
function injectProductAccordions() {
  document.querySelectorAll('.product-info').forEach(info => {
    if (info.querySelector('.product-accordions')) return;
    const wrap = document.createElement('div');
    wrap.className = 'product-accordions';
    wrap.innerHTML = `
      <details class="prod-accordion">
        <summary>♻️ Cuidado de la prenda</summary>
        <div class="prod-accordion-content">
          <ul>
            <li>Primer lavado en seco o lavandería profesional</li>
            <li>Lavar a mano o ciclo delicado en agua fría</li>
            <li>No dejar en remojo ni retorcer</li>
            <li>Sin blanqueadores ni productos agresivos</li>
            <li>Secar a la sombra · No usar secadora</li>
          </ul>
        </div>
      </details>
      <details class="prod-accordion">
        <summary>📏 Guía de tallas</summary>
        <div class="prod-accordion-content">
          <table class="talla-table">
            <tr><th>Talla</th><th>Busto</th><th>Cintura</th><th>Cadera</th></tr>
            <tr><td>XS</td><td>80–84 cm</td><td>60–64 cm</td><td>86–90 cm</td></tr>
            <tr><td>S</td><td>84–88 cm</td><td>64–68 cm</td><td>90–94 cm</td></tr>
            <tr><td>M</td><td>88–92 cm</td><td>68–72 cm</td><td>94–98 cm</td></tr>
            <tr><td>L</td><td>92–96 cm</td><td>72–76 cm</td><td>98–102 cm</td></tr>
            <tr><td>XL</td><td>96–100 cm</td><td>76–80 cm</td><td>102–106 cm</td></tr>
          </table>
          <p class="talla-hint">¿Dudas? <a href="https://wa.me/573017604292" target="_blank">Consúltanos por WhatsApp</a></p>
        </div>
      </details>
      <details class="prod-accordion">
        <summary>🔄 Cambios y devoluciones</summary>
        <div class="prod-accordion-content">
          <p>Tienes <strong>5 días hábiles</strong> desde que recibes tu pedido para solicitar un cambio o devolución.</p>
          <p><strong>Condición:</strong> prenda sin usar, con etiqueta original y en su empaque.</p>
          <p>📧 <a href="mailto:alvapas75@gmail.com">alvapas75@gmail.com</a></p>
          <p>📞 <a href="tel:3017604292">301 760 4292</a></p>
        </div>
      </details>`;
    const btn = info.querySelector('.btn-agregar');
    if (btn) info.insertBefore(wrap, btn);
    else info.appendChild(wrap);
  });
}

// ---- INICIALIZAR ----
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  setTimeout(() => {
    initSizeButtons();
    injectProductAccordions();
    injectAddiWidgets();
  }, 600);
});
