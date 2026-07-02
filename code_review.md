# Code Review — cs2-lens-proxy

## Resumen ejecutivo

Proyecto pequeño (~230 líneas JS) y bien acotado: un proxy serverless en Vercel que oculta la API key de FACEIT para una extensión de Chrome. La arquitectura general es correcta para el caso de uso (file-based routing de Vercel, zero dependencies, CORS whitelisteado). Sin embargo, hay **violación DRY significativa** (el bloque try/catch de fetch se repite idéntico 4 veces), una **validación redundante** en `players.js`, y la ausencia total de tooling de calidad (ni ESLint, ni Prettier, ni TypeScript, ni tests). El proyecto es funcional pero le falta madurez de ingeniería.

---

### 🟡 IMPORTANTE — Falta `vercel.json` para hardening de headers

**Qué:** No existe [vercel.json](file:///c:/dev/projects/cs2-lens-proxy/vercel.json) configurando security headers.

**Por qué:** Las serverless functions están expuestas sin headers como `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc. No afecta a una API pura, pero es buena práctica y previene uso inadecuado (embedding en iframes, MIME sniffing).

**Cómo:**
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
```

**Prioridad:** 🟡 Importante

---

### 🟡 IMPORTANTE — Sin rate limiting

**Qué:** Ningún endpoint implementa rate limiting.

**Por qué:** Una extensión de Chrome comprometida, o alguien descubriendo las URLs del proxy, podría hacer miles de requests por segundo, quemando tu cuota de FACEIT y potencialmente generando costes en Vercel.

**Cómo:** Vercel ofrece [WAF/Rate Limiting](https://vercel.com/docs/security/rate-limits) nativo en el plan Pro. Alternativamente, se puede implementar un rate limiter básico con Vercel KV o con un header check:
```js
// En vercel.json (plan Pro)
{
  "rateLimits": [
    {
      "path": "/api/*",
      "limit": 100,
      "window": "1m"
    }
  ]
}
```

**Prioridad:** 🟡 Importante

---

### 🟢 NICE TO HAVE — Validar formato de inputs antes de proxy

**Qué:** Los parámetros como `player_id`, `game_id`, `region` se pasan directamente a la URL de FACEIT después de `encodeURIComponent`.

**Por qué:** Aunque `encodeURIComponent` previene inyección de paths, validar el formato esperado (UUID para player_id, string alfanumérico para game_id) añade una capa de defensa en profundidad y evita requests innecesarios a la API upstream.

**Cómo:**
```js
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (!UUID_RE.test(player_id)) {
  return res.status(400).json({ error: "Invalid player_id format" });
}
```

**Prioridad:** 🟢 Nice to have

---

## 2. Principios de diseño — DRY

### 🟡 IMPORTANTE — Bloque fetch + error handling duplicado 4 veces

**Qué:** Los 4 handlers ([players.js](file:///c:/dev/projects/cs2-lens-proxy/api/faceit/players.js), [[player_id].js](file:///c:/dev/projects/cs2-lens-proxy/api/faceit/players/%5Bplayer_id%5D.js), [[region].js](file:///c:/dev/projects/cs2-lens-proxy/api/faceit/rankings/games/%5Bgame_id%5D/regions/%5Bregion%5D.js), [[player_id].js](file:///c:/dev/projects/cs2-lens-proxy/api/faceit/rankings/games/%5Bgame_id%5D/regions/%5Bregion%5D/players/%5Bplayer_id%5D.js)) repiten **exactamente** el mismo patrón:

```js
// REPETIDO 4 VECES — idéntico
try {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${process.env.FACEIT_API_KEY}`,
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Faceit error", response.status, errorBody);
        return res.status(response.status).json({
            error: "Faceit API request failed",
        });
    }

    const data = await response.json();
    return res.status(200).json(data);
} catch (_err) {
    return res.status(500).json({ error: "Internal server error" });
}
```

**Por qué:** Si necesitas cambiar el manejo de errores, añadir logging, añadir cache headers, o cambiar la key header, tienes que hacerlo en 4 archivos. Con más endpoints, la deuda se multiplica.

**Cómo:** Extraer a `api/_lib/faceit-client.js`:

```js
// api/_lib/faceit-client.js
const FACEIT_BASE = "https://open.faceit.com/data/v4";

export async function faceitFetch(path, res) {
    try {
        const response = await fetch(`${FACEIT_BASE}${path}`, {
            headers: {
                Authorization: `Bearer ${process.env.FACEIT_API_KEY}`,
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("FACEIT API error:", response.status, errorBody);
            res.status(response.status).json({ error: "Faceit API request failed" });
            return null;
        }

        return await response.json();
    } catch (err) {
        console.error("FACEIT fetch failed:", err);
        res.status(500).json({ error: "Internal server error" });
        return null;
    }
}
```

Uso en handlers:
```js
// Antes (41 líneas en [player_id].js)
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== "GET") { ... }
    try {
        const response = await fetch(`https://open.faceit.com/data/v4/players/${...}`, { ... });
        // ... 15 líneas de error handling
    } catch (_err) { ... }
}

// Después (12 líneas)
import { faceitFetch } from "../../_lib/faceit-client.js";

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const { player_id } = req.query;
    if (!player_id) return res.status(400).json({ error: "Missing player_id" });

    const data = await faceitFetch(`/players/${encodeURIComponent(player_id)}`, res);
    if (data) res.status(200).json(data);
}
```

**Prioridad:** 🟡 Importante

---

### 🟡 IMPORTANTE — Boilerplate de CORS + method check repetido en todos los handlers

**Qué:** Las primeras 5-7 líneas de cada handler son idénticas:
```js
if (applyCors(req, res)) return;
if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
}
```

**Por qué:** Mismo problema DRY. Si en el futuro decides soportar `HEAD` o cambiar el mensaje de error, necesitas tocar 4 archivos.

**Cómo:** Crear un wrapper en `api/_lib/handler.js`:

```js
import { applyCors } from "./cors.js";

