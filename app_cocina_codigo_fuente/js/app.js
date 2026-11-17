// ==========================================================
// COCINA TITA — LÓGICA DE LA APP (Modo APK Autónoma)
// ----------------------------------------------------------
// 1. Estado global y Almacenamiento Local (Sin Servidor)
// 2. Arranque (splash, sonido, sincronización inicial)
// 3. Reloj y estadísticas
// 4. Tablero Kanban (tarjetas, botones de flujo, buscador)
// 5. Pedido mostrador / Gastos
// 6. Lista de compras
// 7. Historial y finanzas (Cierre de día)
// 8. Configuración y Menú CRUD
// 9. Pedido de WhatsApp (análisis nativo en JavaScript)
// 10. Respaldos (Exportar e Importar JSON)
// 11. Utilidades (modales, toast, escape)
// ==========================================================

// ---------- 1. ESTADO GLOBAL Y ALMACENAMIENTO LOCAL ----------
const APP_VERSION = "1.4.0";
const DEFAULT_UPDATE_URL = "https://raw.githubusercontent.com/lorusof/CocinaTita/main/version.json";
const STORAGE_KEY = 'cocina_tita_datos_v1';

const DATOS_DEFAULT = {
    pedidos: [],
    finanzas: [],
    compras: [],
    historial_dias: [],
    menu: [
        { nombre: "Tacos Dorados", precio: 15.0 },
        { nombre: "Mole con Pollo", precio: 90.0 },
        { nombre: "Arroz", precio: 25.0 },
    ],
    config: {
        sonido_bienvenida: true,
        tip_pwa_mostrado: true,
        url_actualizacion: "",
    }
};

let pedidos = [];
let finanzas = [];
let itemsCompra = [];
let historialDias = [];
let menuActual = [];
let configActual = { sonido_bienvenida: true, tip_pwa_mostrado: true };

const FRASES_MOTIVADORAS = [
    "¡El sazón de la Navidad se cocina con amor y en familia! 🎄🍲",
    "Que tu cocina se llene de bendiciones, salud y grandes ventas hoy. ✨🎁",
    "Cocinando con el espíritu navideño y el sazón consentido de Tita. 🎅🧡",
    "Pavo, romeritos, ricos guisados y el calor de tu cocina. 🥘🎄",
    "Que la paz y la prosperidad reinen hoy en tu negocio y en tu mesa. 🌟",
    "¡Que el horno esté calientito y los corazones contentos! ❄️✨",
    "El mejor regalo de hoy es compartir tu comida con el barrio. 🎁",
    "Cada platillo que sale de tu cocina alegra la Navidad de una familia. 🎄",
    "Respira, sonríe y que empiece el ajetreo bonito de diciembre.",
    "El mejor ingrediente de tu cocina siempre eres tú. ¡Felices fiestas! 🎅",
    "Que las ollas suenen y la caja también. ¡A darle con ganas! 🔔💰",
];

function cargarDatosLocales() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            guardarDatosLocales(DATOS_DEFAULT);
            return JSON.parse(JSON.stringify(DATOS_DEFAULT));
        }
        const parsed = JSON.parse(raw);
        const merged = { ...DATOS_DEFAULT, ...parsed };
        merged.config = { ...DATOS_DEFAULT.config, ...(parsed.config || {}) };
        if (!merged.menu || !merged.menu.length) merged.menu = DATOS_DEFAULT.menu;
        return merged;
    } catch (e) {
        console.error('Error al cargar datos locales:', e);
        return JSON.parse(JSON.stringify(DATOS_DEFAULT));
    }
}

function guardarDatosLocales(datos) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(datos));
    } catch (e) {
        console.error('Error al guardar datos locales:', e);
        mostrarToast('Error al guardar en el dispositivo.');
    }
}

function guardarEnServidor() {
    // En modo APK autónoma, guarda de inmediato en el almacenamiento interno
    const data = {
        pedidos,
        finanzas,
        compras: itemsCompra,
        historial_dias: historialDias,
        menu: menuActual,
        config: configActual
    };
    guardarDatosLocales(data);
}

function sincronizarConServidor() {
    const data = cargarDatosLocales();
    pedidos = data.pedidos || [];
    finanzas = data.finanzas || [];
    itemsCompra = data.compras || [];
    historialDias = data.historial_dias || [];
    menuActual = data.menu || [];
    configActual = data.config || configActual;

    refrescarVista();
    actualizarVistaListaCompras();
}

// ---------- 2. ARRANQUE ----------
window.onload = iniciarApp;

async function iniciarApp() {
    const fraseEl = document.getElementById('splash-frase');
    if (fraseEl) {
        fraseEl.textContent = FRASES_MOTIVADORAS[Math.floor(Math.random() * FRASES_MOTIVADORAS.length)];
    }

    const inicio = Date.now();
    const DURACION_MINIMA_MS = 2000;

    sincronizarConServidor();
    iniciarSincronizacionFirebase();
    setInterval(actualizarReloj, 60000);
    actualizarReloj();

    const transcurrido = Date.now() - inicio;
    setTimeout(mostrarApp, Math.max(0, DURACION_MINIMA_MS - transcurrido));
}

function mostrarApp() {
    document.getElementById('splash').classList.add('oculto');
    document.getElementById('app').classList.remove('oculto');
    reproducirSonidoBienvenida();
    setTimeout(() => {
        if (typeof verificarActualizaciones === 'function') {
            verificarActualizaciones(false);
        }
    }, 2500);
}

