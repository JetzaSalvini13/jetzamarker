# JetzaBoard — gestión de clientes para social media

App web para organizar clientes de community management, social media, edición de video/posts y estrategia de contenido.
Se publica junto al portfolio en `/app` (ver `vercel.json`). En local: `npm run dev` y abrir `http://localhost:4173/app/`.

## Módulos
- **Inicio**: KPIs (clientes activos, posts del mes, para aprobar, ingreso estimado), próximos 7 días y tareas.
- **Clientes**: ficha con contacto, redes, servicios contratados y fee. Cada cliente tiene:
  - **Resumen** e **identidad de marca** (público, tono de voz, diferenciales, sí/no, paleta, tipografías, Drive).
  - **Proyectos y tareas**: proyectos separados (gestión mensual, campañas, ediciones…) + tablero kanban.
  - **Estrategia**: objetivo, buyer persona, pilares con % (plan vs. real del mes), FODA, KPIs, embudo.
  - **Competencia**: competidores/referentes, comparación de seguidores, link a la Biblioteca de anuncios de Meta.
  - **Ideas**: banco de ideas con estados; “Pasar al calendario” crea la publicación.
  - **Planificación**: calendario mensual con arrastrar y soltar, vista lista, vista feed de Instagram, export CSV y grilla imprimible para aprobación del cliente.
  - **Copys**: fórmulas (AIDA, PAS, storytelling…), banco de ganchos y CTAs, sets de hashtags, contador por red, copys guardados.
  - **Banco de medios**: imágenes y reels (guardados en el navegador con IndexedDB), filtros por tipo/proyecto/etiqueta, adjuntables a publicaciones.
  - **Análisis de contenido**: métricas por publicación, engagement rate, top 5, ER por formato; importación desde Instagram.
  - **Métricas y Meta Ads**: métricas mensuales con gráficos y crecimiento; gasto, alcance, clics, CTR, CPC, CPM, resultados y campañas desde la API de Marketing de Meta.
- **Calendario general** y **Tareas** de todos los clientes.
- **IA opcional (Claude)**: copys en 3 opciones, ideas, análisis de competencia, “qué está funcionando”, estrategia e informe mensual.

## Datos
Todo se guarda en el navegador (localStorage + IndexedDB). Usá **Ajustes → Exportar respaldo** seguido.
Los tokens de Meta y la API key de Claude también quedan solo en este navegador.