export function createHandler(fn) {
    return async (req, res) => {
        if (applyCors(req, res)) return;

        if (req.method !== "GET") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        return fn(req, res);
    };
}
```

Uso:
```js
import { createHandler } from "../../_lib/handler.js";

export default createHandler(async (req, res) => {
    const { player_id } = req.query;
    // ... solo la lógica específica del endpoint
});
```

**Prioridad:** 🟡 Importante

---

### 🟢 NICE TO HAVE — URL base de FACEIT hardcodeada en 4 archivos

**Qué:** `https://open.faceit.com/data/v4` aparece como string literal en los 4 handlers.

**Por qué:** Si FACEIT actualiza su API a v5, tienes que buscar y reemplazar en todos los archivos.

**Cómo:** Definirla como constante en el módulo `faceit-client.js` propuesto arriba. Resuelto automáticamente con la refactorización DRY.

**Prioridad:** 🟢 Nice to have (resuelto con el fix DRY anterior)

---

## 3. Calidad del código

### 🟡 IMPORTANTE — Validación redundante en `players.js`

**Qué:** En [players.js](file:///c:/dev/projects/cs2-lens-proxy/api/faceit/players.js) (líneas 16-29 de `buildPlayersUrl`), la condición `hasNickname && hasGameAndId` ya captura el caso de conflicto. Pero después, en el bloque `if (hasNickname)`, se vuelve a verificar `if (game || game_player_id)`:

```js
// Primer check — líneas 16-21
if (hasNickname && hasGameAndId) {
    return { error: "'nickname' cannot be combined with 'game' or 'game_player_id'", status: 400 };
}

// Segundo check — REDUNDANTE — líneas 23-29
if (hasNickname) {
    if (game || game_player_id) {   // ← Esto NUNCA se ejecuta
        return { error: "'nickname' cannot be combined...", status: 400 };
    }
    // ...
}
```

**Por qué:** El segundo `if (game || game_player_id)` es **código muerto**. Si `hasNickname` es true y `hasGameAndId` es false (la única forma de llegar aquí), eso significa `!game || !game_player_id`. Pero ¿qué pasa si solo `game` está presente sin `game_player_id`? Ah, en ese caso `game` sería truthy pero `hasGameAndId` sería false. Así que **el segundo check no es del todo muerto** — captura el caso de `nickname + game` sin `game_player_id`. Pero el primer check con `hasNickname && hasGameAndId` no lo captura. Esto indica un **bug sutil**: la condición `hasNickname && hasGameAndId` no detecta `nickname + game` (sin `game_player_id`). La lógica funciona correctamente solo porque el segundo check existe, pero el flujo es confuso.

**Cómo:** Simplificar `buildPlayersUrl`:
```js
function buildPlayersUrl(query) {
    const { nickname, game, game_player_id } = query;

    if (nickname) {
        if (game || game_player_id) {
            return { error: "'nickname' cannot be combined with 'game' or 'game_player_id'", status: 400 };
        }
        return { url: `https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(nickname)}` };
    }

    if (!game || !game_player_id) {
        return { error: "Provide 'nickname' alone, or both 'game' and 'game_player_id'", status: 400 };
    }

    const params = new URLSearchParams({ game, game_player_id });
    return { url: `https://open.faceit.com/data/v4/players?${params}` };
}
```

Misma lógica, sin redundancias, sin variables intermedias innecesarias, y con un flujo claro: nickname → exclusivo; game+id → ambos obligatorios.

**Prioridad:** 🟡 Importante

---

### 🟡 IMPORTANTE — Errores silenciados en catch

**Qué:** En los 4 handlers:
```js
} catch (_err) {
    return res.status(500).json({ error: "Internal server error" });
}
```

**Por qué:** `_err` nunca se loguea. Si un fetch falla por un DNS timeout, un certificado expirado, o cualquier error de red, no tienes **ninguna traza** en los logs de Vercel. Depurar un 500 en producción se convierte en un ejercicio de adivinación.

**Cómo:**
```js
} catch (err) {
    console.error("Unhandled error in handler:", err);
    return res.status(500).json({ error: "Internal server error" });
}
```

**Prioridad:** 🟡 Importante

---

### 🟢 NICE TO HAVE — `limit ?? "2"` es un default sospechoso

**Qué:** En [region.js](file:///c:/dev/projects/cs2-lens-proxy/api/faceit/rankings/games/%5Bgame_id%5D/regions/%5Bregion%5D.js) y [[player_id].js](file:///c:/dev/projects/cs2-lens-proxy/api/faceit/rankings/games/%5Bgame_id%5D/regions/%5Bregion%5D/players/%5Bplayer_id%5D.js):
```js
params.append("limit", limit ?? "2");
```

**Por qué:** Un `limit=2` por defecto es inusualmente bajo para un ranking. La FACEIT API probablemente usa un default más sensato (20). Forzar `limit=2` cuando no se pasa significa que la extensión siempre tiene que especificar explícitamente el limit, y si no lo hace, obtiene solo 2 resultados. Si este es el comportamiento deseado (para rendimiento), debería al menos documentarse como decisión intencional con un comentario.

**Prioridad:** 🟢 Nice to have

---

## 4. Tooling y configuración

### 🟡 IMPORTANTE — Sin ESLint ni Prettier

**Qué:** No existe ninguna configuración de linting ni formatting.

**Por qué:** Sin herramientas automáticas de calidad:
- No hay garantía de consistencia de estilo (tabs vs spaces, semicolons, etc.)
- No se detectan errores comunes (variables sin usar, imports incorrectos)
- No hay enforcement en CI
- Dificulta contribuciones de otros desarrolladores

**Cómo:**
```bash
pnpm add -D eslint @eslint/js globals prettier
```

```js
// eslint.config.js
import js from "@eslint/js";
import globals from "globals";

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2025,
            sourceType: "module",
            globals: { ...globals.node },
        },
        rules: {
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        },
    },
];
```

```json
// .prettierrc
{
    "useTabs": true,
    "singleQuote": false,
    "semi": true,
    "printWidth": 100
}
```

Añadir scripts al `package.json`:
```json
{
    "scripts": {
        "lint": "eslint api/",
        "format": "prettier --write .",
        "format:check": "prettier --check ."
    }
}
```

**Prioridad:** 🟡 Importante

---

### 🟡 IMPORTANTE — `package.json` con scripts vacío

**Qué:** `"scripts": {}` — no hay ningún script definido.

**Por qué:** Aunque `vercel dev` funciona, no hay convenciones documentadas en el `package.json` para que otro desarrollador sepa cómo correr el proyecto. `pnpm run dev`, `pnpm run lint`, `pnpm run test` son comandos estándar que debería tener cualquier proyecto.

**Cómo:**
```json
"scripts": {
    "dev": "vercel dev",
    "lint": "eslint api/",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
}
```

**Prioridad:** 🟡 Importante

---

### 🟡 IMPORTANTE — `.gitignore` demasiado escueto

**Qué:** El [.gitignore](file:///c:/dev/projects/cs2-lens-proxy/.gitignore) solo tiene 2 líneas:
```
.vercel
.env
```

**Por qué:** Falta `node_modules/` (cuando se añadan dependencias), archivos de IDE, archivos de OS, logs, etc.

**Cómo:**
```gitignore
# Dependencies
node_modules/