function reproducirSonidoBienvenida() {
    if (!configActual.sonido_bienvenida) return;
    const audio = document.getElementById('sonido-bienvenida');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => { /* El navegador puede requerir interacción; normal */ });
    }
}

// ---------- 3. RELOJ Y ESTADÍSTICAS ----------
function actualizarReloj() {
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
    const hora = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const relojEl = document.getElementById('reloj');
    if (relojEl) relojEl.innerText = `${fecha} | ${hora}`;
}

function esHoy(fechaISO) {
    if (!fechaISO) return false;
    const d = new Date(fechaISO);
    const hoy = new Date();
    return d.toDateString() === hoy.toDateString();
}

function actualizarStats() {
    const activos = pedidos.filter(p => p.estado !== 'entregados').length;
    const entregadosHoy = pedidos.filter(p => p.estado === 'entregados' && esHoy(p.fecha));
    const ventasHoy = entregadosHoy.reduce((acc, p) => acc + (p.total || 0), 0);

    const elActivos = document.getElementById('stat-activos');
    const elEntregados = document.getElementById('stat-entregados-hoy');
    const elVentas = document.getElementById('stat-ventas-hoy');

    if (elActivos) elActivos.textContent = activos;
    if (elEntregados) elEntregados.textContent = entregadosHoy.length;
    if (elVentas) elVentas.textContent = `$${ventasHoy.toFixed(0)}`;
}

function refrescarVista() {
    renderKanban();
    actualizarStats();
}

// ---------- 4. TABLERO KANBAN ----------
function generarId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 6); }

function renderKanban() {
    const filtro = (document.getElementById('buscador')?.value || '').trim().toLowerCase();

    ['espera', 'enviados', 'entregados'].forEach(estado => {
        const el = document.getElementById(`lista-${estado}`);
        if (el) el.innerHTML = '';
    });

    let visibles = { espera: 0, enviados: 0, entregados: 0 };

    pedidos.forEach(p => {
        if (filtro) {
            const texto = `${p.cliente} ${p.detalle} ${p.mensaje_original || ''}`.toLowerCase();
            if (!texto.includes(filtro)) return;
        }
        visibles[p.estado] = (visibles[p.estado] || 0) + 1;
        const col = document.getElementById(`lista-${p.estado}`);
        if (col) col.appendChild(renderTarjeta(p));
    });

    ['espera', 'enviados', 'entregados'].forEach(estado => {
        const count = document.getElementById(`count-${estado}`);
        if (count) count.textContent = visibles[estado];
        const tab = document.getElementById(`tabcount-${estado}`);
        if (tab) tab.textContent = visibles[estado];
    });
}

function filtrarTablero() { renderKanban(); }

function cambiarColumnaMovil(estado) {
    document.querySelectorAll('.tab-columna').forEach(t => t.classList.toggle('activo', t.dataset.estado === estado));
    document.querySelectorAll('.column').forEach(c => c.classList.toggle('columna-activa', c.id === `col-${estado}`));
}

