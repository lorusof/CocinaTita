// ==========================================================
// COCINA TITA — MOTOR DE PARSER DE PEDIDOS (JavaScript Nativo)
// ----------------------------------------------------------
// Portado directamente desde pedido_parser.py para ejecutarse
// 100% de forma local en el dispositivo (sin servidor ni Python).
// ==========================================================

const INTENCION_PEDIDO = [
    "pedido", "quiero pedir", "quisiera pedir", "quiero", "quisiera",
    "encargar", "encargo", "ordenar", "una orden", "me manda", "me mandas",
    "me mandan", "me puede mandar", "me puedes mandar", "aparta",
    "apartame", "apartarme", "resérvame", "reservame", "para hoy me",
    "se podra", "sera posible", "será posible", "porfa me", "me vende",
    "me vendes",
];

const PALABRAS_DOMICILIO = [
    "domicilio", "envien", "envíen", "enviar", "envio", "envío",
    "me lo mandan", "me lo envian", "me lo envían", "manden a mi casa",
    "a mi casa", "traer a", "traelo a", "tráelo a", "llevar a mi",
    "delivery", "mandarmelo", "mandármelo", "enviarmelo", "enviármelo",
    "vivo en", "mi direccion es", "mi dirección es", "direccion:",
    "dirección:",
];

const PALABRAS_RECOGE = [
    "paso por", "paso a las", "paso a recoger", "yo lo recojo", "recojo",
    "voy por", "voy a pasar", "lo recojo", "recoger", "en el local",
    "ahí lo recojo", "ahi lo recojo", "yo paso",
];

const NUMEROS_TEXTO = {
    "un": 1, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4,
    "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10,
    "once": 11, "doce": 12, "media": 0.5, "medio": 0.5, "par": 2,
};

const PALABRAS_NUMEROS_ORDENADAS = Object.keys(NUMEROS_TEXTO).sort((a, b) => b.length - a.length);
const PATRON_NUM_TEXTO = new RegExp(`\\b(${PALABRAS_NUMEROS_ORDENADAS.join("|")})\\b`, "i");
const PATRON_NUM_DIGITO_X = /(\d+(?:[.,]\d+)?)\s*x\s*$/i;
const PATRON_NUM_DIGITO = /(\d+(?:[.,]\d+)?)\s*(?:x)?\s*$/i;

const PATRON_CON_X = /(\d+)\s*x\s*([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s]{1,35}?)(?:,|\.|;|\n|$|\sy\s)/gi;
const PATRON_SIN_X = /(?<!\w)(\d{1,2})\s+([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ]{2,30})(?:,|\.|;|\n|$|\sy\s)/gi;