# Environment
.env
.env.local
.env.*.local

# Vercel
.vercel

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Logs
*.log
```

**Prioridad:** 🟡 Importante

---

### 🟢 NICE TO HAVE — Sin TypeScript

**Qué:** El proyecto usa JS puro sin tipado.

**Por qué:** Para un proyecto de este tamaño, JS puro es aceptable. Sin embargo, TypeScript con JSDoc sería una mejora sin coste significativo:
- Autocompletado del editor para `req.query`, `req.method`, etc.
- Detección de typos en tiempo de edición
- No requiere build step si se usa JSDoc annotations

**Cómo:** Opción ligera (sin build step):
```js
// @ts-check

/** @param {import('@vercel/node').VercelRequest} req */
/** @param {import('@vercel/node').VercelResponse} res */
export default async function handler(req, res) { ... }
```

Con `jsconfig.json`:
```json
{
    "compilerOptions": {
        "checkJs": true,
        "strict": true,
        "moduleResolution": "node"
    },
    "include": ["api/**/*.js"]
}
```

**Prioridad:** 🟢 Nice to have

---

## 5. Estructura y organización

### 🟢 NICE TO HAVE — Imports relativos profundos

**Qué:** En el handler más profundo:
```js
import { applyCors } from "../../../../../../../_lib/cors.js";
```

**Por qué:** 7 niveles de `../` es frágil y difícil de leer. Cualquier movimiento de archivo rompe el import.

**Cómo:** Vercel Serverless Functions no soporta path aliases nativamente. Opciones:
1. Migrar a un utility module en un package con imports nombrados (sobre-ingeniería para este caso).
2. Aceptar el trade-off — es inherente al file-based routing de Vercel con rutas profundas. La refactorización DRY mitiga esto parcialmente (un solo import en vez de dos).

**Prioridad:** 🟢 Nice to have (aceptable dado las restricciones de Vercel)

---

### ✅ BIEN HECHO — Estructura de carpetas alineada con el routing

La estructura `api/faceit/rankings/games/[game_id]/regions/[region].js` es exactamente lo que Vercel espera. No hay discrepancia entre la estructura de archivos y las rutas de la API. Bien.

---

## 6. HTML / Landing Page

### 🟢 NICE TO HAVE — Discrepancia en rutas de la landing page

**Qué:** En [index.html](file:///c:/dev/projects/cs2-lens-proxy/index.html) líneas 18-19, las primeras dos rutas dicen `/api/faceit/player?` (singular), pero el handler real es [players.js](file:///c:/dev/projects/cs2-lens-proxy/api/faceit/players.js) → `/api/faceit/players` (plural).

**Por qué:** Un usuario que copie la ruta de la landing page obtendrá un 404.

**Cómo:** Cambiar `player` → `players` en el HTML.

**Prioridad:** 🟢 Nice to have (la landing es informativa, no es un cliente)

---

### 🟢 NICE TO HAVE — Falta meta description y favicon

**Qué:** El `<head>` del [index.html](file:///c:/dev/projects/cs2-lens-proxy/index.html) no incluye `<meta name="description">` ni favicon.

**Prioridad:** 🟢 Nice to have

---

## 7. Documentación

### 🟢 NICE TO HAVE — README documenta URLs de FACEIT, no del proxy

**Qué:** El [README.md](file:///c:/dev/projects/cs2-lens-proxy/README.md) muestra las URLs de FACEIT (`https://open.faceit.com/data/v4/...`) en vez de las URLs del proxy (`/api/faceit/...`).