function renderTarjeta(p) {
    const div = document.createElement('div');
    div.className = `card ${p.estado}`;

    let labelOrigen;
    if (p.origen === 'wasap') {
        labelOrigen = '<span class="origen wasap">💬 WhatsApp</span>';
    } else if (p.origen === 'web') {
        labelOrigen = `<span class="origen web">🌐 Web ${p.folio ? '#' + p.folio : ''}</span>`;
    } else {
        labelOrigen = '<span class="origen local">🌮 Mostrador</span>';
    }

    const hora = p.fecha ? new Date(p.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';

    let detalleHtml;
    if (p.items && p.items.length) {
        detalleHtml = p.items.map(it => `<div>• <b>${it.cantidad}x</b> ${escaparHtml(it.nombre)}</div>`).join('');
    } else {
        detalleHtml = escaparHtml(p.detalle || '');
    }

    let badgeEntrega = '', confirmarBotones = '';
    if (p.origen === 'web') {
        if (p.tipo_entrega === 'domicilio') {
            badgeEntrega = `<div class="badge-entrega domicilio">🛷 Domicilio: ${escaparHtml(p.direccion || 'Sin dirección')}</div>`;
        } else {
            badgeEntrega = `<div class="badge-entrega recoge">🏃 Pasa a Recoger 🎄</div>`;
        }
    } else if (p.origen === 'wasap' && p.tipo_entrega) {
        const mapa = {
            domicilio: ['🛷 Domicilio 🎅', 'domicilio'],
            recoge: ['🏃 Recoge 🎄', 'recoge'],
            sin_definir: ['❓ Falta confirmar', 'sin_definir'],
        };
        const [texto, clase] = mapa[p.tipo_entrega] || mapa.sin_definir;
        badgeEntrega = `<div class="badge-entrega ${clase}">${texto}</div>`;
        if (p.tipo_entrega === 'sin_definir') {
            confirmarBotones = `<div class="confirmar-entrega">
                <button class="btn-domicilio" onclick="confirmarEntrega('${p.id}','domicilio')">🛷 Domicilio</button>
                <button class="btn-recoge" onclick="confirmarEntrega('${p.id}','recoge')">🏃 Recoge</button>
            </div>`;
        }
    }

    let notasHtml = '';
    if (p.notas) {
        notasHtml = `<div class="card-web-meta">📝 <b>Nota:</b> ${escaparHtml(p.notas)}</div>`;
    }

    let telHtml = '';
    if (p.telefono) {
        telHtml = `<div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">📞 ${escaparHtml(p.telefono)}</div>`;
    }

    let mensajeOriginalHtml = '';
    if (p.mensaje_original) {
        mensajeOriginalHtml = `
            <button class="ver-original" onclick="toggleOriginal('${p.id}')">Ver mensaje original</button>
            <div class="mensaje-original-box" id="original-${p.id}">"${escaparHtml(p.mensaje_original)}"</div>`;
    }

    let avance = '';
    if (p.estado === 'espera') {
        avance = `<button class="btn-small" onclick="moverPedido('${p.id}', 'enviados')">Cocinar 🔥</button>`;
    } else if (p.estado === 'enviados') {
        avance = `<button class="btn-small btn-atras" onclick="moverPedido('${p.id}', 'espera')" title="Regresar a En espera">◀</button>
                  <button class="btn-small" onclick="moverPedido('${p.id}', 'entregados')">Entregar 🎁</button>`;
    } else {
        avance = `<button class="btn-small btn-atras" onclick="moverPedido('${p.id}', 'enviados')" title="Regresar a Preparando">◀</button>`;
    }
    const botones = `<div class="card-actions">${avance}
        <button class="btn-small borrar" onclick="eliminarPedido('${p.id}')" title="Cancelar pedido">✕</button></div>`;

    div.innerHTML = `
        <div class="card-top">${labelOrigen}<span class="card-num">${hora}</span></div>
        <div class="card-precio">$${(p.total || 0).toFixed(2)}</div>
        <div class="card-cliente">${escaparHtml(p.cliente)}</div>
        ${telHtml}
        <div class="card-detalle">${detalleHtml}</div>
        ${badgeEntrega}
        ${notasHtml}
        ${confirmarBotones}
        ${mensajeOriginalHtml}
        ${botones}
    `;
    return div;
}

function toggleOriginal(id) {
    document.getElementById('original-' + id)?.classList.toggle('visible');
}

function confirmarEntrega(id, tipo) {
    const p = pedidos.find(x => x.id === id);
    if (!p) return;
    p.tipo_entrega = tipo;
    guardarEnServidor();
    refrescarVista();
    mostrarToast(tipo === 'domicilio' ? 'Marcado como domicilio 🚚' : 'Marcado como recoge 🏃');
}

function moverPedido(id, nuevoEstado) {
    const p = pedidos.find(x => x.id === id);
    if (!p) return;
    p.estado = nuevoEstado;
    guardarEnServidor();
    refrescarVista();
}

function eliminarPedido(id) {
    if (!confirm('¿Eliminar este pedido del historial?')) return;
    pedidos = pedidos.filter(x => x.id !== id);
    guardarEnServidor();
    refrescarVista();
}

// ---------- 5. PEDIDO MOSTRADOR / GASTOS ----------
function guardarPedido() {
    const cliente = document.getElementById('np-cliente').value.trim() || 'Mostrador';
    const detalle = document.getElementById('np-detalle').value.trim();
    const envio = parseFloat(document.getElementById('np-envio').value) || 0;
    const comida = parseFloat(document.getElementById('np-total').value) || 0;

    if (!detalle || comida === 0) { mostrarToast('Agrega el detalle del pedido y el total.'); return; }

    pedidos.push({
        id: generarId(), origen: 'local', cliente, detalle,
        total: comida + envio, estado: 'espera', fecha: new Date().toISOString(),
    });
    guardarEnServidor();
    refrescarVista();
    closeModal('modal-nuevo-pedido');
    document.getElementById('np-cliente').value = '';
    document.getElementById('np-detalle').value = '';
    document.getElementById('np-envio').value = '0';
    document.getElementById('np-total').value = '';
    mostrarToast('Pedido registrado.');
}

function guardarGasto() {
    const desc = document.getElementById('ng-desc').value.trim();
    const monto = parseFloat(document.getElementById('ng-monto').value);
    if (!desc || !monto || monto <= 0) { mostrarToast('Completa la descripción y el monto.'); return; }

    finanzas.push({ id: generarId(), tipo: 'gasto', descripcion: desc, monto, fecha: new Date().toISOString() });
    guardarEnServidor();
    closeModal('modal-nuevo-gasto');
    document.getElementById('ng-desc').value = '';
    document.getElementById('ng-monto').value = '';
    mostrarToast('Gasto registrado.');
}

// ---------- 6. LISTA DE COMPRAS ----------
function agregarItem() {
    const nom = document.getElementById('item-nombre').value.trim();
    const costo = parseFloat(document.getElementById('item-costo').value);
    if (nom && costo > 0) {
        itemsCompra.push({ nombre: nom, costo });
        document.getElementById('item-nombre').value = '';
        document.getElementById('item-costo').value = '';
        actualizarVistaListaCompras();
        guardarEnServidor();
    }
}

function actualizarVistaListaCompras() {
    const cont = document.getElementById('lista-compras');
    if (!cont) return;
    let total = 0;
    if (!itemsCompra.length) {
        cont.innerHTML = '<div class="vacio-lista">Sin artículos pendientes</div>';
    } else {
        cont.innerHTML = itemsCompra.map((it, idx) => {
            total += it.costo;
            return `<div class="item-editable"><span class="nombre">${escaparHtml(it.nombre)}</span>
                <span class="precio">$${it.costo.toFixed(2)}</span>
                <button onclick="quitarItem(${idx})">✕</button></div>`;
        }).join('');
    }
    const totEl = document.getElementById('total-compras');
    if (totEl) totEl.innerText = total.toFixed(2);
}

function quitarItem(idx) {
    itemsCompra.splice(idx, 1);
    actualizarVistaListaCompras();
    guardarEnServidor();
}

function procesarCompra(tipo) {
    if (itemsCompra.length === 0) { mostrarToast('La lista está vacía.'); return; }
    const total = parseFloat(document.getElementById('total-compras').innerText);
    if (tipo === 'CT') {
        finanzas.push({ id: generarId(), tipo: 'gasto', descripcion: 'Compra Almacén', monto: total, fecha: new Date().toISOString() });
        itemsCompra = [];
        actualizarVistaListaCompras();
        guardarEnServidor();
        closeModal('modal-compras');
        mostrarToast('Compra registrada en gastos.');
    } else {
        mostrarToast('Borra los artículos que no compraste con la "✕" y vuelve a procesar.');
    }
}

// ---------- 7. HISTORIAL Y FINANZAS (DÍA ACTUAL Y REPORTE MENSUAL) ----------
let fechaMesHistorial = new Date();

function parsearFechaDia(dia) {
    if (dia.fecha_iso) {
        const d = new Date(dia.fecha_iso);
        if (!isNaN(d.getTime())) return d;
    }
    if (dia.fecha) {
        if (typeof dia.fecha === 'string' && dia.fecha.includes('/')) {
            const parts = dia.fecha.split('/');
            if (parts.length === 3) {
                const diaNum = parseInt(parts[0], 10);
                const mesNum = parseInt(parts[1], 10) - 1;
                const anioNum = parseInt(parts[2], 10);
                const d = new Date(anioNum, mesNum, diaNum);
                if (!isNaN(d.getTime())) return d;
            }
        }
        const d = new Date(dia.fecha);
        if (!isNaN(d.getTime())) return d;
    }
    return new Date();
}

function cambiarTabHistorial(tab) {
    const btnHoy = document.getElementById('tab-btn-hist-hoy');
    const btnMes = document.getElementById('tab-btn-hist-mes');
    const panelHoy = document.getElementById('panel-hist-hoy');
    const panelMes = document.getElementById('panel-hist-mes');

    if (tab === 'hoy') {
        if (btnHoy) btnHoy.classList.add('activo');
        if (btnMes) btnMes.classList.remove('activo');
        if (panelHoy) panelHoy.style.display = 'flex';
        if (panelMes) panelMes.style.display = 'none';
    } else {
        if (btnHoy) btnHoy.classList.remove('activo');
        if (btnMes) btnMes.classList.add('activo');
        if (panelHoy) panelHoy.style.display = 'none';
        if (panelMes) panelMes.style.display = 'flex';
        renderizarHistorialMes();
    }
}

function navegarMesHistorial(delta) {
    fechaMesHistorial.setMonth(fechaMesHistorial.getMonth() + delta);
    renderizarHistorialMes();
}

function renderizarHistorialMes() {
    const nombreMes = fechaMesHistorial.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    const lblMes = document.getElementById('label-mes-seleccionado');
    if (lblMes) {
        lblMes.textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
    }

    const mesTarget = fechaMesHistorial.getMonth();
    const anioTarget = fechaMesHistorial.getFullYear();

    const diasDelMes = historialDias.filter(dia => {
        const f = parsearFechaDia(dia);
        return f.getMonth() === mesTarget && f.getFullYear() === anioTarget;
    });

    const ventasMes = diasDelMes.reduce((acc, d) => acc + (d.ingresos || 0), 0);
    const gastosMes = diasDelMes.reduce((acc, d) => acc + (d.gastos || 0), 0);
    const balanceMes = ventasMes - gastosMes;

    const elVentas = document.getElementById('mes-ventas');
    const elGastos = document.getElementById('mes-gastos');
    const elBalance = document.getElementById('mes-balance');
    const elCount = document.getElementById('mes-dias-count');

    if (elVentas) elVentas.textContent = `$${ventasMes.toFixed(2)}`;
    if (elGastos) elGastos.textContent = `$${gastosMes.toFixed(2)}`;
    if (elBalance) elBalance.textContent = `$${balanceMes.toFixed(2)}`;
    if (elCount) elCount.textContent = `${diasDelMes.length} día(s) registrado(s)`;

    const listaEl = document.getElementById('lista-dias-archivados');
    if (!listaEl) return;

    if (diasDelMes.length === 0) {
        listaEl.innerHTML = '<div class="vacio-lista">No hay días cerrados en este mes.</div>';
        return;
    }

    const diasOrdenados = [...diasDelMes].sort((a, b) => parsearFechaDia(b) - parsearFechaDia(a));

    listaEl.innerHTML = diasOrdenados.map(dia => {
        const f = parsearFechaDia(dia);
        const fStr = f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
        const bal = (dia.balance !== undefined) ? dia.balance : ((dia.ingresos || 0) - (dia.gastos || 0));
        const esPositivo = bal >= 0;
        const claseBadge = esPositivo ? 'positivo' : 'negativo';
        const signo = esPositivo ? '+' : '';

        return `
            <div class="tarjeta-dia-historial">
                <div>
                    <div class="fecha-dia">${escaparHtml(fStr.charAt(0).toUpperCase() + fStr.slice(1))}</div>
                    <div class="sub-dia">Ventas: +$${(dia.ingresos || 0).toFixed(2)} &nbsp;|&nbsp; Gastos: -$${(dia.gastos || 0).toFixed(2)}</div>
                </div>
                <div class="badge-balance ${claseBadge}">${signo}$${bal.toFixed(2)}</div>
            </div>
        `;
    }).join('');
}

function abrirHistorial() {
    cambiarTabHistorial('hoy');
    fechaMesHistorial = new Date();

    const ingresos = pedidos.filter(p => p.estado === 'entregados').reduce((a, c) => a + (c.total || 0), 0);
    const gastos = finanzas.filter(f => f.tipo === 'gasto').reduce((a, c) => a + (c.monto || 0), 0);
    const balance = ingresos - gastos;

    document.getElementById('dash-ventas').innerText = `$${ingresos.toFixed(2)}`;
    document.getElementById('dash-gastos').innerText = `$${gastos.toFixed(2)}`;
    document.getElementById('dash-balance').innerText = `$${balance.toFixed(2)}`;

    let html = '';
    pedidos.filter(p => p.estado === 'entregados').forEach(p => {
        const h = new Date(p.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        html += `<div class="historial-item ingreso"><div><small>${h}</small><br><b>Venta:</b> ${escaparHtml(p.cliente)}</div><div class="h-monto">+$${(p.total || 0).toFixed(2)}</div></div>`;
    });
    finanzas.forEach(f => {
        const h = new Date(f.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        html += `<div class="historial-item gasto"><div><small>${h}</small><br><b>Gasto:</b> ${escaparHtml(f.descripcion)}</div><div class="h-monto">-$${(f.monto || 0).toFixed(2)}</div></div>`;
    });
    document.getElementById('historial-lista').innerHTML = html || '<p style="text-align:center; color:#999; margin-top:20px;">No hay movimientos hoy.</p>';
    openModal('modal-historial');
}

function limpiarHistorial() {
    if (!confirm('¿Cerrar el día actual? Esto guardará los totales en el balance mensual y limpiará el tablero de pedidos.')) return;

    const ingresos = pedidos.filter(p => p.estado === 'entregados').reduce((a, c) => a + (c.total || 0), 0);
    const gastos = finanzas.filter(f => f.tipo === 'gasto').reduce((a, c) => a + (c.monto || 0), 0);
    if (ingresos > 0 || gastos > 0) {
        const ahora = new Date();
        historialDias.push({
            fecha: ahora.toLocaleDateString('es-MX'),
            fecha_iso: ahora.toISOString(),
            ingresos,
            gastos,
            balance: ingresos - gastos
        });
    }
    pedidos = [];
    finanzas = [];
    guardarEnServidor();
    refrescarVista();
    closeModal('modal-historial');
    mostrarToast('Día cerrado. Totales archivados en el reporte mensual.');
}

// ---------- 8. CONFIGURACIÓN Y MENÚ CRUD ----------
function abrirConfig() {
    document.getElementById('cfg-sonido').checked = !!configActual.sonido_bienvenida;
    const elVer = document.getElementById('cfg-app-version');
    if (elVer) elVer.textContent = `v${APP_VERSION}`;
    renderizarMenuUI();
    openModal('modal-config');
}

function cambiarTab(nombre) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('activo', b.dataset.tab === nombre));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('activo', p.dataset.panel === nombre));
}

