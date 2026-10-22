# 06. Diccionario de datos del archivo semanal

Una fila por **semana + canal + tipo** (orgánico o pauta). La primera fila del Excel o CSV son los encabezados. Mayúsculas, tildes y espacios no importan.

| Columna | Obligatoria | Qué es | Ejemplo |
|---|---|---|---|
| semana | Sí | Fecha de inicio de la semana (AAAA-MM-DD o DD/MM/AAAA) | 2026-10-12 |
| canal | Sí | Instagram, Stories, TikTok, YouTube, LinkedIn | TikTok |
| tipo | No | organico o pauta | pauta |
| inversion | No | Inversión en pauta de la semana, en pesos | 1650000 |
| alcance | Sí | Cuentas alcanzadas | 46000 |
| impresiones | No | Veces que se mostró el contenido | 73600 |
| interacciones | No | Me gusta, comentarios, guardados, compartidos | 3900 |
| clics | No | Clics al enlace, perfil o botón | 240 |
| leads | Sí | Leads atribuidos a ese canal (UTM, "¿cómo nos conociste?" o etiqueta de WhatsApp) | 4 |
| leads_calificados | No | Leads con perfil de proyecto o presupuesto | 1 |
| citas | No | Citas o reuniones agendadas | 0 |
| cotizaciones | No | Cotizaciones enviadas | 0 |
| ventas | No | Ventas cerradas | 0 |
| valor_ventas | No | Valor de las ventas, en pesos | 0 |
| conversaciones | No | Conversaciones por mensajes directos o WhatsApp | 15 |
| tiempo_respuesta_horas | No | Tiempo promedio de primera respuesta | 4 |
| meta_leads | No | Meta semanal de leads para ese canal | 6 |
| notas | No | Contexto: lanzamientos, festivos, cambios de pauta | Video de antes y después |

No incluyas nombres, teléfonos ni correos de clientes en el archivo.
