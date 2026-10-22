# Radar semanal

Agente de IA que convierte la revisión semanal de redes (Instagram, Stories, TikTok, YouTube y LinkedIn) en un informe ejecutivo de una página: qué canal genera leads y ventas, qué cambió, por qué podría haber cambiado y qué hacer, con prioridad Alta, Media o Baja.

Funciona en el navegador con HTML y JavaScript, usa la API gratuita de Gemini y se publica en GitHub Pages. No necesita servidor propio ni instalar nada.

> Nota: la consigna menciona "java"; para un agente en HTML publicado en GitHub Pages el lenguaje correcto es **JavaScript**, que es el que usa este proyecto.

## Qué hace

1. Lees tu Excel o CSV semanal (una fila por semana, canal y tipo orgánico o pauta).
2. La app **calcula** los indicadores, compara contra la semana anterior y el promedio de 4 semanas, y detecta alertas con reglas.
3. Gemini **interpreta** esas cifras siguiendo las instrucciones de la carpeta `contexto/` y devuelve hallazgos, hipótesis y acciones.
4. Exportas: PDF de una página, tablas listas para pegar en Excel y CSV de acciones.

## Cómo se refactorizó la idea original

| Idea original | Cómo quedó | Por qué |
|---|---|---|
| Que el agente calcule los KPI | El **código** calcula; la IA solo interpreta | Elimina el riesgo de cifras inventadas o mal sumadas |
| Un prompt largo | Instrucciones **modulares** en `contexto/` (rol, conocimiento, KPI, reglas, formato, datos) | Se edita cada parte sin romper las demás |
| Informe en texto libre | **Salida JSON con esquema** que la app convierte en informe visual | El formato siempre es el mismo y se puede exportar |
| Alertas a criterio de la IA | **Alertas por reglas** con umbrales editables en `js/config.js` | Son predecibles y auditables; la IA solo dice cuáles importan |
| "No inventes datos" | Reglas explícitas + cifras precalculadas + `datos_faltantes` | El agente dice qué le falta en vez de suponer |
| Datos de clientes | Solo cifras agregadas; las notas se tratan como datos, no instrucciones | Privacidad y protección contra instrucciones escondidas |

## Estructura

```
radar-semanal/
├── index.html                 Interfaz
├── css/styles.css             Estilos (claro, oscuro e impresión)
├── js/
│   ├── config.js              Modelo, umbrales de alertas y canales (edítalo aquí)
│   ├── data.js                Lectura del Excel/CSV y normalización de columnas
│   ├── kpis.js                Cálculo de KPI, comparaciones y alertas
│   ├── gemini.js              Llamada a la API de Gemini con esquema JSON
│   ├── report.js              Informe visual y exportaciones
│   ├── format.js              Formatos colombianos (1.234; 12,5 %; $ 1.650.000)
│   └── app.js                 Orquesta todo
├── contexto/                  Instrucciones del agente (el "cerebro")
│   ├── 01_rol.md
│   ├── 02_marketing_estrategico.md
│   ├── 03_kpis.md
│   ├── 04_reglas.md
│   ├── 05_formato_salida.md
│   └── 06_diccionario_datos.md
└── datos/
    └── ejemplo_semanas.csv    Datos ficticios para probar
```

## Puesta en marcha

### 1. Clave gratuita de Gemini
Entra a [Google AI Studio](https://aistudio.google.com/apikey), inicia sesión con tu cuenta de Google y crea una clave. La pegas en la app cada vez que la uses (o marcas "Recordarla mientras esta pestaña esté abierta").

**Nunca subas la clave al repositorio.** La app no la guarda en ningún archivo.

### 2. Publicar en GitHub Pages
1. Crea un repositorio nuevo en GitHub (por ejemplo `radar-semanal`).
2. Sube todo el contenido de esta carpeta (botón *Add file > Upload files*).
3. Ve a *Settings > Pages*, en *Source* elige *Deploy from a branch*, rama `main`, carpeta `/ (root)` y guarda.
4. En uno o dos minutos la app queda en `https://TU-USUARIO.github.io/radar-semanal/`.

### 3. Probarla en tu computador (opcional)
Abrir `index.html` con doble clic **no funciona**: el navegador bloquea la lectura de la carpeta `contexto/`. Usa un servidor local desde la carpeta del proyecto:

```bash
python -m http.server 8000
# luego abre http://localhost:8000
```

O la extensión *Live Server* de VS Code.

## Cómo preparar el archivo semanal

Una fila por **semana + canal + tipo**. Obligatorias: `semana`, `canal`, `alcance`, `leads`. Todas las columnas están descritas en `contexto/06_diccionario_datos.md`; mira `datos/ejemplo_semanas.csv` como plantilla.

Entre más columnas llenes (leads calificados, citas, cotizaciones, ventas, inversión), más útil es el informe. Si falta algo, el informe lo dice en "Datos que faltan".

Para que el promedio de 4 semanas funcione, incluye en el mismo archivo al menos las 5 últimas semanas.

## Personalizar

- **Umbrales de alerta, canales y modelo**: `js/config.js`.
- **Comportamiento del agente**: edita los archivos de `contexto/`. Por ejemplo, para cambiar el tono, `01_rol.md` y `04_reglas.md`; para pedir más o menos acciones, `05_formato_salida.md`.
- **Modelo**: por defecto `gemini-2.5-flash`. Si Google cambia los modelos del nivel gratuito, escribe el nuevo nombre en el campo *Modelo* de la app o en `config.js`.

## Privacidad y límites

- En el nivel gratuito, Google puede usar lo que envías para mejorar sus productos. Por eso la app solo envía **cifras agregadas** y tus notas de contexto: no incluyas nombres, teléfonos ni correos de clientes.
- El nivel gratuito tiene límites de uso por minuto y por día. Si aparece el aviso de límite, espera un minuto.
- La interpretación es una propuesta: las decisiones de presupuesto y estrategia son tuyas.