function guardarConfigDesdeUI() {
    configActual.sonido_bienvenida = document.getElementById('cfg-sonido').checked;
    guardarEnServidor();
    mostrarToast('Configuración guardada.');
}

let editandoMenuIdx = null;

function renderizarMenuUI() {
    const cont = document.getElementById('lista-menu');
    if (!cont) return;
    if (!menuActual.length) {
        cont.innerHTML = '<div class="vacio-lista">Aún no agregas platillos</div>';
        return;
    }
    cont.innerHTML = menuActual.map((it, idx) => {
        if (idx === editandoMenuIdx) {
            return `<div class="item-editable editando">
                <input type="text" id="edit-nombre-${idx}" class="edit-input-nombre" value="${escaparHtml(it.nombre)}">
                <input type="number" id="edit-precio-${idx}" class="edit-input-precio" value="${it.precio}">
                <button class="ok" onclick="guardarEdicionPlatillo(${idx})" title="Guardar">✔️</button>
                <button onclick="cancelarEdicionPlatillo()" title="Cancelar">✕</button>
            </div>`;
        }
        return `<div class="item-editable">
            <span class="nombre">${escaparHtml(it.nombre)}</span>
            <span class="precio">$${Number(it.precio || 0).toFixed(2)}</span>
            <button class="editar" onclick="editarPlatillo(${idx})" title="Editar">✏️</button>
            <button onclick="eliminarPlatillo(${idx})" title="Eliminar">✕</button>
        </div>`;
    }).join('');
}