**Por qué:** Un consumidor del proxy podría confundir qué URL usar.

**Cómo:** Documentar las rutas del proxy, y mencionar que se mapean 1:1 a FACEIT.

**Prioridad:** 🟢 Nice to have

---

### 🟢 NICE TO HAVE — Typo en README

**Qué:** Línea 83: `player_id` tiene descripción "A region of a game" (copy-paste de `region`).

**Prioridad:** 🟢 Nice to have

---

### 🟢 NICE TO HAVE — Falta `.env.example`

**Qué:** No existe `.env.example` para que un nuevo contribuidor sepa qué variables necesita.

**Cómo:**
```env
# Get your API key from https://developers.faceit.com/
FACEIT_API_KEY=your_api_key_here
```

**Prioridad:** 🟢 Nice to have

---

## 8. Lo que está bien hecho

| Aspecto | Observación |
|---------|-------------|
| **Zero dependencies** | Para un proxy simple, no necesitas express, axios ni nada. `fetch` nativo + Vercel runtime es la decisión correcta. |
| **CORS whitelist estricta** | Solo 2 extension IDs hardcodeados. Bien hecho, no usa `*`. |
| **`encodeURIComponent` en params** | Todos los parámetros se encodean antes de concatenarlos a la URL. Correcto. |
| **Preflight OPTIONS handling** | `applyCors` maneja el preflight con 204 y retorna `true` para short-circuit. Limpio. |
| **Separación de `buildPlayersUrl`** | Extraer la lógica de validación a una función pura es buena práctica (aunque tiene la redundancia ya mencionada). |
| **Error forwarding** | Se reenvia el status code de FACEIT al cliente (`res.status(response.status)`), lo cual da info útil sin exponer detalles internos. |
| **Naming de archivos** | Sigue la convención Vercel correctamente con `[param].js`. |
| **Landing page** | Tener una página de documentación visual es un nice touch para un proyecto de API. |

