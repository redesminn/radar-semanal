// Configuración editable del agente. Cambia aquí el modelo, los umbrales de alerta o los canales.
export const CONFIG = {
  // Modelo del nivel gratuito de la API de Gemini. Si Google lo cambia, actualízalo aquí o en la app.
  modelo: 'gemini-2.5-flash',
  temperatura: 0.2,

  // Archivos que forman las instrucciones del agente (se cargan en este orden).
  archivosContexto: [
    '01_rol.md',
    '02_marketing_estrategico.md',
    '03_kpis.md',
    '04_reglas.md',
    '05_formato_salida.md',
    '06_diccionario_datos.md',
  ],

  canalesEsperados: ['Instagram', 'Stories', 'TikTok', 'YouTube', 'LinkedIn'],

  // Umbrales de las alertas automáticas (fracciones: -0.25 = -25 %).
  umbrales: {
    caidaFuerte: -0.25,     // leads, conversión o interacción
    subidaFuerte: 0.3,      // alerta positiva de leads
    subidaAlcance: 0.2,     // alcance que sube...
    caidaEficiencia: -0.2,  // ...mientras bajan los leads por cada 1.000
    subidaCosto: 0.25,      // costo por lead
    subidaRespuesta: 0.5,   // tiempo de respuesta
    cumplimientoMeta: 0.8,  // menos del 80 % de la meta
    minimoBase: 3,          // base mínima para comparar porcentajes
  },
};