function guardarMenuEnServidor() {
    guardarEnServidor();
}

function agregarPlatillo() {
    const nombre = document.getElementById('menu-nombre').value.trim();
    const precio = parseFloat(document.getElementById('menu-precio').value) || 0;
    if (!nombre) { mostrarToast('Escribe el nombre del platillo.'); return; }

    menuActual.push({ nombre, precio });
    document.getElementById('menu-nombre').value = '';
    document.getElementById('menu-precio').value = '';
    renderizarMenuUI();
    guardarMenuEnServidor();
    mostrarToast('Platillo agregado al menú.');
}

function eliminarPlatillo(idx) {
    menuActual.splice(idx, 1);
    renderizarMenuUI();
    guardarMenuEnServidor();
    mostrarToast('Platillo eliminado.');
}

function editarPlatillo(idx) { editandoMenuIdx = idx; renderizarMenuUI(); }
function cancelarEdicionPlatillo() { editandoMenuIdx = null; renderizarMenuUI(); }

function guardarEdicionPlatillo(idx) {
    const nombre = document.getElementById(`edit-nombre-${idx}`).value.trim();
    const precio = parseFloat(document.getElementById(`edit-precio-${idx}`).value) || 0;
    if (!nombre) { mostrarToast('El nombre no puede quedar vacío.'); return; }

    menuActual[idx] = { nombre, precio };
    editandoMenuIdx = null;
    renderizarMenuUI();
    guardarMenuEnServidor();
    mostrarToast('Platillo actualizado.');
}