---

## Plan de acción sugerido

### Fase 1 — Inmediata (hoy)
| # | Acción | Prioridad |
|---|--------|-----------|
| 1 | **Rotar la API key de FACEIT** y limpiar del historial de git | 🔴 Crítico |
| 2 | Crear `.env.example` | 🟢 Quick win |

### Fase 2 — Esta semana
| # | Acción | Prioridad |
|---|--------|-----------|
| 3 | Extraer `faceitFetch()` a `api/_lib/faceit-client.js` para eliminar duplicación | 🟡 Importante |
| 4 | Crear `createHandler()` wrapper para CORS + method check | 🟡 Importante |
| 5 | Simplificar `buildPlayersUrl` eliminando validación redundante | 🟡 Importante |
| 6 | Añadir `console.error(err)` en los catch blocks | 🟡 Importante |

### Fase 3 — Próximo sprint
| # | Acción | Prioridad |
|---|--------|-----------|
| 7 | Configurar ESLint + Prettier | 🟡 Importante |
| 8 | Añadir scripts a `package.json` | 🟡 Importante |
| 9 | Ampliar `.gitignore` | 🟡 Importante |
| 10 | Corregir rutas en `index.html` (singular → plural) | 🟢 Nice to have |
| 11 | Corregir typo en README | 🟢 Nice to have |
| 12 | Añadir `vercel.json` con security headers | 🟡 Importante |

### Fase 4 — Cuando escale
| # | Acción | Prioridad |
|---|--------|-----------|
| 13 | Evaluar TypeScript (o JSDoc + `@ts-check`) | 🟢 Nice to have |
| 14 | Rate limiting | 🟡 Importante |
| 15 | Validación de formato de inputs | 🟢 Nice to have |