function normalizar(texto) {
    if (!texto) return "";
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function contieneAlguna(textoNormalizado, listaFrases) {
    return listaFrases.some(frase => textoNormalizado.includes(normalizar(frase)));
}

function buscarCantidadAntes(textoNormalizado, posicion) {
    const inicio = Math.max(0, posicion - 20);
    const fragmento = textoNormalizado.substring(inicio, posicion);

    const mDigitoX = fragmento.match(PATRON_NUM_DIGITO_X);
    if (mDigitoX) {
        const val = parseFloat(mDigitoX[1].replace(",", "."));
        if (!isNaN(val)) return [val, true];
    }

    const mDigito = fragmento.match(PATRON_NUM_DIGITO);
    if (mDigito) {
        const val = parseFloat(mDigito[1].replace(",", "."));
        if (!isNaN(val)) return [val, true];
    }

    const mTexto = fragmento.match(PATRON_NUM_TEXTO);
    if (mTexto) {
        const palabra = mTexto[1].toLowerCase();
        if (NUMEROS_TEXTO[palabra] !== undefined) {
            return [NUMEROS_TEXTO[palabra], true];
        }
    }

    return [1, false];
}

function extraerItemsConMenu(textoNormalizado, menu) {
    const items = [];
    const menuOrdenado = [...menu].sort((a, b) => (b.nombre || "").length - (a.nombre || "").length);
    let textoTrabajo = textoNormalizado;

    for (const platillo of menuOrdenado) {
        const nombre = (platillo.nombre || "").trim();
        if (!nombre) continue;
        const nombreNorm = normalizar(nombre);
        if (!nombreNorm || nombreNorm.length < 3) continue;

        const idx = textoTrabajo.indexOf(nombreNorm);
        if (idx === -1) continue;

        const [cantidad, explicita] = buscarCantidadAntes(textoTrabajo, idx);
        items.push({
            cantidad: cantidad,
            nombre: nombre,
            precio_unit: platillo.precio !== undefined ? platillo.precio : null,
            cantidad_explicita: explicita,
        });

        textoTrabajo = (
            textoTrabajo.substring(0, idx) +
            (" ".repeat(nombreNorm.length)) +
            textoTrabajo.substring(idx + nombreNorm.length)
        );
    }

    return items;
}

function extraerItemsGenericos(textoOriginal) {
    const fuertes = [];
    const debiles = [];
    const textoConSalto = textoOriginal + "\n";

    let match;
    const regexConX = new RegExp(PATRON_CON_X.source, "gi");
    while ((match = regexConX.exec(textoConSalto)) !== null) {
        const cant = parseFloat(match[1]);
        const nom = match[2].trim();
        const nomCap = nom.charAt(0).toUpperCase() + nom.slice(1);
        fuertes.push({
            cantidad: cant,
            nombre: nomCap,
            precio_unit: null,
            cantidad_explicita: true,
        });
    }

    if (fuertes.length === 0) {
        const regexSinX = new RegExp(PATRON_SIN_X.source, "gi");
        while ((match = regexSinX.exec(textoConSalto)) !== null) {
            const cant = parseFloat(match[1]);
            const nom = match[2].trim();
            const nomCap = nom.charAt(0).toUpperCase() + nom.slice(1);
            debiles.push({
                cantidad: cant,
                nombre: nomCap,
                precio_unit: null,
                cantidad_explicita: true,
            });
        }
    }

    return [fuertes, debiles];
}

function detectarTipoEntrega(textoOriginal) {
    const t = normalizar(textoOriginal);
    const esDomicilio = contieneAlguna(t, PALABRAS_DOMICILIO);
    const esRecoge = contieneAlguna(t, PALABRAS_RECOGE);

    if (esDomicilio && !esRecoge) return "domicilio";
    if (esRecoge && !esDomicilio) return "recoge";
    return "sin_definir";
}

function fmtCantidad(c) {
    return Number.isInteger(c) ? c.toString() : c.toString();
}

function analizarMensaje(textoOriginal, menu = []) {
    menu = menu || [];
    const textoNorm = normalizar(textoOriginal);
    const tieneIntencion = contieneAlguna(textoNorm, INTENCION_PEDIDO);

    const itemsMenu = menu.length > 0 ? extraerItemsConMenu(textoNorm, menu) : [];
    const hayCantidadExplicita = itemsMenu.some(it => it.cantidad_explicita);

    let esPedido = false;
    let confianza = "baja";
    let items = [];

    if (itemsMenu.length > 0 && (hayCantidadExplicita || tieneIntencion || itemsMenu.length >= 2)) {
        items = itemsMenu;
        confianza = "alta";
        esPedido = true;
    } else {
        const [fuertes, debiles] = extraerItemsGenericos(textoOriginal);
        if (fuertes.length > 0) {
            items = fuertes;
            confianza = "media";
            esPedido = true;
        } else if (debiles.length > 0 && tieneIntencion) {
            items = debiles;
            confianza = "media";
            esPedido = true;
        } else if (itemsMenu.length > 0) {
            items = itemsMenu;
            confianza = "baja";
            esPedido = false;
        }
    }

    const tipoEntrega = esPedido ? detectarTipoEntrega(textoOriginal) : "sin_definir";

    const textoDetalle = (items.length > 0)
        ? items.map(it => `${fmtCantidad(it.cantidad)}x ${it.nombre}`).join(", ")
        : (textoOriginal || "").trim();

    const totalEstimado = items.reduce((acc, it) => {
        if (it.precio_unit) return acc + (it.cantidad * it.precio_unit);
        return acc;
    }, 0);

    return {
        es_pedido: esPedido,
        confianza: confianza,
        items: items,
        tipo_entrega: tipoEntrega,
        texto_detalle: textoDetalle,
        total_estimado: Math.round(totalEstimado * 100) / 100,
    };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        normalizar,
        contieneAlguna,
        detectarTipoEntrega,
        analizarMensaje,
    };
}