function importarMenuMasivo() {
    const texto = document.getElementById('menu-bulk').value;
    const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    let agregados = 0;

    lineas.forEach(linea => {
        const partes = linea.split(',');
        const nombre = (partes[0] || '').trim();
        const precio = parseFloat((partes[1] || '0').replace('$', '').trim()) || 0;
        if (nombre) { menuActual.push({ nombre, precio }); agregados++; }
    });

    if (agregados === 0) { mostrarToast('No se reconoció ningún platillo. Usa el formato: Nombre, Precio'); return; }

    document.getElementById('menu-bulk').value = '';
    renderizarMenuUI();
    guardarMenuEnServidor();
    mostrarToast(`Se agregaron ${agregados} platillo(s) al menú.`);
}

// ---------- 9. PEDIDO DE WHATSAPP (ANÁLISIS LOCAL EN JS) ----------
let ultimoAnalisisWhatsapp = null;

function abrirPedidoWhatsapp() {
    document.getElementById('pw-cliente').value = '';
    document.getElementById('pw-texto').value = '';
    document.getElementById('pw-resultado').classList.remove('visible');
    document.getElementById('pw-resultado').innerHTML = '';
    ultimoAnalisisWhatsapp = null;
    openModal('modal-pedido-whatsapp');
}

function analizarPedidoWhatsapp() {
    const texto = document.getElementById('pw-texto').value.trim();
    if (!texto) { mostrarToast('Pega el mensaje del cliente primero.'); return; }

    // Ejecuta el motor local de análisis en JavaScript
    const resultado = analizarMensaje(texto, menuActual);
    ultimoAnalisisWhatsapp = resultado;
    mostrarResultadoPedidoWhatsapp(resultado);
}

function mostrarResultadoPedidoWhatsapp(r) {
    const el = document.getElementById('pw-resultado');
    el.classList.add('visible');

    if (!r.es_pedido) {
        el.innerHTML = `<div class="etiqueta">Resultado</div>
            <div style="margin-bottom:8px;">🙅 No se reconoció como pedido (revisa tu Menú en Configuración, o agrégalo a mano con "Pedido Mostrador").</div>`;
        return;
    }

    const chipClase = { alta: 'chip-alta', media: 'chip-media', baja: 'chip-baja' }[r.confianza] || 'chip-baja';
    const itemsHtml = r.items.length
        ? r.items.map(it => `• ${it.cantidad}x ${escaparHtml(it.nombre)}`).join('<br>')
        : '(se guardará el mensaje completo como detalle)';
    const entregaTexto = {
        domicilio: '🚚 A domicilio',
        recoge: '🏃 El cliente pasa a recoger',
        sin_definir: '❓ No especificó — habrá que preguntarle',
    }[r.tipo_entrega];

    el.innerHTML = `
        <div class="etiqueta">Resultado</div>
        <div style="margin-bottom:8px;">✅ <b>Se agregará como pedido</b> &nbsp;<span class="chip-confianza ${chipClase}">confianza ${r.confianza}</span></div>
        <div style="margin-bottom:8px;">${itemsHtml}</div>
        <div style="margin-bottom:8px;">${entregaTexto}</div>
        ${r.total_estimado > 0 ? `<div style="margin-bottom:10px;"><b>Total estimado: $${Number(r.total_estimado).toFixed(2)}</b></div>` : ''}
        <button class="btn btn-primary btn-full" onclick="confirmarPedidoWhatsapp()">➕ Agregar al tablero</button>
    `;
}

function confirmarPedidoWhatsapp() {
    const cliente = document.getElementById('pw-cliente').value.trim();
    const texto = document.getElementById('pw-texto').value.trim();
    if (!texto) return;

    let telefono = '';
    const matchTel = cliente.match(/(\d[\d\s\-]{7,})/);
    if (matchTel) telefono = matchTel[1].replace(/[\s\-]/g, '');

    const r = ultimoAnalisisWhatsapp || analizarMensaje(texto, menuActual);
    if (!r.es_pedido) {
        mostrarToast('El mensaje no califica como pedido.');
        return;
    }

    const nuevoPedido = {
        id: generarId(),
        origen: 'wasap',
        cliente: cliente || 'Cliente WhatsApp',
        telefono: telefono,
        detalle: r.texto_detalle,
        items: r.items,
        tipo_entrega: r.tipo_entrega,
        mensaje_original: texto,
        total: r.total_estimado,
        confianza: r.confianza,
        estado: 'espera',
        fecha: new Date().toISOString(),
    };

    pedidos.push(nuevoPedido);
    guardarEnServidor();
    refrescarVista();
    closeModal('modal-pedido-whatsapp');

    if (nuevoPedido.tipo_entrega === 'sin_definir') {
        mostrarSugerenciaRespuesta(nuevoPedido);
    } else {
        mostrarToast('Pedido agregado a "En espera".');
    }
}

