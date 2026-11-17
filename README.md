# Cocina Tita 🌮🎄

Sistema integral de gestión de cocina, tablero de pedidos y menú interactivo en línea para clientes con soporte de actualización automática y sincronización en tiempo real vía Google Firebase.

## 🌐 Menú en Línea para Clientes (GitHub Pages)
Cuando activas **GitHub Pages** en este repositorio (Settings ➔ Pages ➔ Source: `Deploy from a branch` ➔ Branch: `main` / `root`), tus clientes pueden pedir directamente en:
👉 **`https://lorusof.github.io/CocinaTita/`**

### Funciones de la Web de Clientes:
- **Estado de Cocina en Vivo:** Si la cocina está abierta en la tablet/celular, permite ordenar; si está fuera de línea, muestra aviso de cocina cerrada o en descanso.
- **Carrito y Menú Navideño:** Selección de platillos, cantidades, cálculo automático de subtotal y envío.
- **Modo de Entrega:** Domicilio (con dirección y referencias) o Recoger en mostrador.
- **Confirmación con Folio y WhatsApp:** Emisión de ticket digital con número de folio y enlace directo al WhatsApp del negocio.

---

## 📱 App de Cocina (APK Android)
- **Recepción en Tiempo Real:** En cuanto un cliente envía un pedido desde la web, aparece automáticamente en el tablero en la columna **"En espera"** con un aviso sonoro (campana de cocina).
- **Control En Línea / Fuera de Línea:** Switch visible en la cabecera para abrir o pausar los pedidos web con un solo toque.
- **Sincronización de Menú:** Modifica platillos y precios en la app y publícalos a la nube con un solo clic.
- **Auto-Actualizaciones:** La app consulta el archivo `version.json` en este repositorio para avisar de nuevas versiones disponibles.

---

## 📂 Estructura del Repositorio
- `index.html`: Página web del menú para clientes (servida por GitHub Pages).
- `pedir.html`: Alias directo para la web de pedidos.
- `version.json`: Manifiesto de control de versiones y actualizaciones para la APK.
- `img/`: Logotipos e íconos oficiales de Cocina Tita.
- `app_cocina_codigo_fuente/`: Respaldo completo del código web de la app de cocina (Capacitor).
