# Avisos de terceros

`src/ui/fx.ts` incluye adaptaciones (sin React) de componentes de estos proyectos.

## KokonutUI — Split Flap Text, Smooth Tab, Hold Button, Promise Toast

```
MIT License

Copyright (c) 2025 kokonutUI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Bklit UI — Bar Chart, Shimmering Text

```
MIT License

Copyright (c) 2026 uixmat

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## FFmpeg (solo en la versión de Windows)

El instalador de Windows incluye `ffmpeg.exe` (FFmpeg 6.0, build "essentials" de gyan.dev, distribuido por el paquete
[`ffmpeg-static`](https://github.com/eugeneware/ffmpeg-static)). WeaVision lo ejecuta como un programa aparte para
reempaquetar o convertir los canales que Chromium no puede decodificar (audio MP2/AC-3/E-AC-3, canales sin audio,
video entrelazado). Este build de FFmpeg se distribuye bajo la **GNU GPL v3**; su licencia completa se instala junto a
la app como `resources/ffmpeg-LICENSE.txt` y el código fuente está en <https://ffmpeg.org/download.html> y
<https://www.gyan.dev/ffmpeg/builds/>.
