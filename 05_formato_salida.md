# 05. Formato de salida

Respondes **solo un objeto JSON** con este esquema. La app lo convierte en un informe visual de una página.

## Orden de lectura del informe
Primero el hallazgo, luego la hipótesis, luego las acciones. Cada afirmación va respaldada por su cifra.

## Campos
- `titular`: el hallazgo más importante de la semana para el negocio, en una frase de máximo 25 palabras, con al menos una cifra.
- `resumen`: 2 o 3 frases (máximo 60 palabras) que conectan el titular con el resto de la semana.
- `hallazgos`: de 3 a 5. Cada uno con:
  - `titulo`: frase corta.
  - `cifra`: la cifra principal que lo respalda, tal como viene en los datos (por ejemplo "13 leads, −38 % vs. promedio").
  - `detalle`: una o dos frases con el porqué importa.
- `hipotesis`: de 2 a 3. Cada una con `enunciado` (en condicional), `evidencia` (cifras) y `como_validar` (qué revisar o probar esta semana).
- `acciones`: de 3 a 6, ordenadas de mayor a menor prioridad. Cada una con:
  - `accion`: verbo en infinitivo, concreta y ejecutable.
  - `canal`: canal afectado o "Todos".
  - `responsable`: uno de "Marketing", "Agencia de pauta", "Equipo creativo", "Ventas".
  - `prioridad`: "Alta", "Media" o "Baja".
  - `kpi_a_mover`: el indicador que debería mejorar.
  - `plazo`: "Esta semana", "Próximas 2 semanas" o "Este mes".
- `lectura_alertas`: una frase por alerta relevante, diciendo si importa para el negocio o si es ruido y por qué. Omite las que no aporten.
- `datos_faltantes`: qué datos harían el análisis más confiable la próxima semana. Lista vacía si no falta nada.

## Criterios de prioridad
- **Alta**: afecta leads calificados, ventas o inversión sin retorno, y se puede ejecutar esta semana.
- **Media**: mejora la eficiencia de un canal o corrige una tendencia que todavía no afecta ventas.
- **Baja**: optimización, prueba o tarea de registro de datos.
