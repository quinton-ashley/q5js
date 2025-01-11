# q5.js Source Documentation

For modular use, the "q5-core.js" module must be loaded first.

```html
<script src="https://q5js.org/src/q5-core.js"></script>
```

These modules are included in the default "q5.js" bundle:

```html
<script src="https://q5js.org/src/q5-core.js"></script>
<script src="https://q5js.org/src/q5-canvas.js"></script>

<script src="https://q5js.org/src/q5-2d-canvas.js"></script>
<script src="https://q5js.org/src/q5-2d-drawing.js"></script>
<script src="https://q5js.org/src/q5-2d-image.js"></script>
<script src="https://q5js.org/src/q5-2d-soft-filters.js"></script>
<script src="https://q5js.org/src/q5-2d-text.js"></script>

<script src="https://q5js.org/src/q5-ai.js"></script>
<script src="https://q5js.org/src/q5-color.js"></script>
<script src="https://q5js.org/src/q5-display.js"></script>
<script src="https://q5js.org/src/q5-input.js"></script>
<script src="https://q5js.org/src/q5-math.js"></script>
<script src="https://q5js.org/src/q5-sound.js"></script>
<script src="https://q5js.org/src/q5-util.js"></script>
<script src="https://q5js.org/src/q5-vector.js"></script>

<script src="https://q5js.org/src/q5-webgpu-canvas.js"></script>
<script src="https://q5js.org/src/q5-webgpu-drawing.js"></script>
<script src="https://q5js.org/src/q5-webgpu-image.js"></script>
<script src="https://q5js.org/src/q5-webgpu-text.js"></script>
```

Additional modules:

```html
<script src="https://q5js.org/src/q5-dom.js"></script>
<script src="https://q5js.org/src/q5-noisier.js"></script>
<script src="https://q5js.org/src/q5-sensors.js"></script>
```

# Module Info