function mostrarSugerenciaRespuesta(pedido) {
    const mensaje = '¡Hola! Recibimos tu pedido, gracias. ¿Nos confirmas si lo quieres a domicilio o si tú pasas a recogerlo?';
    const cont = document.createElement('div');
    cont.className = 'modal-overlay activo';
    cont.innerHTML = `
        <div class="modal" style="text-align:center;">
            <h2>❓ Falta confirmar entrega</h2>
            <p class="ayuda" style="text-align:left;">El pedido ya quedó en el tablero. Pídele a ${escaparHtml(pedido.cliente)} que confirme domicilio o recoge:</p>
            <textarea readonly style="margin-top:8px;">${mensaje}</textarea>
            <div class="btn-group">
                <button class="btn btn-ghost" id="btn-cerrar-sugerencia">Cerrar</button>
                ${pedido.telefono ? `<button class="btn btn-primary" id="btn-abrir-wa">💬 Abrir WhatsApp</button>` : `<button class="btn btn-primary" id="btn-copiar-msj">📋 Copiar</button>`}
            </div>
        </div>`;
    document.body.appendChild(cont);
    cont.querySelector('#btn-cerrar-sugerencia').onclick = () => cont.remove();
    const btnWa = cont.querySelector('#btn-abrir-wa');
    if (btnWa) btnWa.onclick = () => {
        window.open(`https://wa.me/${pedido.telefono}?text=${encodeURIComponent(mensaje)}`, '_blank');
        cont.remove();
    };
    const btnCopiar = cont.querySelector('#btn-copiar-msj');
    if (btnCopiar) btnCopiar.onclick = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(mensaje);
        }
        mostrarToast('Mensaje copiado.');
        cont.remove();
    };
}

// ---------- 10. RESPALDOS (EXPORTAR / IMPORTAR) ----------
function exportarRespaldo() {
    const datos = cargarDatosLocales();
    const jsonStr = JSON.stringify(datos, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fecha = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `respaldo_cocina_tita_${fecha}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast('Respaldo descargado en el dispositivo.');
}

function restaurarRespaldo(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importado = JSON.parse(e.target.result);
            if (!confirm('¿Restaurar este archivo de respaldo? Se reemplazarán los pedidos y menú actuales.')) return;
            guardarDatosLocales(importado);
            sincronizarConServidor();
            mostrarToast('Datos restaurados con éxito.');
            closeModal('modal-config');
        } catch (err) {
            mostrarToast('El archivo seleccionado no es válido.');
        }
    };
    reader.readAsText(file);
}

// ---------- 11. UTILIDADES ----------
function openModal(id) { document.getElementById(id)?.classList.add('activo'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('activo'); }

function escaparHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

let toastTimeout;
function mostrarToast(mensaje) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = mensaje;
    toast.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3200);
}

// ---------- 12. ACTUALIZADOR AUTOMÁTICO (0 PESOS) ----------
let ultimaInfoActualizacion = null;

async function verificarActualizaciones(esManual = false) {
    if (esManual) mostrarToast('Buscando actualizaciones en la nube...');

    const url = configActual.url_actualizacion || DEFAULT_UPDATE_URL;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const cacheBuster = (url.includes('?') ? '&' : '?') + 't=' + Date.now();
        const res = await fetch(url + cacheBuster, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error('Servidor no disponible');
        const data = await res.json();

        if (data && data.version && esVersionSuperior(data.version, APP_VERSION)) {
            ultimaInfoActualizacion = data;
            mostrarModalActualizacion(data);
        } else {
            if (esManual) {
                mostrarToast(`Cocina Tita está actualizada a la última versión (v${APP_VERSION}) ✨`);
            }
        }
    } catch (err) {
        console.log('Verificación de actualización silenciosa:', err.message);
        if (esManual) {
            mostrarToast('No se pudo verificar actualizaciones (revisa tu conexión Wi-Fi/Internet).');
        }
    }
}

function esVersionSuperior(remota, local) {
    const pRemota = remota.replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
    const pLocal = local.replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(pRemota.length, pLocal.length); i++) {
        const r = pRemota[i] || 0;
        const l = pLocal[i] || 0;
        if (r > l) return true;
        if (r < l) return false;
    }
    return false;
}

function mostrarModalActualizacion(data) {
    const elActual = document.getElementById('upd-ver-actual');
    const elNueva = document.getElementById('upd-ver-nueva');
    const elNotas = document.getElementById('upd-novedades');

    if (elActual) elActual.textContent = `v${APP_VERSION}`;
    if (elNueva) elNueva.textContent = `v${data.version}`;
    if (elNotas) elNotas.textContent = data.notas || 'Nuevas funciones y mejoras de rendimiento.';

    openModal('modal-actualizacion');
}

function descargarEInstalarActualizacion() {
    if (!ultimaInfoActualizacion || !ultimaInfoActualizacion.url_apk) {
        mostrarToast('Enlace de descarga no disponible en este momento.');
        return;
    }
    closeModal('modal-actualizacion');
    mostrarToast('Iniciando descarga de la nueva versión...');
    window.open(ultimaInfoActualizacion.url_apk, '_system');
}

// ---------- 13. INTEGRACIÓN CON FIREBASE EN TIEMPO REAL ----------
const firebaseConfig = {
    apiKey: "AIzaSyBkuy0Hq7iaBGgwmQfjqMYKQSgTYx1ay1A",
    authDomain: "cocina-tita.firebaseapp.com",
    projectId: "cocina-tita",
    storageBucket: "cocina-tita.firebasestorage.app",
    messagingSenderId: "499185674891",
    appId: "1:499185674891:web:cccdf9aef62ad36048c28e",
    measurementId: "G-CGJPJ9Z1ZH"
};

let dbFirebase = null;
let cocinaEnLinea = true;

function iniciarSincronizacionFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.log('Firebase SDK pendiente de conexión.');
            return;
        }
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        dbFirebase = firebase.firestore();

        // 1. Escuchar estado de cocina (para sincronizar entre dispositivos y el botón)
        dbFirebase.collection('estado_cocina').doc('actual').onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                cocinaEnLinea = data.abierto === true;
                actualizarBotonEstadoUI(cocinaEnLinea);
            }
        }, err => console.log('Escucha de estado cocina:', err.message));

        // 2. Escuchar pedidos en línea en tiempo real
        dbFirebase.collection('pedidos_online').where('estado', '==', 'espera').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    const docId = change.doc.id;
                    
                    // Verificar si ya lo tenemos registrado localmente
                    const yaExiste = pedidos.some(p => p.id === docId || (data.folio && p.folio === data.folio));
                    if (!yaExiste) {
                        const nuevo = {
                            id: docId,
                            folio: data.folio || 'WEB',
                            origen: 'web',
                            cliente: data.cliente || 'Cliente Web',
                            telefono: data.telefono || '',
                            tipo_entrega: data.tipo_entrega || 'recoge',
                            direccion: data.direccion || '',
                            notas: data.notas || '',
                            items: data.items || [],
                            detalle: data.detalle || (data.items ? data.items.map(i => `${i.cantidad}x ${i.nombre}`).join(', ') : ''),
                            envio: data.envio || 0,
                            total: data.total || 0,
                            estado: 'espera',
                            fecha: data.fecha || new Date().toISOString()
                        };

                        pedidos.unshift(nuevo);
                        guardarEnServidor();
                        refrescarVista();
                        reproducirTimbrePedidoWeb();
                        mostrarToast(`🛎️ ¡NUEVO PEDIDO WEB! Folio #${nuevo.folio} - ${nuevo.cliente} ($${nuevo.total.toFixed(2)})`);
                    }
                }
            });
        }, err => console.log('Escucha pedidos_online:', err.message));

    } catch (e) {
        console.error('Error inicializando Firebase:', e);
    }
}

