# Changelog

Todos los cambios relevantes de WeaVision se registran aquí. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado [SemVer](https://semver.org/lang/es/).

## [2.2.0] - 2026-11-22

### Agregado
- Inicio rediseñado como «pantalla de zapping»: el último canal aparece como un sticker gigante (número rojo que gira como paleta, logo, nombre y hace cuánto lo viste) con botones Ver ahora y Favorito. Debajo, una sola fila con pestañas Recientes, Favoritos, Categorías y Listas; al pasar por cada canal, categoría o lista, el sticker se despega y se vuelve a pegar con ella. Cabe en la pantalla de la TV sin bajar.
- Windows: flecha para volver arriba a la izquierda, antes del número de canal.
- Windows: doble clic sobre la imagen para pantalla completa y rueda del mouse para subir o bajar el volumen, con el mismo indicador que el gesto del celular.
- Windows: atajos de teclado en el reproductor: Espacio o K pausa, M silencia, F pantalla completa, P imagen en imagen, + y − volumen, L lista de canales, Re Pág / Av Pág cambian de canal y Esc sale de pantalla completa o vuelve. Cada botón muestra su atajo al pasar el mouse.

### Cambiado
- La barra de reproducción ya no tiene el botón ✕: en Android se vuelve con el gesto o botón Atrás del sistema y en Android TV con el control remoto.
- Espacio pausa o reanuda aunque haya un botón de la barra seleccionado.

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