- [q5.js Source Documentation](#q5js-source-documentation)
- [Module Info](#module-info)
  - [q5-core](#q5-core)
  - [q5-canvas](#q5-canvas)
  - [q2d-canvas](#q2d-canvas)
  - [q5-q2d-drawing](#q5-q2d-drawing)
  - [q5-q2d-image](#q5-q2d-image)
  - [q5-q2d-soft-filters](#q5-q2d-soft-filters)
  - [q5-q2d-text](#q5-q2d-text)
  - [webgpu-canvas](#webgpu-canvas)
  - [webgpu-drawing](#webgpu-drawing)
  - [webgpu-image](#webgpu-image)
  - [webgpu-text](#webgpu-text)
    - [Default Font](#default-font)
    - [Create a MSDF Font](#create-a-msdf-font)
    - [Load a MSDF font](#load-a-msdf-font)
    - [Displaying Emojis](#displaying-emojis)
    - [Lightweight Use](#lightweight-use)
    - [Limitations](#limitations)
  - [math](#math)
  - [noisier](#noisier)

## q5-core

The core module provides the absolute basic functionality necessary to run q5.

It loads other modules by passing `$` (alias for `this`) and `q` (which in global mode is a proxy for `this` and `window` or `global`).

## q5-canvas

The canvas module provides shared functionality for all canvas renderers, such as adding the canvas to the DOM, resizing the canvas, setting pixel density.

## q2d-canvas

Adds Canvas2D rendering support to q5.

All other 2D modules depend on this module.

Though loading q5-color is recommend, it's not required since `fill` and `stroke` can be set to a CSS color string.

## q5-q2d-drawing

Adds Canvas2D drawing functions to q5.

## q5-q2d-image

Adds Canvas2D image support to q5.

The filters in q5-image use the [CanvasRenderingContext2D.filter](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter) property to apply native hardware-accelerated filters to images.

## q5-q2d-soft-filters

Software implementation of image filters.

This module includes additional filters not implemented in q5-image and legacy filter support for Safari which lacks `ctx.filter`.

These filters are slow. Real-time use of them is not recommended.

As of April 2024, Safari Technology Preview supports `ctx.filter` under a flag. Hopefully in the near future this module can be omitted from the default bundle.

## q5-q2d-text

Adds Canvas2D text rendering support to q5.

Image based features in this module require the q5-2d-image module.

## webgpu-canvas

> ⚠️ Experimental features! ⚠️

[WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) is the successor to WebGL. It's a modern graphics API that provides cross-platform, high-performance access to the GPU.

When you intend for a sketch to use WebGPU, but WebGPU is not supported on a viewer's browser, q5 will put a warning in the console, apply a compatibility layer, and display the sketch with the fallback q2d renderer. As of November 2024, WebGPU is only supported in Google Chrome and Edge.

To use the q5 WebGPU renderer, run `Q5.webgpu()` after the creation of any file level variables.

```js
let x = 0;
let y = 0;

Q5.webgpu();

function setup() {
	createCanvas(200, 100);
	circle(x, y, 80);
}
```

q5 WebGPU differences:

- The origin of the canvas (0, 0) is in the center, not the top left.
- The default color mode is RGB in 0-1 "float" format: `colorMode(RGB, 1)`.
- Strokes are implemented but `strokeJoin` is shimmed.
- `Q5.webgpu` is an async function, so enabling [top level global mode](https://github.com/q5js/q5.js/wiki/Top%E2%80%90Level-Global-Mode) is a bit more complex.

Note that unlike in p5's WebGL mode, mouse and touch coordinates align with canvas pixel values.

## webgpu-drawing

> Uses `colorMode(RGB, 1)` by default. Changing it to 'oklch' is not supported yet for the webgpu renderer.

q5's WebGPU renderer drawing functions like `rect` don't immediately draw on the canvas. Instead, they prepare vertex and color data to be sent to the GPU in bulk, which occurs after the user's `draw` function and any post-draw functions are run. This approach better utilizes the GPU, so it doesn't have to repeatedly wait for the CPU to send small chunks of data that describe each individual shape. It's the main reason why WebGPU is faster than Canvas2D.

Rounded rectangles, stroke modes, and functions for drawing curves are not implemented yet.

## webgpu-image

Most filters and blending modes are not implemented yet.

## webgpu-text

The q5 WebGPU text renderer uses multi-channel signed distance fields (MSDF) for high performance and high quality real-time text rendering. Text can be rapidly recolored, rotated, and scaled without any loss in quality or performance.

MSDF, introduced by Chlumsky Viktor in his master's thesis ["Shape Decomposition for Multi-channel Distance Fields" (2015)](https://dspace.cvut.cz/bitstream/handle/10467/62770/F8-DP-2015-Chlumsky-Viktor-thesis.pdf), improves upon the signed distance field (SDF) technique, popularized by Chris Green and [Valve Software](https://www.valvesoftware.com/en/) in ["Improved Alpha-Tested Magnification for Vector Textures and Special Effects" (2007)](https://steamcdn-a.akamaihd.net/apps/valve/2007/SIGGRAPH2007_AlphaTestedMagnification.pdf).

| SDF                                                                                                                  | MSDF                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ![demo-sdf16](https://user-images.githubusercontent.com/18639794/106391905-e679af00-63ef-11eb-96c3-993176330911.png) | ![demo-msdf16](https://user-images.githubusercontent.com/18639794/106391899-e37ebe80-63ef-11eb-988b-4764004bb196.png) |

### Default Font

For convenience, if no font is loaded before `text` is run, then q5's default MSDF font is loaded: https://q5js.org/fonts/sans-serif-msdf.json

![YaHei msdf texture](https://q5js.org/fonts/sans-serif.png)

This 512×512 msdf texture (207kb) was made with the [Microsoft YaHei](https://learn.microsoft.com/en-us/typography/font-list/microsoft-yahei) font and stores every character visible on a standard English keyboard, letters with diacritics (accents) used in European languages, and mathematical symbols.

```
!"#$%&'()\*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^\_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¥©®°²³´·¹º¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ‘’“”ΑαΒβΓγΔδΕεΛλΠπΣσΩω∴∵─│┌┐└┘├┤┬┴┼▀▄█▌▐▓▒░←↑→↓↔↕↖↗↘↙«»µτΦΘ∞≡±≈∙√ⁿ
```

> Do you think any other characters ought to be included in the default set? Let us know! https://github.com/q5js/q5.js/issues

### Create a MSDF Font

You can choose a custom set of characters and convert fonts to MSDF format by using the [msdf-bmfont-xml](https://msdf-bmfont.donmccurdy.com/) website, created by Don McCurdy.

### Load a MSDF font

Fonts must be in MSDF format with the file ending "-msdf.json".

```js
Q5.webgpu();

function preload() {
	loadFont('arial-msdf.json');
}

function setup() {
	createCanvas(200, 200);
}

function draw() {
	fill(0.71, 0.92, 1);
	text('Hello, World!', mouseX, mouseY);
}
```

### Displaying Emojis

Full color emoji characters can't be rendered using the MSDF technique, so draw them using `textImage`.

```js
Q5.webgpu();

function setup() {
	createCanvas(200, 200);
	textSize(100);
}

function draw() {
	textAlign(CENTER, CENTER);
	textImage('🐶', 0, 0);
}
```

You can also use `createTextImage` and display it with `textImage`.

### Lightweight Use

For super lightweight use load <https://q5js.org/fonts/YaHei-256-msdf.json>, which has a limited character set of english letters and some common punctuation symbols that completely fill in a 256×256 texture (73kb).

```
!@'",-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz
```

### Limitations

Text strokes are not supported yet, except with `textImage`.

## math

`PerlinNoise` is q5's default noise algorithm. Kevin Perlin won an Academy Award for his work on the original algorithm for the 1982 movie Tron. The JavaScript implementation of it in q5 was authored by Tezumie.

`noiseMode` enables users to switch between noise algorithms, although only "perlin" is included in q5-math.

## noisier

Adds additional noise functions to q5.

`SimplexNoise` is a simplex noise implementation in JavaScript by Tezumie. Kevin Perlin's patent on simplex noise expired in 2022. Simplex noise is slightly faster but arguably less visually appealing than perlin noise.

`BlockyNoise` is similar to p5's default `noise` function, which is a bit notorious in the gen art community for not actually being perlin noise, despite its claims to be. It looks closer to value noise but is not a standard implementation of that either. When visualized in 2d it's a bit blocky at 1 octave, hence the name. This algorithm is however, very good at outputting a variety of values from less than 3 inputs, even from a single parameter.