function toggleEstadoCocina() {
    cocinaEnLinea = !cocinaEnLinea;
    actualizarBotonEstadoUI(cocinaEnLinea);

    if (dbFirebase) {
        dbFirebase.collection('estado_cocina').doc('actual').set({
            abierto: cocinaEnLinea,
            mensaje: cocinaEnLinea ? '' : 'Por el momento no estamos recibiendo pedidos en línea (cocina en pausa o fuera de horario).',
            actualizado: new Date().toISOString()
        }).then(() => {
            mostrarToast(cocinaEnLinea ? 'Cocina En Línea 🟢 (Aceptando pedidos web)' : 'Cocina Fuera de Línea 🔴 (Pedidos web pausados)');
        }).catch(err => {
            console.error('Error actualizando estado en Firestore:', err);
            mostrarToast('Error al actualizar en la nube (revisa tu conexión).');
        });
    } else {
        mostrarToast(cocinaEnLinea ? 'Cocina En Línea 🟢' : 'Cocina Fuera de Línea 🔴');
    }
}

function actualizarBotonEstadoUI(online) {
    const btn = document.getElementById('btn-estado-cocina');
    const btnCfg = document.getElementById('cfg-btn-toggle-online');
    const descCfg = document.getElementById('cfg-online-desc');

    if (online) {
        if (btn) {
            btn.className = 'btn-status-cocina online';
            btn.innerHTML = '🟢 En Línea';
        }
        if (btnCfg) {
            btnCfg.className = 'btn-status-cocina online';
            btnCfg.innerHTML = '🟢 En Línea';
        }
        if (descCfg) descCfg.textContent = 'Abierta: Clientes pueden ordenar';
    } else {
        if (btn) {
            btn.className = 'btn-status-cocina offline';
            btn.innerHTML = '🔴 Fuera de Línea';
        }
        if (btnCfg) {
            btnCfg.className = 'btn-status-cocina offline';
            btnCfg.innerHTML = '🔴 Fuera de Línea';
        }
        if (descCfg) descCfg.textContent = 'Pausada: Clientes verán aviso de cocina cerrada';
    }
}

function publicarMenuOnline() {
    if (!dbFirebase) {
        mostrarToast('Servicio en la nube no conectado.');
        return;
    }
    mostrarToast('Publicando menú en la nube...');
    dbFirebase.collection('menu_online').doc('actual').set({
        platillos: menuActual,
        actualizado: new Date().toISOString()
    }).then(() => {
        mostrarToast('¡Menú sincronizado exitosamente con la web! ☁️');
    }).catch(err => {
        console.error('Error publicando menú:', err);
        mostrarToast('No se pudo publicar el menú en la nube.');
    });
}

function reproducirTimbrePedidoWeb() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        const tocarNota = (frecuencia, tiempoInicio, duracion) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frecuencia, tiempoInicio);
            gain.gain.setValueAtTime(0, tiempoInicio);
            gain.gain.linearRampToValueAtTime(0.45, tiempoInicio + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + duracion);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(tiempoInicio);
            osc.stop(tiempoInicio + duracion);
        };

        const t = ctx.currentTime;
        tocarNota(587.33, t, 0.4);        // D5
        tocarNota(880.00, t + 0.18, 0.6); // A5
    } catch (e) {
        console.log('AudioContext timbre:', e);
    }
}


