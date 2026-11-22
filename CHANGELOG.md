# Changelog

Todos los cambios relevantes de WeaVision se registran aquí. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado [SemVer](https://semver.org/lang/es/).

## [2.1.0] - 2026-11-22

### Agregado
- Lista de canales en dos niveles dentro del reproductor: primero las categorías (con la del canal en pantalla marcada) y luego sus canales, con botón para volver y para cerrar. Siempre entra desde la izquierda, con transiciones entre niveles.
- Android (celular): deslizar hacia arriba o abajo en la mitad derecha de la pantalla cambia el volumen y en la mitad izquierda el brillo, con un indicador animado.
- Botón de imagen en imagen junto al de canal siguiente (Android, Android TV compatibles y Windows).
- Control remoto en la lista: Derecha abre la categoría, Izquierda vuelve a las categorías, Atrás sube un nivel.

### Cambiado
- El botón de lista de canales pasa a la barra de reproducción, a la izquierda de canal anterior; el de favoritos ocupa su lugar arriba a la derecha.
- Android TV y Android (celular) ya no muestran control de volumen en la barra: se usa el del control remoto, los botones del equipo o el gesto.
- Android TV usa siempre el brillo máximo de la pantalla.

### Corregido
- Al abrir «En vivo» (o la pantalla de bienvenida) ya no se enfoca solo el campo de búsqueda ni se abre el teclado; en la TV el teclado aparece solo al presionar OK sobre el campo.

## [2.0.0] - 2026-11-22

### Agregado
- WeaVision 2.0: reproductor IPTV para Windows, Android, Android TV y Android Auto.
