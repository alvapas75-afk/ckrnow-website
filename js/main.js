// ===== CKR BOUTIQUE — Main JS + Carrito de Compras =====

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

function showSizeSelector(name, price) {
  pendingProduct = { name, price };
  document.getElementById('sizeProductName').textContent = name;
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

// ---- CHECKOUT POR WHATSAPP ----
function checkoutWhatsApp() {
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Agrega productos primero.');
    return;
  }

  let msg = '¡Hola CKR Boutique! 🛍️ Quiero hacer el siguiente pedido:\n\n';
  let total = 0;

  cart.forEach((item, i) => {
    msg += `${i + 1}. *${item.name}*\n`;
    msg += `   Talla: ${item.size} · Cant: ${item.qty}\n`;
    msg += `   ${formatPrice(item.price * item.qty)}\n\n`;
    total += item.price * item.qty;
  });

  msg += `━━━━━━━━━━━━━━━\n`;
  msg += `*TOTAL: ${formatPrice(total)}*\n\n`;
  msg += `¿Cómo procedo con el pago? (Nequi, PSE, transferencia)`;

  if (typeof fbq !== 'undefined') {
    fbq('track', 'InitiateCheckout', {
      value: total,
      currency: 'COP',
      num_items: cart.reduce((sum, i) => sum + i.qty, 0),
      content_type: 'product'
    });
  }
  const url = 'https://wa.me/573017604292?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}

// ---- CHECKOUT CON ADDI ----
function checkoutAddi() {
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Agrega productos primero.');
    return;
  }

  let msg = '¡Hola CKR Boutique! 🛍️ Quiero pagar con *Addi* (cuotas sin interés):\n\n';
  let total = 0;

  cart.forEach((item, i) => {
    msg += `${i + 1}. *${item.name}*\n`;
    msg += `   Talla: ${item.size} · Cant: ${item.qty}\n`;
    msg += `   ${formatPrice(item.price * item.qty)}\n\n`;
    total += item.price * item.qty;
  });

  msg += `━━━━━━━━━━━━━━━\n`;
  msg += `*TOTAL: ${formatPrice(total)}*\n\n`;
  msg += `Por favor envíame el link de pago de Addi 🙏`;

  if (typeof fbq !== 'undefined') {
    fbq('track', 'InitiateCheckout', {
      value: total, currency: 'COP',
      num_items: cart.reduce((sum, i) => sum + i.qty, 0),
      content_type: 'product'
    });
  }
  window.open('https://wa.me/573017604292?text=' + encodeURIComponent(msg), '_blank');
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

  // Descripción del pedido
  const description = cart.map(i => `${i.qty}x ${i.name} T.${i.size}`).join(', ');

  const checkout = new WidgetCheckout({
    currency: 'COP',
    amountInCents,
    reference,
    publicKey: WOMPI_PUBLIC_KEY,
    signature: { integrity: integrityHash },
    redirectUrl: 'https://ckrnow.com/?pago=exitoso',
    customerData: {
      userLegalName: 'Cliente CKR Boutique',
      userLegalId: '',
      userLegalIdType: 'CC',
      userPhoneNumber: '',
      userPhoneNumberPrefix: '+57',
      shippingAddress: {
        addressLine1: '',
        country: 'CO',
        region: '',
        city: '',
        phoneNumber: ''
      }
    }
  });

  checkout.open(function(result) {
    const tx = result.transaction;
    if (tx && tx.status === 'APPROVED') {
      if (typeof fbq !== 'undefined') {
        fbq('track', 'Purchase', { value: amountInCents / 100, currency: 'COP', content_type: 'product' });
      }
      cart = [];
      saveCart();
      updateCartBadge();
      closeCart();
      document.getElementById('wompiSuccessModal').style.display = 'flex';
    }
  });
}

function closeSuccessModal() {
  document.getElementById('wompiSuccessModal').style.display = 'none';
}

// Detectar retorno desde Wompi con ?pago=exitoso
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);

  if (params.get('pago') === 'exitoso') {
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Purchase', { value: 0, currency: 'COP', content_type: 'product' });
    }
    cart = [];
    saveCart();
    updateCartBadge();
    document.getElementById('wompiSuccessModal').style.display = 'flex';
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
});
