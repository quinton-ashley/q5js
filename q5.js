/**
 * q5.js
 * @version 2.14
 * @author quinton-ashley, Tezumie, and LingDong-
 * @license LGPL-3.0
 * @class Q5
 */
function Q5(scope, parent, renderer) {
	let $ = this;
	$._q5 = true;
	$._parent = parent;
	if (renderer == 'webgpu-fallback') {
		$._webgpuFallback = true;
		$._renderer = 'q2d';
	} else {
		$._renderer = renderer || Q5.render;
	}
	$._preloadCount = 0;

	let autoLoaded = scope == 'auto';
	scope ??= 'global';
	if (scope == 'auto') {
		if (!(window.setup || window.update || window.draw)) return;
		scope = 'global';
	}
	$._scope = scope;
	let globalScope;
	if (scope == 'global') {
		Q5._hasGlobal = $._isGlobal = true;
		globalScope = Q5._esm ? globalThis : !Q5._server ? window : global;
	}

	let q = new Proxy($, {
		set: (t, p, v) => {
			$[p] = v;
			if ($._isGlobal) globalScope[p] = v;
			return true;
		}
	});

	$.canvas = $.ctx = $.drawingContext = null;
	$.pixels = [];
	let looper = null;

	$.frameCount = 0;
	$.deltaTime = 16;
	$._targetFrameRate = 0;
	$._targetFrameDuration = 16.666666666666668;
	$._frameRate = $._fps = 60;
	$._loop = true;
	$._hooks = {
		postCanvas: [],
		preRender: [],
		postRender: []
	};

	let millisStart = 0;
	$.millis = () => performance.now() - millisStart;

	$.noCanvas = () => {
		if ($.canvas?.remove) $.canvas.remove();
		$.canvas = 0;
		q.ctx = q.drawingContext = 0;
	};

	if (window) {
		$.windowWidth = window.innerWidth;
		$.windowHeight = window.innerHeight;
		$.deviceOrientation = window.screen?.orientation?.type;
	}

	$._incrementPreload = () => q._preloadCount++;
	$._decrementPreload = () => q._preloadCount--;

	$._draw = (timestamp) => {
		let ts = timestamp || performance.now();
		$._lastFrameTime ??= ts - $._targetFrameDuration;

		if ($._didResize) {
			$.windowResized();
			$._didResize = false;
		}

		if ($._loop) looper = raf($._draw);
		else if ($.frameCount && !$._redraw) return;

		if (looper && $.frameCount) {
			let time_since_last = ts - $._lastFrameTime;
			if (time_since_last < $._targetFrameDuration - 4) return;
		}
		q.deltaTime = ts - $._lastFrameTime;
		$._frameRate = 1000 / $.deltaTime;
		q.frameCount++;
		let pre = performance.now();
		$.resetMatrix();
		if ($._beginRender) $._beginRender();
		for (let m of Q5.methods.pre) m.call($);
		try {
			$.draw();
		} catch (e) {
			if (!Q5.disableFriendlyErrors && $._askAI) $._askAI(e);
			if (!Q5.errorTolerant) $.noLoop();
			throw e;
		}
		for (let m of Q5.methods.post) m.call($);
		if ($._render) $._render();
		if ($._finishRender) $._finishRender();
		$.postProcess();
		q.pmouseX = $.mouseX;
		q.pmouseY = $.mouseY;
		q.moveX = q.moveY = 0;
		$._lastFrameTime = ts;
		let post = performance.now();
		$._fps = Math.round(1000 / (post - pre));
	};
	$.noLoop = () => {
		$._loop = false;
		looper = null;
	};
	$.loop = () => {
		$._loop = true;
		if ($._setupDone && looper == null) $._draw();
	};
	$.isLooping = () => $._loop;
	$.redraw = (n = 1) => {
		$._redraw = true;
		for (let i = 0; i < n; i++) {
			$._draw();
		}
		$._redraw = false;
	};
	$.remove = () => {
		$.noLoop();
		$.canvas.remove();
	};

	$.frameRate = (hz) => {
		if (hz) {
			$._targetFrameRate = hz;
			$._targetFrameDuration = 1000 / hz;
		}
		return $._frameRate;
	};
	$.getTargetFrameRate = () => $._targetFrameRate || 60;
	$.getFPS = () => $._fps;

	// shims for compatibility with p5.js libraries
	$.Element = function (a) {
		this.elt = a;
	};
	$._elements = [];
	$.describe = () => {};

	$.TWO_PI = $.TAU = Math.PI * 2;

	$.log = $.print = console.log;

	for (let m in Q5.modules) {
		Q5.modules[m]($, q);
	}

	let r = Q5.renderers[$._renderer];
	for (let m in r) {
		r[m]($, q);
	}

	// INIT

	for (let k in Q5) {
		if (k[1] != '_' && k[1] == k[1].toUpperCase()) {
			$[k] = Q5[k];
		}
	}

	if (scope == 'graphics') return;

	if (scope == 'global') {
		Object.assign(Q5, $);
		delete Q5.Q5;
	}

	if ($._webgpuFallback) $.colorMode('rgb', 1);

	for (let m of Q5.methods.init) {
		m.call($);
	}

	for (let [n, fn] of Object.entries(Q5.prototype)) {
		if (n[0] != '_' && typeof $[n] == 'function') $[n] = fn.bind($);
	}

	if (scope == 'global') {
		let props = Object.getOwnPropertyNames($);
		for (let p of props) {
			if (p[0] != '_') globalScope[p] = $[p];
		}
	}

	if (typeof scope == 'function') scope($);

	Q5._instanceCount++;

	let raf =
		window.requestAnimationFrame ||
		function (cb) {
			const idealFrameTime = $._lastFrameTime + $._targetFrameDuration;
			return setTimeout(() => {
				cb(idealFrameTime);
			}, idealFrameTime - performance.now());
		};

	let t = globalScope || $;
	$._isTouchAware = t.touchStarted || t.touchMoved || t.mouseReleased;

	if ($._isGlobal) {
		$.preload = t.preload;
		$.setup = t.setup;
		$.draw = t.draw;
		$.postProcess = t.postProcess;
	}
	$.preload ??= () => {};
	$.setup ??= () => {};
	$.draw ??= () => {};
	$.postProcess ??= () => {};

	let userFns = [
		'mouseMoved',
		'mousePressed',
		'mouseReleased',
		'mouseDragged',
		'mouseClicked',
		'mouseWheel',
		'keyPressed',
		'keyReleased',
		'keyTyped',
		'touchStarted',
		'touchMoved',
		'touchEnded',
		'windowResized'
	];
	for (let k of userFns) {
		if (!t[k]) $[k] = () => {};
		else if ($._isGlobal) {
			$[k] = (event) => {
				try {
					return t[k](event);
				} catch (e) {
					if ($._askAI) $._askAI(e);
					throw e;
				}
			};
		}
	}

	async function _setup() {
		$._startDone = true;
		if ($._preloadCount > 0) return raf(_setup);
		millisStart = performance.now();
		await $.setup();
		$._setupDone = true;
		if ($.frameCount) return;
		if ($.ctx === null) $.createCanvas(200, 200);
		raf($._draw);
	}

	function _start() {
		try {
			$.preload();
			if (!$._startDone) _setup();
		} catch (e) {
			if ($._askAI) $._askAI(e);
			throw e;
		}
	}

	if (autoLoaded) _start();
	else setTimeout(_start, 32);
}

Q5.render = 'q2d';

Q5.renderers = {};
Q5.modules = {};

Q5._server = typeof process == 'object';
Q5._esm = this === undefined;

Q5._instanceCount = 0;
Q5._friendlyError = (msg, func) => {
	if (!Q5.disableFriendlyErrors) console.error(func + ': ' + msg);
};
Q5._validateParameters = () => true;

Q5.methods = {
	init: [],
	pre: [],
	post: [],
	remove: []
};
Q5.prototype.registerMethod = (m, fn) => Q5.methods[m].push(fn);
Q5.prototype.registerPreloadMethod = (n, fn) => (Q5.prototype[n] = fn[n]);

if (Q5._server) global.p5 ??= global.Q5 = Q5;

if (typeof window == 'object') window.p5 ??= window.Q5 = Q5;
else global.window = 0;

function createCanvas(w, h, opt) {
	if (!Q5._hasGlobal) {
		let q = new Q5();
		q.createCanvas(w, h, opt);
	}
}

Q5.version = Q5.VERSION = '2.14';

if (typeof document == 'object') {
	document.addEventListener('DOMContentLoaded', () => {
		if (!Q5._hasGlobal) new Q5('auto');
	});
}
Q5.modules.canvas = ($, q) => {
	$._OffscreenCanvas =
		window.OffscreenCanvas ||
		function () {
			return document.createElement('canvas');
		};

	if (Q5._server) {
		if (Q5._createServerCanvas) {
			q.canvas = Q5._createServerCanvas(100, 100);
		}
	} else if ($._scope == 'image' || $._scope == 'graphics') {
		q.canvas = new $._OffscreenCanvas(100, 100);
	}

	if (!$.canvas) {
		if (typeof document == 'object') {
			q.canvas = document.createElement('canvas');
			$.canvas.id = 'q5Canvas' + Q5._instanceCount;
			$.canvas.classList.add('q5Canvas');
		} else $.noCanvas();
	}

	let c = $.canvas;
	$.width = 200;
	$.height = 200;
	$._pixelDensity = 1;

	$.displayDensity = () => window.devicePixelRatio || 1;

	if (c) {
		c.width = 200;
		c.height = 200;
		if ($._scope != 'image') {
			c.renderer = $._renderer;
			c[$._renderer] = true;

			$._pixelDensity = Math.ceil($.displayDensity());
		}
	}

	$._adjustDisplay = () => {
		if (c.style) {
			c.style.width = c.w + 'px';
			c.style.height = c.h + 'px';
		}
	};

	$.createCanvas = function (w, h, options) {
		if (typeof w == 'object') {
			options = w;
			w = null;
		}
		options ??= arguments[3];

		let opt = Object.assign({}, Q5.canvasOptions);
		if (typeof options == 'object') Object.assign(opt, options);

		if ($._scope != 'image') {
			if ($._scope == 'graphics') $._pixelDensity = this._pixelDensity;
			else if (window.IntersectionObserver) {
				let wasObserved = false;
				new IntersectionObserver((e) => {
					c.visible = e[0].isIntersecting;
					if (!wasObserved) {
						$._wasLooping = $._loop;
						wasObserved = true;
					}
					if (c.visible) {
						if ($._wasLooping && !$._loop) $.loop();
					} else {
						$._wasLooping = $._loop;
						$.noLoop();
					}
				}).observe(c);
			}
		}

		$._setCanvasSize(w, h);

		Object.assign(c, opt);
		let rend = $._createCanvas(c.w, c.h, opt);

		if ($._hooks) {
			for (let m of $._hooks.postCanvas) m();
		}
		if ($._beginRender) $._beginRender();

		return rend;
	};

	$.createGraphics = function (w, h, opt) {
		let g = new Q5('graphics');
		opt ??= {};
		opt.alpha ??= true;
		opt.colorSpace ??= $.canvas.colorSpace;
		g.createCanvas.call($, w, h, opt);
		g.defaultWidth = w;
		g.defaultHeight = h;
		return g;
	};

	async function saveFile(data, name, ext) {
		name = name || 'untitled';
		ext = ext || 'png';
		if (ext == 'jpg' || ext == 'png' || ext == 'webp') {
			if (data instanceof OffscreenCanvas) {
				const blob = await data.convertToBlob({ type: 'image/' + ext });
				data = await new Promise((resolve) => {
					const reader = new FileReader();
					reader.onloadend = () => resolve(reader.result);
					reader.readAsDataURL(blob);
				});
			} else {
				data = data.toDataURL('image/' + ext);
			}
		} else {
			let type = 'text/plain';
			if (ext == 'json') {
				if (typeof data != 'string') data = JSON.stringify(data);
				type = 'text/json';
			}
			data = new Blob([data], { type });
			data = URL.createObjectURL(data);
		}
		let a = document.createElement('a');
		a.href = data;
		a.download = name + '.' + ext;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	$.save = (a, b, c) => {
		if (!a || (typeof a == 'string' && (!b || (!c && b.length < 5)))) {
			c = b;
			b = a;
			a = $.canvas;
		}
		if (c) return saveFile(a, b, c);
		if (b) {
			b = b.split('.');
			saveFile(a, b[0], b.at(-1));
		} else saveFile(a);
	};

	$._setCanvasSize = (w, h) => {
		w ??= window.innerWidth;
		h ??= window.innerHeight;
		$.defaultWidth = c.w = w = Math.ceil(w);
		$.defaultHeight = c.h = h = Math.ceil(h);
		c.hw = w / 2;
		c.hh = h / 2;

		// changes the actual size of the canvas
		c.width = Math.ceil(w * $._pixelDensity);
		c.height = Math.ceil(h * $._pixelDensity);

		if (!$._da) {
			q.width = w;
			q.height = h;
		} else $.flexibleCanvas($._dau);

		if ($.displayMode && !c.displayMode) $.displayMode();
		else $._adjustDisplay();
	};

	$._setImageSize = (w, h) => {
		q.width = c.w = w;
		q.height = c.h = h;
		c.hw = w / 2;
		c.hh = h / 2;

		// changes the actual size of the canvas
		c.width = Math.ceil(w * $._pixelDensity);
		c.height = Math.ceil(h * $._pixelDensity);
	};

	$.defaultImageScale = (scale) => {
		if (!scale) return $._defaultImageScale;
		return ($._defaultImageScale = scale);
	};
	$.defaultImageScale(0.5);

	if ($._scope == 'image') return;

	if (c && $._scope != 'graphics') {
		c.parent = (el) => {
			if (c.parentElement) c.parentElement.removeChild(c);

			if (typeof el == 'string') el = document.getElementById(el);
			el.append(c);

			function parentResized() {
				if ($.frameCount > 1) {
					$._didResize = true;
					$._adjustDisplay();
				}
			}
			if (typeof ResizeObserver == 'function') {
				if ($._ro) $._ro.disconnect();
				$._ro = new ResizeObserver(parentResized);
				$._ro.observe(el);
			} else if (!$.frameCount) {
				window.addEventListener('resize', parentResized);
			}
		};

		function addCanvas() {
			let el = $._parent;
			el ??= document.getElementsByTagName('main')[0];
			if (!el) {
				el = document.createElement('main');
				document.body.append(el);
			}
			c.parent(el);
		}
		if (document.body) addCanvas();
		else document.addEventListener('DOMContentLoaded', addCanvas);
	}

	$.resizeCanvas = (w, h) => {
		if (!$.ctx) return $.createCanvas(w, h);
		if (w == c.w && h == c.h) return;

		$._resizeCanvas(w, h);
	};

	if (c && !Q5._createServerCanvas) {
		c.resize = $.resizeCanvas;
		c.save = $.saveCanvas = $.save;
	}

	$.pixelDensity = (v) => {
		if (!v || v == $._pixelDensity) return $._pixelDensity;
		$._pixelDensity = v;
		$._setCanvasSize(c.w, c.h);
		return v;
	};

	$.flexibleCanvas = (unit = 400) => {
		if (unit) {
			$._da = c.width / (unit * $._pixelDensity);
			q.width = $._dau = unit;
			q.height = (c.h / c.w) * unit;
		} else $._da = 0;
	};

	$._styleNames = [
		'_fill',
		'_stroke',
		'_strokeWeight',
		'_doStroke',
		'_doFill',
		'_strokeSet',
		'_fillSet',
		'_shadow',
		'_doShadow',
		'_shadowOffsetX',
		'_shadowOffsetY',
		'_shadowBlur',
		'_tint',
		'_imageMode',
		'_rectMode',
		'_ellipseMode',
		'_textSize',
		'_textAlign',
		'_textBaseline'
	];
	$._styles = [];

	$.pushStyles = () => {
		let styles = {};
		for (let s of $._styleNames) styles[s] = $[s];
		$._styles.push(styles);
	};
	$.popStyles = () => {
		let styles = $._styles.pop();
		for (let s of $._styleNames) $[s] = styles[s];
	};

	if (window && $._scope != 'graphics') {
		window.addEventListener('resize', () => {
			$._didResize = true;
			q.windowWidth = window.innerWidth;
			q.windowHeight = window.innerHeight;
			q.deviceOrientation = window.screen?.orientation?.type;
		});
	}
};

Q5.CENTER = 'center';
Q5.LEFT = 'left';
Q5.RIGHT = 'right';
Q5.TOP = 'top';
Q5.BOTTOM = 'bottom';

Q5.BASELINE = 'alphabetic';
Q5.MIDDLE = 'middle';

Q5.NORMAL = 'normal';
Q5.ITALIC = 'italic';
Q5.BOLD = 'bold';
Q5.BOLDITALIC = 'italic bold';

Q5.ROUND = 'round';
Q5.SQUARE = 'butt';
Q5.PROJECT = 'square';
Q5.MITER = 'miter';
Q5.BEVEL = 'bevel';

Q5.CHORD_OPEN = 0;
Q5.PIE_OPEN = 1;
Q5.PIE = 2;
Q5.CHORD = 3;

Q5.RADIUS = 'radius';
Q5.CORNER = 'corner';
Q5.CORNERS = 'corners';

Q5.OPEN = 0;
Q5.CLOSE = 1;

Q5.LANDSCAPE = 'landscape';
Q5.PORTRAIT = 'portrait';

Q5.BLEND = 'source-over';
Q5.REMOVE = 'destination-out';
Q5.ADD = 'lighter';
Q5.DARKEST = 'darken';
Q5.LIGHTEST = 'lighten';
Q5.DIFFERENCE = 'difference';
Q5.SUBTRACT = 'subtract';
Q5.EXCLUSION = 'exclusion';
Q5.MULTIPLY = 'multiply';
Q5.SCREEN = 'screen';
Q5.REPLACE = 'copy';
Q5.OVERLAY = 'overlay';
Q5.HARD_LIGHT = 'hard-light';
Q5.SOFT_LIGHT = 'soft-light';
Q5.DODGE = 'color-dodge';
Q5.BURN = 'color-burn';

Q5.THRESHOLD = 1;
Q5.GRAY = 2;
Q5.OPAQUE = 3;
Q5.INVERT = 4;
Q5.POSTERIZE = 5;
Q5.DILATE = 6;
Q5.ERODE = 7;
Q5.BLUR = 8;
Q5.SEPIA = 9;
Q5.BRIGHTNESS = 10;
Q5.SATURATION = 11;
Q5.CONTRAST = 12;
Q5.HUE_ROTATE = 13;

Q5.P2D = '2d';
Q5.WEBGL = 'webgl';

Q5.canvasOptions = {
	alpha: false,
	colorSpace: 'display-p3'
};

if (!window.matchMedia || !matchMedia('(dynamic-range: high) and (color-gamut: p3)').matches) {
	Q5.canvasOptions.colorSpace = 'srgb';
} else Q5.supportsHDR = true;
Q5.renderers.q2d = {};

Q5.renderers.q2d.canvas = ($, q) => {
	let c = $.canvas;

	if ($.colorMode) {
		$.colorMode(Q5.canvasOptions.colorSpace != 'srgb' ? 'rgb' : 'srgb', 255);
	}

	$._createCanvas = function (w, h, options) {
		if (!c) {
			console.error('q5 canvas could not be created. skia-canvas and jsdom packages not found.');
			return;
		}
		q.ctx = q.drawingContext = c.getContext('2d', options);

		if ($._scope != 'image') {
			// default styles
			$.ctx.fillStyle = $._fill = 'white';
			$.ctx.strokeStyle = $._stroke = 'black';
			$.ctx.lineCap = 'round';
			$.ctx.lineJoin = 'miter';
			$.ctx.textAlign = 'left';
			$._strokeWeight = 1;
		}
		$.ctx.scale($._pixelDensity, $._pixelDensity);
		$.ctx.save();
		return c;
	};

	$.clear = () => {
		$.ctx.save();
		$.ctx.resetTransform();
		$.ctx.clearRect(0, 0, $.canvas.width, $.canvas.height);
		$.ctx.restore();
	};

	if ($._scope == 'image') return;

	$._resizeCanvas = (w, h) => {
		let t = {};
		for (let prop in $.ctx) {
			if (typeof $.ctx[prop] != 'function') t[prop] = $.ctx[prop];
		}
		delete t.canvas;

		let o;
		if ($.frameCount > 1) {
			o = new $._OffscreenCanvas(c.width, c.height);
			o.w = c.w;
			o.h = c.h;
			let oCtx = o.getContext('2d');
			oCtx.drawImage(c, 0, 0);
		}

		$._setCanvasSize(w, h);

		for (let prop in t) $.ctx[prop] = t[prop];
		$.scale($._pixelDensity);

		if (o) $.ctx.drawImage(o, 0, 0, o.w, o.h);
	};

	$.fill = function (c) {
		$._doFill = $._fillSet = true;
		if (Q5.Color) {
			if (!c._q5Color) {
				if (typeof c != 'string') c = $.color(...arguments);
				else if ($._namedColors[c]) c = $.color(...$._namedColors[c]);
			}
			if (c.a <= 0) return ($._doFill = false);
		}
		$.ctx.fillStyle = $._fill = c.toString();
	};

	$.stroke = function (c) {
		$._doStroke = $._strokeSet = true;
		if (Q5.Color) {
			if (!c._q5Color) {
				if (typeof c != 'string') c = $.color(...arguments);
				else if ($._namedColors[c]) c = $.color(...$._namedColors[c]);
			}
			if (c.a <= 0) return ($._doStroke = false);
		}
		$.ctx.strokeStyle = $._stroke = c.toString();
	};

	$.strokeWeight = (n) => {
		if (!n) $._doStroke = false;
		if ($._da) n *= $._da;
		$.ctx.lineWidth = $._strokeWeight = n || 0.0001;
	};

	$.noFill = () => ($._doFill = false);
	$.noStroke = () => ($._doStroke = false);
	$.opacity = (a) => ($.ctx.globalAlpha = a);

	$._doShadow = false;
	$._shadowOffsetX = $._shadowOffsetY = $._shadowBlur = 10;

	$.shadow = function (c) {
		if (Q5.Color) {
			if (!c._q5Color) {
				if (typeof c != 'string') c = $.color(...arguments);
				else if ($._namedColors[c]) c = $.color(...$._namedColors[c]);
			}
		}
		$.ctx.shadowColor = $._shadow = c.toString();
		$._doShadow = true;

		$.ctx.shadowOffsetX ||= $._shadowOffsetX;
		$.ctx.shadowOffsetY ||= $._shadowOffsetY;
		$.ctx.shadowBlur ||= $._shadowBlur;
	};

	$.shadowBox = (offsetX, offsetY, blur) => {
		$.ctx.shadowOffsetX = $._shadowOffsetX = offsetX;
		$.ctx.shadowOffsetY = $._shadowOffsetY = offsetY || offsetX;
		$.ctx.shadowBlur = $._shadowBlur = blur || 0;
	};

	$.noShadow = () => {
		$._doShadow = false;
		$.ctx.shadowOffsetX = $.ctx.shadowOffsetY = $.ctx.shadowBlur = 0;
	};

	// DRAWING MATRIX

	$.translate = (x, y) => {
		if ($._da) {
			x *= $._da;
			y *= $._da;
		}
		$.ctx.translate(x, y);
	};

	$.rotate = (r) => {
		if ($._angleMode) r = $.radians(r);
		$.ctx.rotate(r);
	};

	$.scale = (x, y) => {
		if (x.x) {
			y = x.y;
			x = x.x;
		}
		y ??= x;
		$.ctx.scale(x, y);
	};

	$.applyMatrix = (a, b, c, d, e, f) => $.ctx.transform(a, b, c, d, e, f);
	$.shearX = (ang) => $.ctx.transform(1, 0, $.tan(ang), 1, 0, 0);
	$.shearY = (ang) => $.ctx.transform(1, $.tan(ang), 0, 1, 0, 0);

	$.resetMatrix = () => {
		if ($.ctx) {
			$.ctx.resetTransform();
			$.scale($._pixelDensity);
			if ($._webgpuFallback) $.translate($.canvas.hw, $.canvas.hh);
		}
	};

	$.pushMatrix = () => $.ctx.save();
	$.popMatrix = () => $.ctx.restore();

	let _popStyles = $.popStyles;

	$.popStyles = () => {
		_popStyles();

		$.ctx.fillStyle = $._fill;
		$.ctx.strokeStyle = $._stroke;
		$.ctx.lineWidth = $._strokeWeight;
		$.ctx.shadowColor = $._shadow;
		$.ctx.shadowOffsetX = $._doShadow ? $._shadowOffsetX : 0;
		$.ctx.shadowOffsetY = $._doShadow ? $._shadowOffsetY : 0;
		$.ctx.shadowBlur = $._doShadow ? $._shadowBlur : 0;
	};

	$.push = () => {
		$.ctx.save();
		$.pushStyles();
	};
	$.pop = () => {
		$.ctx.restore();
		_popStyles();
	};

	$.createCapture = (x) => {
		var vid = document.createElement('video');
		vid.playsinline = 'playsinline';
		vid.autoplay = 'autoplay';
		navigator.mediaDevices.getUserMedia(x).then((stream) => {
			vid.srcObject = stream;
		});
		vid.style.position = 'absolute';
		vid.style.opacity = 0.00001;
		vid.style.zIndex = -1000;
		document.body.append(vid);
		return vid;
	};
};
Q5.renderers.q2d.drawing = ($) => {
	$._doStroke = true;
	$._doFill = true;
	$._strokeSet = false;
	$._fillSet = false;
	$._ellipseMode = Q5.CENTER;
	$._rectMode = Q5.CORNER;
	$._curveDetail = 20;
	$._curveAlpha = 0.0;

	let firstVertex = true;
	let curveBuff = [];

	function ink() {
		if ($._doFill) $.ctx.fill();
		if ($._doStroke) $.ctx.stroke();
	}

	// DRAWING SETTINGS

	$.blendMode = (x) => ($.ctx.globalCompositeOperation = x);
	$.strokeCap = (x) => ($.ctx.lineCap = x);
	$.strokeJoin = (x) => ($.ctx.lineJoin = x);
	$.ellipseMode = (x) => ($._ellipseMode = x);
	$.rectMode = (x) => ($._rectMode = x);
	$.curveDetail = (x) => ($._curveDetail = x);
	$.curveAlpha = (x) => ($._curveAlpha = x);
	$.curveTightness = (x) => ($._curveAlpha = x);

	// DRAWING

	$.background = function (c) {
		$.ctx.save();
		$.ctx.resetTransform();
		$.ctx.globalAlpha = 1;
		if (c.canvas) $.image(c, 0, 0, $.canvas.width, $.canvas.height);
		else {
			if (Q5.Color && !c._q5Color) {
				if (typeof c != 'string') c = $.color(...arguments);
				else if ($._namedColors[c]) c = $.color(...$._namedColors[c]);
			}
			$.ctx.fillStyle = c.toString();
			$.ctx.fillRect(0, 0, $.canvas.width, $.canvas.height);
		}
		$.ctx.restore();
	};

	$.line = (x0, y0, x1, y1) => {
		if ($._doStroke) {
			$._da && ((x0 *= $._da), (y0 *= $._da), (x1 *= $._da), (y1 *= $._da));
			$.ctx.beginPath();
			$.ctx.moveTo(x0, y0);
			$.ctx.lineTo(x1, y1);
			$.ctx.stroke();
		}
	};

	function arc(x, y, w, h, lo, hi, mode) {
		if ($._angleMode) {
			lo = $.radians(lo);
			hi = $.radians(hi);
		}
		let full = $.TAU;
		lo %= full;
		hi %= full;
		if (lo < 0) lo += full;
		if (hi < 0) hi += full;
		if (lo > hi) hi += full;
		if (lo == hi) return $.ellipse(x, y, w, h);

		w /= 2;
		h /= 2;

		if (!$._doFill && mode == $.PIE_OPEN) mode = $.CHORD_OPEN;

		$.ctx.beginPath();
		$.ctx.ellipse(x, y, w, h, 0, lo, hi);
		if (mode == $.PIE || mode == $.PIE_OPEN) $.ctx.lineTo(x, y);
		if ($._doFill) $.ctx.fill();

		if ($._doStroke) {
			if (mode == $.PIE || mode == $.CHORD) $.ctx.closePath();
			if (mode != $.PIE_OPEN) return $.ctx.stroke();

			$.ctx.beginPath();
			$.ctx.ellipse(x, y, w, h, 0, lo, hi);
			$.ctx.stroke();
		}
	}

	$.arc = (x, y, w, h, start, stop, mode) => {
		if (start == stop) return $.ellipse(x, y, w, h);

		if ($._da) {
			x *= $._da;
			y *= $._da;
			w *= $._da;
			h *= $._da;
		}
		mode ??= $.PIE_OPEN;

		if ($._ellipseMode == $.CENTER) {
			arc(x, y, w, h, start, stop, mode);
		} else if ($._ellipseMode == $.RADIUS) {
			arc(x, y, w * 2, h * 2, start, stop, mode);
		} else if ($._ellipseMode == $.CORNER) {
			arc(x + w / 2, y + h / 2, w, h, start, stop, mode);
		} else if ($._ellipseMode == $.CORNERS) {
			arc((x + w) / 2, (y + h) / 2, w - x, h - y, start, stop, mode);
		}
	};

	function ellipse(x, y, w, h) {
		$.ctx.beginPath();
		$.ctx.ellipse(x, y, w / 2, h / 2, 0, 0, $.TAU);
		ink();
	}

	$.ellipse = (x, y, w, h) => {
		h ??= w;
		if ($._da) {
			x *= $._da;
			y *= $._da;
			w *= $._da;
			h *= $._da;
		}
		if ($._ellipseMode == $.CENTER) {
			ellipse(x, y, w, h);
		} else if ($._ellipseMode == $.RADIUS) {
			ellipse(x, y, w * 2, h * 2);
		} else if ($._ellipseMode == $.CORNER) {
			ellipse(x + w / 2, y + h / 2, w, h);
		} else if ($._ellipseMode == $.CORNERS) {
			ellipse((x + w) / 2, (y + h) / 2, w - x, h - y);
		}
	};

	$.circle = (x, y, d) => {
		if ($._ellipseMode == $.CENTER) {
			if ($._da) {
				x *= $._da;
				y *= $._da;
				d *= $._da;
			}
			$.ctx.beginPath();
			$.ctx.arc(x, y, d / 2, 0, $.TAU);
			ink();
		} else $.ellipse(x, y, d, d);
	};

	$.point = (x, y) => {
		if ($._doStroke) {
			if (x.x) {
				y = x.y;
				x = x.x;
			}
			if ($._da) {
				x *= $._da;
				y *= $._da;
			}
			$.ctx.beginPath();
			$.ctx.moveTo(x, y);
			$.ctx.lineTo(x, y);
			$.ctx.stroke();
		}
	};

	function rect(x, y, w, h) {
		if ($._da) {
			x *= $._da;
			y *= $._da;
			w *= $._da;
			h *= $._da;
		}
		$.ctx.beginPath();
		$.ctx.rect(x, y, w, h);
		ink();
	}

	function roundedRect(x, y, w, h, tl, tr, br, bl) {
		if (tl === undefined) {
			return rect(x, y, w, h);
		}
		if (tr === undefined) {
			return roundedRect(x, y, w, h, tl, tl, tl, tl);
		}
		if ($._da) {
			x *= $._da;
			y *= $._da;
			w *= $._da;
			h *= $._da;
			tl *= $._da;
			tr *= $._da;
			bl *= $._da;
			br *= $._da;
		}
		$.ctx.roundRect(x, y, w, h, [tl, tr, br, bl]);
		ink();
	}

	$.rect = (x, y, w, h = w, tl, tr, br, bl) => {
		if ($._rectMode == $.CENTER) {
			roundedRect(x - w / 2, y - h / 2, w, h, tl, tr, br, bl);
		} else if ($._rectMode == $.RADIUS) {
			roundedRect(x - w, y - h, w * 2, h * 2, tl, tr, br, bl);
		} else if ($._rectMode == $.CORNER) {
			roundedRect(x, y, w, h, tl, tr, br, bl);
		} else if ($._rectMode == $.CORNERS) {
			roundedRect(x, y, w - x, h - y, tl, tr, br, bl);
		}
	};

	$.square = (x, y, s, tl, tr, br, bl) => {
		return $.rect(x, y, s, s, tl, tr, br, bl);
	};

	$.beginShape = () => {
		curveBuff = [];
		$.ctx.beginPath();
		firstVertex = true;
	};

	$.beginContour = () => {
		$.ctx.closePath();
		curveBuff = [];
		firstVertex = true;
	};

	$.endContour = () => {
		curveBuff = [];
		firstVertex = true;
	};

	$.vertex = (x, y) => {
		if ($._da) {
			x *= $._da;
			y *= $._da;
		}
		curveBuff = [];
		if (firstVertex) {
			$.ctx.moveTo(x, y);
		} else {
			$.ctx.lineTo(x, y);
		}
		firstVertex = false;
	};

	$.bezierVertex = (cp1x, cp1y, cp2x, cp2y, x, y) => {
		if ($._da) {
			cp1x *= $._da;
			cp1y *= $._da;
			cp2x *= $._da;
			cp2y *= $._da;
			x *= $._da;
			y *= $._da;
		}
		curveBuff = [];
		$.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
	};

	$.quadraticVertex = (cp1x, cp1y, x, y) => {
		if ($._da) {
			cp1x *= $._da;
			cp1y *= $._da;
			x *= $._da;
			y *= $._da;
		}
		curveBuff = [];
		$.ctx.quadraticCurveTo(cp1x, cp1y, x, y);
	};

	$.bezier = (x1, y1, x2, y2, x3, y3, x4, y4) => {
		$.beginShape();
		$.vertex(x1, y1);
		$.bezierVertex(x2, y2, x3, y3, x4, y4);
		$.endShape();
	};

	$.triangle = (x1, y1, x2, y2, x3, y3) => {
		$.beginShape();
		$.vertex(x1, y1);
		$.vertex(x2, y2);
		$.vertex(x3, y3);
		$.endShape($.CLOSE);
	};

	$.quad = (x1, y1, x2, y2, x3, y3, x4, y4) => {
		$.beginShape();
		$.vertex(x1, y1);
		$.vertex(x2, y2);
		$.vertex(x3, y3);
		$.vertex(x4, y4);
		$.endShape($.CLOSE);
	};

	$.endShape = (close) => {
		curveBuff = [];
		if (close) $.ctx.closePath();
		ink();
	};

	$.curveVertex = (x, y) => {
		if ($._da) {
			x *= $._da;
			y *= $._da;
		}
		curveBuff.push([x, y]);
		if (curveBuff.length < 4) return;

		let p0 = curveBuff.at(-4),
			p1 = curveBuff.at(-3),
			p2 = curveBuff.at(-2),
			p3 = curveBuff.at(-1);

		let cp1x = p1[0] + (p2[0] - p0[0]) / 6,
			cp1y = p1[1] + (p2[1] - p0[1]) / 6,
			cp2x = p2[0] - (p3[0] - p1[0]) / 6,
			cp2y = p2[1] - (p3[1] - p1[1]) / 6;

		if (firstVertex) {
			$.ctx.moveTo(p1[0], p1[1]);
			firstVertex = false;
		}
		$.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
	};

	$.curve = (x1, y1, x2, y2, x3, y3, x4, y4) => {
		$.beginShape();
		$.curveVertex(x1, y1);
		$.curveVertex(x2, y2);
		$.curveVertex(x3, y3);
		$.curveVertex(x4, y4);
		$.endShape();
	};

	$.curvePoint = (a, b, c, d, t) => {
		const t3 = t * t * t,
			t2 = t * t,
			f1 = -0.5 * t3 + t2 - 0.5 * t,
			f2 = 1.5 * t3 - 2.5 * t2 + 1.0,
			f3 = -1.5 * t3 + 2.0 * t2 + 0.5 * t,
			f4 = 0.5 * t3 - 0.5 * t2;
		return a * f1 + b * f2 + c * f3 + d * f4;
	};

	$.bezierPoint = (a, b, c, d, t) => {
		const adjustedT = 1 - t;
		return (
			Math.pow(adjustedT, 3) * a +
			3 * Math.pow(adjustedT, 2) * t * b +
			3 * adjustedT * Math.pow(t, 2) * c +
			Math.pow(t, 3) * d
		);
	};

	$.curveTangent = (a, b, c, d, t) => {
		const t2 = t * t,
			f1 = (-3 * t2) / 2 + 2 * t - 0.5,
			f2 = (9 * t2) / 2 - 5 * t,
			f3 = (-9 * t2) / 2 + 4 * t + 0.5,
			f4 = (3 * t2) / 2 - t;
		return a * f1 + b * f2 + c * f3 + d * f4;
	};

	$.bezierTangent = (a, b, c, d, t) => {
		const adjustedT = 1 - t;
		return (
			3 * d * Math.pow(t, 2) -
			3 * c * Math.pow(t, 2) +
			6 * c * adjustedT * t -
			6 * b * adjustedT * t +
			3 * b * Math.pow(adjustedT, 2) -
			3 * a * Math.pow(adjustedT, 2)
		);
	};

	$.erase = function (fillAlpha = 255, strokeAlpha = 255) {
		$.ctx.save();
		$.ctx.globalCompositeOperation = 'destination-out';
		$.ctx.fillStyle = `rgba(0, 0, 0, ${fillAlpha / 255})`;
		$.ctx.strokeStyle = `rgba(0, 0, 0, ${strokeAlpha / 255})`;
	};

	$.noErase = function () {
		$.ctx.globalCompositeOperation = 'source-over';
		$.ctx.restore();
	};

	$.inFill = (x, y) => {
		const pd = $._pixelDensity;
		return $.ctx.isPointInPath(x * pd, y * pd);
	};

	$.inStroke = (x, y) => {
		const pd = $._pixelDensity;
		return $.ctx.isPointInStroke(x * pd, y * pd);
	};
};
Q5.renderers.q2d.image = ($, q) => {
	class Q5Image {
		constructor(w, h, opt) {
			let $ = this;
			$._scope = 'image';
			$.canvas = $.ctx = $.drawingContext = null;
			$.pixels = [];
			Q5.modules.canvas($, $);
			let r = Q5.renderers.q2d;
			for (let m of ['canvas', 'image', 'soft_filters']) {
				if (r[m]) r[m]($, $);
			}
			$._pixelDensity = opt.pixelDensity || 1;
			$.createCanvas(w, h, opt);
			delete $.createCanvas;
			$._loop = false;
		}
		get w() {
			return this.width;
		}
		get h() {
			return this.height;
		}
	}

	Q5.Image ??= Q5Image;

	$._tint = null;
	let imgData = null;

	$.createImage = (w, h, opt) => {
		opt ??= {};
		opt.alpha ??= true;
		opt.colorSpace ??= $.canvas.colorSpace || Q5.canvasOptions.colorSpace;
		let img = new Q5.Image(w, h, opt);
		img.defaultWidth = w * $._defaultImageScale;
		img.defaultHeight = h * $._defaultImageScale;
		return img;
	};

	$.loadImage = function (url, cb, opt) {
		if (url.canvas) return url;
		if (url.slice(-3).toLowerCase() == 'gif') {
			throw new Error(
				`q5 doesn't support GIFs. Use a video or p5play animation instead. https://github.com/q5js/q5.js/issues/84`
			);
		}
		q._preloadCount++;
		let last = [...arguments].at(-1);
		if (typeof last == 'object') {
			opt = last;
			cb = null;
		} else opt = null;

		let g = $.createImage(1, 1, opt);
		let pd = (g._pixelDensity = opt?.pixelDensity || 1);

		function loaded(img) {
			img._pixelDensity = pd;
			g.defaultWidth = img.width * $._defaultImageScale;
			g.defaultHeight = img.height * $._defaultImageScale;
			g.naturalWidth = img.naturalWidth || img.width;
			g.naturalHeight = img.naturalHeight || img.height;
			g._setImageSize(Math.ceil(g.naturalWidth / pd), Math.ceil(g.naturalHeight / pd));

			g.ctx.drawImage(img, 0, 0);
			q._preloadCount--;
			if (cb) cb(g);
		}

		let img = new window.Image();
		img.crossOrigin = 'Anonymous';
		img.onload = () => loaded(img);
		img.onerror = (e) => {
			q._preloadCount--;
			throw e;
		};
		img.src = url;

		return g;
	};

	$.imageMode = (mode) => ($._imageMode = mode);

	$.image = (img, dx, dy, dw, dh, sx = 0, sy = 0, sw, sh) => {
		if (!img) return;
		let drawable = img.canvas || img;

		dw ??= img.defaultWidth || drawable.width || img.videoWidth;
		dh ??= img.defaultHeight || drawable.height || img.videoHeight;
		if ($._imageMode == 'center') {
			dx -= dw * 0.5;
			dy -= dh * 0.5;
		}
		if ($._da) {
			dx *= $._da;
			dy *= $._da;
			dw *= $._da;
			dh *= $._da;
			sx *= $._da;
			sy *= $._da;
			sw *= $._da;
			sh *= $._da;
		}
		let pd = img._pixelDensity || 1;
		if (!sw) {
			sw = drawable.width || drawable.videoWidth;
		} else sw *= pd;
		if (!sh) {
			sh = drawable.height || drawable.videoHeight;
		} else sh *= pd;

		if ($._tint) {
			if (img._retint || img._tint != $._tint) {
				img._tintImg ??= $.createImage(img.w, img.h, { pixelDensity: pd });

				if (img._tintImg.width != img.width || img._tintImg.height != img.height) {
					img._tintImg.resize(img.w, img.h);
				}

				let tnt = img._tintImg.ctx;
				tnt.globalCompositeOperation = 'copy';
				tnt.fillStyle = $._tint;
				tnt.fillRect(0, 0, img.width, img.height);

				if (img.canvas.alpha) {
					tnt.globalCompositeOperation = 'destination-in';
					tnt.drawImage(drawable, 0, 0, img.width, img.height);
				}

				tnt.globalCompositeOperation = 'multiply';
				tnt.drawImage(drawable, 0, 0, img.width, img.height);

				img._tint = $._tint;
				img._retint = false;
			}

			drawable = img._tintImg.canvas;
		}

		$.ctx.drawImage(drawable, sx * pd, sy * pd, sw, sh, dx, dy, dw, dh);
	};

	$.filter = (type, value) => {
		$.ctx.save();

		let f = '';

		if ($.ctx.filter) {
			if (typeof type == 'string') {
				f = type;
			} else if (type == Q5.GRAY) {
				f = `saturate(0%)`;
			} else if (type == Q5.INVERT) {
				f = `invert(100%)`;
			} else if (type == Q5.BLUR) {
				let r = Math.ceil(value * $._pixelDensity) || 1;
				f = `blur(${r}px)`;
			} else if (type == Q5.THRESHOLD) {
				value ??= 0.5;
				let b = Math.floor((0.5 / Math.max(value, 0.00001)) * 100);
				f = `saturate(0%) brightness(${b}%) contrast(1000000%)`;
			} else if (type == Q5.SEPIA) {
				f = `sepia(${value ?? 1})`;
			} else if (type == Q5.BRIGHTNESS) {
				f = `brightness(${value ?? 1})`;
			} else if (type == Q5.SATURATION) {
				f = `saturate(${value ?? 1})`;
			} else if (type == Q5.CONTRAST) {
				f = `contrast(${value ?? 1})`;
			} else if (type == Q5.HUE_ROTATE) {
				let unit = $._angleMode == 0 ? 'rad' : 'deg';
				f = `hue-rotate(${value}${unit})`;
			}

			if (f) {
				$.ctx.filter = f;
				if ($.ctx.filter == 'none') {
					throw new Error(`Invalid filter format: ${type}`);
				}
			}
		}

		if (!f) $._softFilter(type, value);

		$.ctx.globalCompositeOperation = 'source-over';
		$.ctx.drawImage($.canvas, 0, 0, $.canvas.w, $.canvas.h);
		$.ctx.restore();
		$._retint = true;
	};

	if ($._scope == 'image') {
		$.resize = (w, h) => {
			let c = $.canvas;
			let o = new $._OffscreenCanvas(c.width, c.height);
			let tmpCtx = o.getContext('2d', {
				colorSpace: c.colorSpace
			});
			tmpCtx.drawImage(c, 0, 0);
			$._setImageSize(w, h);
			$.defaultWidth = c.width * $._defaultImageScale;
			$.defaultHeight = c.height * $._defaultImageScale;

			$.ctx.clearRect(0, 0, c.width, c.height);
			$.ctx.drawImage(o, 0, 0, c.width, c.height);

			$._retint = true;
		};
	}

	$._getImageData = (x, y, w, h) => {
		return $.ctx.getImageData(x, y, w, h, { colorSpace: $.canvas.colorSpace });
	};

	$.trim = () => {
		let pd = $._pixelDensity || 1;
		let w = $.canvas.width;
		let h = $.canvas.height;
		let data = $._getImageData(0, 0, w, h).data;
		let left = w,
			right = 0,
			top = h,
			bottom = 0;

		let i = 3;
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				if (data[i] !== 0) {
					if (x < left) left = x;
					if (x > right) right = x;
					if (y < top) top = y;
					if (y > bottom) bottom = y;
				}
				i += 4;
			}
		}
		top = Math.floor(top / pd);
		bottom = Math.floor(bottom / pd);
		left = Math.floor(left / pd);
		right = Math.floor(right / pd);

		return $.get(left, top, right - left + 1, bottom - top + 1);
	};

	$.mask = (img) => {
		$.ctx.save();
		$.ctx.resetTransform();
		let old = $.ctx.globalCompositeOperation;
		$.ctx.globalCompositeOperation = 'destination-in';
		$.ctx.drawImage(img.canvas, 0, 0);
		$.ctx.globalCompositeOperation = old;
		$.ctx.restore();

		$._retint = true;
	};

	$.inset = (x, y, w, h, dx, dy, dw, dh) => {
		let pd = $._pixelDensity || 1;
		$.ctx.drawImage($.canvas, x * pd, y * pd, w * pd, h * pd, dx, dy, dw, dh);

		$._retint = true;
	};

	$.copy = () => $.get();

	$.get = (x, y, w, h) => {
		let pd = $._pixelDensity || 1;
		if (x !== undefined && w === undefined) {
			let c = $._getImageData(x * pd, y * pd, 1, 1).data;
			return [c[0], c[1], c[2], c[3] / 255];
		}
		x = Math.floor(x || 0) * pd;
		y = Math.floor(y || 0) * pd;
		let _w = (w = w || $.width);
		let _h = (h = h || $.height);
		w *= pd;
		h *= pd;
		let img = $.createImage(w, h);
		img.ctx.drawImage($.canvas, x, y, w, h, 0, 0, w, h);
		img._pixelDensity = pd;
		img.width = _w;
		img.height = _h;
		return img;
	};

	$.set = (x, y, c) => {
		x = Math.floor(x);
		y = Math.floor(y);
		$._retint = true;
		if (c.canvas) {
			let old = $._tint;
			$._tint = null;
			$.image(c, x, y);
			$._tint = old;
			return;
		}
		if (!$.pixels.length) $.loadPixels();
		let mod = $._pixelDensity || 1;
		for (let i = 0; i < mod; i++) {
			for (let j = 0; j < mod; j++) {
				let idx = 4 * ((y * mod + i) * $.canvas.width + x * mod + j);
				$.pixels[idx] = c.r;
				$.pixels[idx + 1] = c.g;
				$.pixels[idx + 2] = c.b;
				$.pixels[idx + 3] = c.a;
			}
		}
	};

	$.loadPixels = () => {
		imgData = $._getImageData(0, 0, $.canvas.width, $.canvas.height);
		q.pixels = imgData.data;
	};
	$.updatePixels = () => {
		if (imgData != null) {
			$.ctx.putImageData(imgData, 0, 0);
			$._retint = true;
		}
	};

	$.smooth = () => ($.ctx.imageSmoothingEnabled = true);
	$.noSmooth = () => ($.ctx.imageSmoothingEnabled = false);

	if ($._scope == 'image') return;

	$.tint = function (c) {
		$._tint = (c._q5Color ? c : $.color(...arguments)).toString();
	};
	$.noTint = () => ($._tint = null);
};
/* software implementation of image filters */
Q5.renderers.q2d.soft_filters = ($) => {
	let u = null; // uint8 temporary buffer

	function ensureBuf() {
		let l = $.canvas.width * $.canvas.height * 4;
		if (!u || u.length != l) u = new Uint8ClampedArray(l);
	}

	function initSoftFilters() {
		$._filters = [];
		$._filters[Q5.THRESHOLD] = (d, thresh) => {
			if (thresh === undefined) thresh = 127.5;
			else thresh *= 255;
			for (let i = 0; i < d.length; i += 4) {
				const gray = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
				d[i] = d[i + 1] = d[i + 2] = gray >= thresh ? 255 : 0;
			}
		};
		$._filters[Q5.GRAY] = (d) => {
			for (let i = 0; i < d.length; i += 4) {
				const gray = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
				d[i] = d[i + 1] = d[i + 2] = gray;
			}
		};
		$._filters[Q5.OPAQUE] = (d) => {
			for (let i = 0; i < d.length; i += 4) {
				d[i + 3] = 255;
			}
		};
		$._filters[Q5.INVERT] = (d) => {
			for (let i = 0; i < d.length; i += 4) {
				d[i] = 255 - d[i];
				d[i + 1] = 255 - d[i + 1];
				d[i + 2] = 255 - d[i + 2];
			}
		};
		$._filters[Q5.POSTERIZE] = (d, lvl = 4) => {
			let lvl1 = lvl - 1;
			for (let i = 0; i < d.length; i += 4) {
				d[i] = (((d[i] * lvl) >> 8) * 255) / lvl1;
				d[i + 1] = (((d[i + 1] * lvl) >> 8) * 255) / lvl1;
				d[i + 2] = (((d[i + 2] * lvl) >> 8) * 255) / lvl1;
			}
		};
		$._filters[Q5.DILATE] = (d, func) => {
			func ??= Math.max;
			ensureBuf();
			u.set(d);
			let [w, h] = [$.canvas.width, $.canvas.height];
			for (let i = 0; i < h; i++) {
				for (let j = 0; j < w; j++) {
					let l = 4 * Math.max(j - 1, 0);
					let r = 4 * Math.min(j + 1, w - 1);
					let t = 4 * Math.max(i - 1, 0) * w;
					let b = 4 * Math.min(i + 1, h - 1) * w;
					let oi = 4 * i * w;
					let oj = 4 * j;
					for (let k = 0; k < 4; k++) {
						let kt = k + t;
						let kb = k + b;
						let ko = k + oi;
						d[oi + oj + k] = func(u[kt + oj], u[ko + l], u[ko + oj], u[ko + r], u[kb + oj]);
					}
				}
			}
		};
		$._filters[Q5.ERODE] = (d) => {
			$._filters[Q5.DILATE](d, Math.min);
		};
		$._filters[Q5.BLUR] = (d, r) => {
			r = r || 1;
			r = Math.floor(r * $._pixelDensity);
			ensureBuf();
			u.set(d);

			let ksize = r * 2 + 1;

			function gauss(ksize) {
				let im = new Float32Array(ksize);
				let sigma = 0.3 * r + 0.8;
				let ss2 = sigma * sigma * 2;
				for (let i = 0; i < ksize; i++) {
					let x = i - ksize / 2;
					let z = Math.exp(-(x * x) / ss2) / (2.5066282746 * sigma);
					im[i] = z;
				}
				return im;
			}

			let kern = gauss(ksize);
			let [w, h] = [$.canvas.width, $.canvas.height];
			for (let i = 0; i < h; i++) {
				for (let j = 0; j < w; j++) {
					let s0 = 0,
						s1 = 0,
						s2 = 0,
						s3 = 0;
					for (let k = 0; k < ksize; k++) {
						let jk = Math.min(Math.max(j - r + k, 0), w - 1);
						let idx = 4 * (i * w + jk);
						s0 += u[idx] * kern[k];
						s1 += u[idx + 1] * kern[k];
						s2 += u[idx + 2] * kern[k];
						s3 += u[idx + 3] * kern[k];
					}
					let idx = 4 * (i * w + j);
					d[idx] = s0;
					d[idx + 1] = s1;
					d[idx + 2] = s2;
					d[idx + 3] = s3;
				}
			}
			u.set(d);
			for (let i = 0; i < h; i++) {
				for (let j = 0; j < w; j++) {
					let s0 = 0,
						s1 = 0,
						s2 = 0,
						s3 = 0;
					for (let k = 0; k < ksize; k++) {
						let ik = Math.min(Math.max(i - r + k, 0), h - 1);
						let idx = 4 * (ik * w + j);
						s0 += u[idx] * kern[k];
						s1 += u[idx + 1] * kern[k];
						s2 += u[idx + 2] * kern[k];
						s3 += u[idx + 3] * kern[k];
					}
					let idx = 4 * (i * w + j);
					d[idx] = s0;
					d[idx + 1] = s1;
					d[idx + 2] = s2;
					d[idx + 3] = s3;
				}
			}
		};
	}

	$._softFilter = (typ, x) => {
		if (!$._filters) initSoftFilters();
		let imgData = $.ctx._getImageData(0, 0, $.canvas.width, $.canvas.height);
		$._filters[typ](imgData.data, x);
		$.ctx.putImageData(imgData, 0, 0);
	};
};
Q5.renderers.q2d.text = ($, q) => {
	$._textAlign = 'left';
	$._textBaseline = 'alphabetic';
	$._textSize = 12;

	let font = 'sans-serif',
		leadingSet = false,
		leading = 15,
		leadDiff = 3,
		emphasis = 'normal',
		fontMod = false,
		styleHash = 0,
		styleHashes = [],
		useCache = false,
		genTextImage = false,
		cacheSize = 0,
		cacheMax = 12000;

	let cache = ($._textCache = {});

	$.loadFont = (url, cb) => {
		q._preloadCount++;
		let name = url.split('/').pop().split('.')[0].replace(' ', '');
		let f = new FontFace(name, `url(${url})`);
		document.fonts.add(f);
		f.load().then(() => {
			q._preloadCount--;
			if (cb) cb(name);
		});
		$.textFont(name);
		return name;
	};

	$.textFont = (x) => {
		if (!x || x == font) return font;
		font = x;
		fontMod = true;
		styleHash = -1;
	};

	$.textSize = (x) => {
		if (x == undefined || x == $._textSize) return $._textSize;
		if ($._da) x *= $._da;
		$._textSize = x;
		fontMod = true;
		styleHash = -1;
		if (!leadingSet) {
			leading = x * 1.25;
			leadDiff = leading - x;
		}
	};

	$.textStyle = (x) => {
		if (!x || x == emphasis) return emphasis;
		emphasis = x;
		fontMod = true;
		styleHash = -1;
	};

	$.textLeading = (x) => {
		if (x == undefined) return leading || $._textSize * 1.25;
		leadingSet = true;
		if (x == leading) return leading;
		if ($._da) x *= $._da;
		leading = x;
		leadDiff = x - $._textSize;
		styleHash = -1;
	};

	$.textAlign = (horiz, vert) => {
		$.ctx.textAlign = $._textAlign = horiz;
		if (vert) {
			$.ctx.textBaseline = $._textBaseline = vert == $.CENTER ? 'middle' : vert;
		}
	};

	const updateFont = () => {
		$.ctx.font = `${emphasis} ${$._textSize}px ${font}`;
		fontMod = false;
	};

	$.textWidth = (str) => {
		if (fontMod) updateFont();
		return $.ctx.measureText(str).width;
	};
	$.textAscent = (str) => {
		if (fontMod) updateFont();
		return $.ctx.measureText(str).actualBoundingBoxAscent;
	};
	$.textDescent = (str) => {
		if (fontMod) updateFont();
		return $.ctx.measureText(str).actualBoundingBoxDescent;
	};

	$.textFill = $.fill;
	$.textStroke = $.stroke;

	let updateStyleHash = () => {
		let styleString = font + $._textSize + emphasis + leading;

		let hash = 5381;
		for (let i = 0; i < styleString.length; i++) {
			hash = (hash * 33) ^ styleString.charCodeAt(i);
		}
		styleHash = hash >>> 0;
	};

	$.textCache = (enable, maxSize) => {
		if (maxSize) cacheMax = maxSize;
		if (enable !== undefined) useCache = enable;
		return useCache;
	};

	$.createTextImage = (str, w, h) => {
		genTextImage = true;
		img = $.text(str, 0, 0, w, h);
		genTextImage = false;
		return img;
	};

	let lines = [];

	$.text = (str, x, y, w, h) => {
		if (str === undefined || (!$._doFill && !$._doStroke)) return;
		str = str.toString();
		if ($._da) {
			x *= $._da;
			y *= $._da;
		}
		let ctx = $.ctx;
		let img, tX, tY;

		if (fontMod) {
			ctx.font = `${emphasis} ${$._textSize}px ${font}`;
			fontMod = false;
		}

		if (useCache || genTextImage) {
			if (styleHash == -1) updateStyleHash();

			img = cache[str];
			if (img) img = img[styleHash];

			if (img) {
				if (img._fill == $._fill && img._stroke == $._stroke && img._strokeWeight == $._strokeWeight) {
					if (genTextImage) return img;
					return $.textImage(img, x, y);
				} else img.clear();
			}
		}

		if (str.indexOf('\n') == -1) lines[0] = str;
		else lines = str.split('\n');

		if (str.length > w) {
			let wrapped = [];
			for (let line of lines) {
				let i = 0;

				while (i < line.length) {
					let max = i + w;
					if (max >= line.length) {
						wrapped.push(line.slice(i));
						break;
					}
					let end = line.lastIndexOf(' ', max);
					if (end === -1 || end < i) end = max;
					wrapped.push(line.slice(i, end));
					i = end + 1;
				}
			}
			lines = wrapped;
		}

		if (!useCache && !genTextImage) {
			tX = x;
			tY = y;
		} else {
			tX = 0;
			tY = leading * lines.length;

			if (!img) {
				let measure = ctx.measureText(' ');
				let ascent = measure.fontBoundingBoxAscent;
				let descent = measure.fontBoundingBoxDescent;

				img = $.createImage.call($, Math.ceil(ctx.measureText(str).width), Math.ceil(tY + descent), {
					pixelDensity: $._pixelDensity
				});

				img._ascent = ascent;
				img._descent = descent;
				img._top = descent + leadDiff;
				img._middle = img._top + ascent * 0.5;
				img._bottom = img._top + ascent;
				img._leading = leading;
			}

			img._fill = $._fill;
			img._stroke = $._stroke;
			img._strokeWeight = $._strokeWeight;
			img.modified = true;

			ctx = img.ctx;

			ctx.font = $.ctx.font;
			ctx.fillStyle = $._fill;
			ctx.strokeStyle = $._stroke;
			ctx.lineWidth = $.ctx.lineWidth;
		}

		let ogFill;
		if (!$._fillSet) {
			ogFill = ctx.fillStyle;
			ctx.fillStyle = 'black';
		}

		let lineAmount = 0;
		for (let line of lines) {
			if ($._doStroke && $._strokeSet) ctx.strokeText(line, tX, tY);
			if ($._doFill) ctx.fillText(line, tX, tY);
			tY += leading;
			lineAmount++;
			if (lineAmount >= h) break;
		}
		lines = [];

		if (!$._fillSet) ctx.fillStyle = ogFill;

		if (useCache || genTextImage) {
			styleHashes.push(styleHash);
			(cache[str] ??= {})[styleHash] = img;

			cacheSize++;
			if (cacheSize > cacheMax) {
				let half = Math.ceil(cacheSize / 2);
				let hashes = styleHashes.splice(0, half);
				for (let s in cache) {
					s = cache[s];
					for (let h of hashes) delete s[h];
				}
				cacheSize -= half;
			}

			if (genTextImage) return img;
			$.textImage(img, x, y);
		}
	};

	$.textImage = (img, x, y) => {
		if (typeof img == 'string') img = $.createTextImage(img);

		let og = $._imageMode;
		$._imageMode = 'corner';

		let ta = $._textAlign;
		if (ta == 'center') x -= img.canvas.hw;
		else if (ta == 'right') x -= img.width;

		let bl = $._textBaseline;
		if (bl == 'alphabetic') y -= img._leading;
		else if (bl == 'middle') y -= img._middle;
		else if (bl == 'bottom') y -= img._bottom;
		else if (bl == 'top') y -= img._top;

		$.image(img, x, y);
		$._imageMode = og;
	};

	$.nf = (n, l, r) => {
		let neg = n < 0;
		n = Math.abs(n);
		let parts = n.toFixed(r).split('.');
		parts[0] = parts[0].padStart(l, '0');
		let s = parts.join('.');
		if (neg) s = '-' + s;
		return s;
	};
};
Q5.modules.ai = ($) => {
	$.askAI = (question = '') => {
		Q5.disableFriendlyErrors = false;
		throw Error('Ask AI ✨ ' + question);
	};

	$._askAI = async (e) => {
		let askAI = e.message?.includes('Ask AI ✨');
		let stackLines = e.stack?.split('\n');
		if (!e.stack || stackLines.length <= 1) return;

		let idx = 1;
		let sep = '(';
		if (navigator.userAgent.indexOf('Chrome') == -1) {
			idx = 0;
			sep = '@';
		}
		while (stackLines[idx].indexOf('q5') >= 0) idx++;

		let errFile = stackLines[idx].split(sep).at(-1);
		if (errFile.startsWith('blob:')) errFile = errFile.slice(5);
		let parts = errFile.split(':');
		let lineNum = parseInt(parts.at(-2));
		if (askAI) lineNum++;
		parts[3] = parts[3].split(')')[0];
		let fileUrl = parts.slice(0, 2).join(':');
		let fileBase = fileUrl.split('/').at(-1);

		try {
			let res = await (await fetch(fileUrl)).text();
			let lines = res.split('\n');
			let errLine = lines[lineNum - 1].trim();

			let context = '';
			let i = 1;
			while (context.length < 1600) {
				if (lineNum - i >= 0) {
					context = lines[lineNum - i].trim() + '\n' + context;
				}
				if (lineNum + i < lines.length) {
					context += lines[lineNum + i].trim() + '\n';
				} else break;
				i++;
			}

			let question =
				askAI && e.message.length > 10 ? e.message.slice(10) : 'Whats+wrong+with+this+line%3F+short+answer';

			let url =
				'https://chatgpt.com/?q=q5.js+' +
				question +
				(askAI ? '' : '%0A%0A' + encodeURIComponent(e.name + ': ' + e.message)) +
				'%0A%0ALine%3A+' +
				encodeURIComponent(errLine) +
				'%0A%0AExcerpt+for+context%3A%0A%0A' +
				encodeURIComponent(context);

			console.warn('Error in ' + fileBase + ' on line ' + lineNum + ':\n\n' + errLine);

			console.warn('Ask AI ✨ ' + url);

			if (askAI) return window.open(url, '_blank');
		} catch (err) {}
	};
};
Q5.modules.color = ($, q) => {
	$.RGB = $.RGBA = $._colorMode = 'rgb';
	$.SRGB = 'srgb';
	$.OKLCH = 'oklch';

	$.colorMode = (mode, format) => {
		$._colorMode = mode;
		let srgb = $.canvas.colorSpace == 'srgb' || mode == 'srgb';
		format ??= srgb ? 'integer' : 'float';
		$._colorFormat = format == 'float' || format == 1 ? 1 : 255;
		if (mode == 'oklch') {
			q.Color = Q5.ColorOKLCH;
		} else {
			if ($._colorFormat == 255) {
				q.Color = srgb ? Q5.ColorRGBA_8 : Q5.ColorRGBA_P3_8;
			} else {
				q.Color = srgb ? Q5.ColorRGBA : Q5.ColorRGBA_P3;
			}
			$._colorMode = 'rgb';
		}
	};

	$._namedColors = {
		aqua: [0, 255, 255],
		black: [0, 0, 0],
		blue: [0, 0, 255],
		brown: [165, 42, 42],
		crimson: [220, 20, 60],
		cyan: [0, 255, 255],
		darkviolet: [148, 0, 211],
		gold: [255, 215, 0],
		green: [0, 128, 0],
		gray: [128, 128, 128],
		grey: [128, 128, 128],
		hotpink: [255, 105, 180],
		indigo: [75, 0, 130],
		khaki: [240, 230, 140],
		lightgreen: [144, 238, 144],
		lime: [0, 255, 0],
		magenta: [255, 0, 255],
		navy: [0, 0, 128],
		orange: [255, 165, 0],
		olive: [128, 128, 0],
		peachpuff: [255, 218, 185],
		pink: [255, 192, 203],
		purple: [128, 0, 128],
		red: [255, 0, 0],
		skyblue: [135, 206, 235],
		tan: [210, 180, 140],
		turquoise: [64, 224, 208],
		transparent: [0, 0, 0, 0],
		white: [255, 255, 255],
		violet: [238, 130, 238],
		yellow: [255, 255, 0]
	};

	$.color = (c0, c1, c2, c3) => {
		let C = $.Color;
		if (c0._q5Color) return new C(...c0.levels);
		if (c1 == undefined) {
			if (typeof c0 == 'string') {
				if (c0[0] == '#') {
					if (c0.length <= 5) {
						if (c0.length > 4) c3 = parseInt(c0[4] + c0[4], 16);
						c2 = parseInt(c0[3] + c0[3], 16);
						c1 = parseInt(c0[2] + c0[2], 16);
						c0 = parseInt(c0[1] + c0[1], 16);
					} else {
						if (c0.length > 7) c3 = parseInt(c0.slice(7, 9), 16);
						c2 = parseInt(c0.slice(5, 7), 16);
						c1 = parseInt(c0.slice(3, 5), 16);
						c0 = parseInt(c0.slice(1, 3), 16);
					}
				} else if ($._namedColors[c0]) {
					[c0, c1, c2, c3] = $._namedColors[c0];
				} else {
					console.error(
						"q5 can't parse color: " + c0 + '\nOnly numeric input, hex, and common named colors are supported.'
					);
					return new C(0, 0, 0);
				}

				if ($._colorFormat == 1) {
					c0 /= 255;
					if (c1) c1 /= 255;
					if (c2) c2 /= 255;
					if (c3) c3 /= 255;
				}
			}
			if (Array.isArray(c0)) [c0, c1, c2, c3] = c0;
		}

		if (c2 == undefined) {
			if ($._colorMode == Q5.OKLCH) return new C(c0, 0, 0, c1);
			return new C(c0, c0, c0, c1);
		}
		return new C(c0, c1, c2, c3);
	};

	// deprecated
	$.red = (c) => c.r;
	$.green = (c) => c.g;
	$.blue = (c) => c.b;
	$.alpha = (c) => c.a;

	$.lightness = (c) => {
		if (c.l) return c.l;
		return ((0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) * 100) / 255;
	};
	$.hue = (c) => {
		if (c.h) return c.h;
		let r = c.r;
		let g = c.g;
		let b = c.b;
		if ($._colorFormat == 255) {
			r /= 255;
			g /= 255;
			b /= 255;
		}
		let max = Math.max(r, g, b);
		let min = Math.min(r, g, b);
		let h;
		if (max == min) h = 0;
		else if (max == r) h = (60 * (g - b)) / (max - min);
		else if (max == g) h = (60 * (b - r)) / (max - min) + 120;
		else h = (60 * (r - g)) / (max - min) + 240;
		if (h < 0) h += 360;
		return h;
	};

	$.lerpColor = (a, b, t) => {
		t = Math.max(0, Math.min(1, t));
		if ($._colorMode == 'rgb') {
			return new $.Color($.lerp(a.r, b.r, t), $.lerp(a.g, b.g, t), $.lerp(a.b, b.b, t), $.lerp(a.a, b.a, t));
		} else {
			let deltaH = b.h - a.h;
			if (deltaH > 180) deltaH -= 360;
			if (deltaH < -180) deltaH += 360;
			let h = a.h + t * deltaH;
			if (h < 0) h += 360;
			if (h > 360) h -= 360;
			return new $.Color($.lerp(a.l, b.l, t), $.lerp(a.c, b.c, t), h, $.lerp(a.a, b.a, t));
		}
	};
};

// COLOR CLASSES

Q5.Color = class {
	constructor() {
		this._q5Color = true;
	}
};

Q5.ColorOKLCH = class extends Q5.Color {
	constructor(l, c, h, a) {
		super();
		this.l = l;
		this.c = c;
		this.h = h;
		this.a = a ?? 1;
	}
	get levels() {
		return [this.l, this.c, this.h, this.a];
	}
	equals(c) {
		return c && this.l == c.l && this.c == c.c && this.h == c.h && this.a == c.a;
	}
	isSameColor(c) {
		return c && this.l == c.l && this.c == c.c && this.h == c.h;
	}
	toString() {
		return `oklch(${this.l} ${this.c} ${this.h} / ${this.a})`;
	}

	get lightness() {
		return this.l;
	}
	set lightness(v) {
		this.l = v;
	}
	get chroma() {
		return this.c;
	}
	set chroma(v) {
		this.c = v;
	}
	get hue() {
		return this.h;
	}
	set hue(v) {
		this.h = v;
	}
	get alpha() {
		return this.a;
	}
	set alpha(v) {
		this.a = v;
	}
};

Q5.ColorRGBA = class extends Q5.Color {
	constructor(r, g, b, a) {
		super();
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a ?? 1;
	}
	get levels() {
		return [this.r, this.g, this.b, this.a];
	}
	equals(c) {
		return c && this.r == c.r && this.g == c.g && this.b == c.b && this.a == c.a;
	}
	isSameColor(c) {
		return c && this.r == c.r && this.g == c.g && this.b == c.b;
	}
	toString() {
		return `color(srgb ${this.r} ${this.g} ${this.b} / ${this.a})`;
	}
	get red() {
		return this.r;
	}
	set red(v) {
		this.r = v;
	}
	get green() {
		return this.g;
	}
	set green(v) {
		this.g = v;
	}
	get blue() {
		return this.b;
	}
	set blue(v) {
		this.b = v;
	}
	get alpha() {
		return this.a;
	}
	set alpha(v) {
		this.a = v;
	}
};

Q5.ColorRGBA_P3 = class extends Q5.ColorRGBA {
	toString() {
		return `color(display-p3 ${this.r} ${this.g} ${this.b} / ${this.a})`;
	}
};

// legacy 8-bit (0-255) integer color format
Q5.ColorRGBA_8 = class extends Q5.ColorRGBA {
	constructor(r, g, b, a) {
		super(r, g, b, a ?? 255);
	}
	// deprecated set functions for backwards compatibility
	setRed(v) {
		this.r = v;
	}
	setGreen(v) {
		this.g = v;
	}
	setBlue(v) {
		this.b = v;
	}
	setAlpha(v) {
		this.a = v;
	}
	toString() {
		return `rgb(${this.r} ${this.g} ${this.b} / ${this.a / 255})`;
	}
};

// p3 10-bit color in integer color format, for backwards compatibility
Q5.ColorRGBA_P3_8 = class extends Q5.ColorRGBA {
	constructor(r, g, b, a) {
		super(r, g, b, a ?? 255);
		this._edited = true;
	}
	get r() {
		return this._r;
	}
	set r(v) {
		this._r = v;
		this._edited = true;
	}
	get g() {
		return this._g;
	}
	set g(v) {
		this._g = v;
		this._edited = true;
	}
	get b() {
		return this._b;
	}
	set b(v) {
		this._b = v;
		this._edited = true;
	}
	get a() {
		return this._a;
	}
	set a(v) {
		this._a = v;
		this._edited = true;
	}
	toString() {
		if (this._edited) {
			let r = (this._r / 255).toFixed(3);
			let g = (this._g / 255).toFixed(3);
			let b = (this._b / 255).toFixed(3);
			let a = (this._a / 255).toFixed(3);
			this._css = `color(display-p3 ${r} ${g} ${b} / ${a})`;
			this._edited = false;
		}
		return this._css;
	}
};
Q5.modules.display = ($) => {
	if (!$.canvas || $._scope == 'graphics') return;

	let c = $.canvas;

	$.CENTERED = 'centered';
	$.FULLSCREEN = 'fullscreen';
	$.MAXED = 'maxed';

	$.PIXELATED = 'pixelated';

	if (Q5._instanceCount == 0 && !Q5._server) {
		document.head.insertAdjacentHTML(
			'beforeend',
			`<style>
html, body {
	margin: 0;
	padding: 0;
}
.q5Canvas {
	outline: none;
	-webkit-touch-callout: none;
	-webkit-text-size-adjust: none;
	-webkit-user-select: none;
	overscroll-behavior: none;
}
.q5-pixelated {
	image-rendering: pixelated;
	font-smooth: never;
	-webkit-font-smoothing: none;
}
.q5-centered,
.q5-maxed,
.q5-fullscreen {
  display: flex;
	align-items: center;
	justify-content: center;
}
main.q5-centered,
main.q5-maxed,
.q5-fullscreen {
	height: 100vh;
}
main {
	overscroll-behavior: none;
}
</style>`
		);
	}

	$._adjustDisplay = () => {
		let s = c.style;
		let p = c.parentElement;
		if (!s || !p || !c.displayMode) return;
		if (c.renderQuality == 'pixelated') {
			c.classList.add('q5-pixelated');
			$.pixelDensity(1);
			$.defaultImageScale(1);
			if ($.noSmooth) $.noSmooth();
			if ($.textFont) $.textFont('monospace');
		}
		if (c.displayMode == 'default' || c.displayMode == 'normal') {
			p.classList.remove('q5-centered', 'q5-maxed', 'q5-fullscreen');
			s.width = c.w * c.displayScale + 'px';
			s.height = c.h * c.displayScale + 'px';
		} else {
			p.classList.add('q5-' + c.displayMode);
			p = p.getBoundingClientRect();
			if (c.w / c.h > p.width / p.height) {
				if (c.displayMode == 'centered') {
					s.width = c.w * c.displayScale + 'px';
					s.maxWidth = '100%';
				} else s.width = '100%';
				s.height = 'auto';
				s.maxHeight = '';
			} else {
				s.width = 'auto';
				s.maxWidth = '';
				if (c.displayMode == 'centered') {
					s.height = c.h * c.displayScale + 'px';
					s.maxHeight = '100%';
				} else s.height = '100%';
			}
		}
	};

	$.displayMode = (displayMode = 'normal', renderQuality = 'smooth', displayScale = 1) => {
		if (typeof displayScale == 'string') {
			displayScale = parseFloat(displayScale.slice(1));
		}
		if (displayMode == 'center') displayMode = 'centered';
		Object.assign(c, { displayMode, renderQuality, displayScale });
		$._adjustDisplay();
	};

	$.fullscreen = (v) => {
		if (v === undefined) return document.fullscreenElement;
		if (v) document.body.requestFullscreen();
		else document.body.exitFullscreen();
	};
};
Q5.modules.input = ($, q) => {
	if ($._scope == 'graphics') return;

	$.mouseX = 0;
	$.mouseY = 0;
	$.pmouseX = 0;
	$.pmouseY = 0;
	$.touches = [];
	$.mouseButton = '';
	$.keyIsPressed = false;
	$.mouseIsPressed = false;
	$.key = '';
	$.keyCode = 0;

	$.UP_ARROW = 38;
	$.DOWN_ARROW = 40;
	$.LEFT_ARROW = 37;
	$.RIGHT_ARROW = 39;
	$.SHIFT = 16;
	$.TAB = 9;
	$.BACKSPACE = 8;
	$.ENTER = $.RETURN = 13;
	$.ALT = $.OPTION = 18;
	$.CONTROL = 17;
	$.DELETE = 46;
	$.ESCAPE = 27;

	$.ARROW = 'default';
	$.CROSS = 'crosshair';
	$.HAND = 'pointer';
	$.MOVE = 'move';
	$.TEXT = 'text';

	let keysHeld = {};
	let mouseBtns = [Q5.LEFT, Q5.CENTER, Q5.RIGHT];

	let c = $.canvas;

	$._startAudio = () => {
		if (!Q5.aud || Q5.aud?.state == 'suspended') $.userStartAudio();
	};

	$._updateMouse = (e) => {
		if (e.changedTouches) return;
		if (c) {
			let rect = c.getBoundingClientRect();
			let sx = c.scrollWidth / $.width || 1;
			let sy = c.scrollHeight / $.height || 1;
			q.mouseX = (e.clientX - rect.left) / sx;
			q.mouseY = (e.clientY - rect.top) / sy;
			if (c.renderer == 'webgpu') {
				q.mouseX -= c.hw;
				q.mouseY -= c.hh;
			}
		} else {
			q.mouseX = e.clientX;
			q.mouseY = e.clientY;
		}
		q.moveX = e.movementX;
		q.moveY = e.movementY;
	};

	let pressedInCanvas = 0;

	$._onmousedown = (e) => {
		pressedInCanvas++;
		$._startAudio();
		$._updateMouse(e);
		q.mouseIsPressed = true;
		q.mouseButton = mouseBtns[e.button];
		$.mousePressed(e);
	};

	$._onmousemove = (e) => {
		$._updateMouse(e);
		if ($.mouseIsPressed) $.mouseDragged(e);
		else $.mouseMoved(e);
	};

	$._onmouseup = (e) => {
		$._updateMouse(e);
		q.mouseIsPressed = false;
		$.mouseReleased(e);
	};

	$._onclick = (e) => {
		$._updateMouse(e);
		q.mouseIsPressed = true;
		$.mouseClicked(e);
		q.mouseIsPressed = false;
	};

	$._onwheel = (e) => {
		$._updateMouse(e);
		e.delta = e.deltaY;
		if ($.mouseWheel(e) == false) e.preventDefault();
	};

	$.cursor = (name, x, y) => {
		let pfx = '';
		if (name.includes('.')) {
			name = `url("${name}")`;
			pfx = ', auto';
		}
		if (x !== undefined) {
			name += ' ' + x + ' ' + y;
		}
		$.canvas.style.cursor = name + pfx;
	};

	$.noCursor = () => {
		$.canvas.style.cursor = 'none';
	};

	if (window) {
		$.lockMouse = document.body?.requestPointerLock;
		$.unlockMouse = document.exitPointerLock;
	}

	$._onkeydown = (e) => {
		if (e.repeat) return;
		$._startAudio();
		q.keyIsPressed = true;
		q.key = e.key;
		q.keyCode = e.keyCode;
		keysHeld[$.keyCode] = keysHeld[$.key.toLowerCase()] = true;
		$.keyPressed(e);
		if (e.key.length == 1) $.keyTyped(e);
	};

	$._onkeyup = (e) => {
		q.keyIsPressed = false;
		q.key = e.key;
		q.keyCode = e.keyCode;
		keysHeld[$.keyCode] = keysHeld[$.key.toLowerCase()] = false;
		$.keyReleased(e);
	};

	$.keyIsDown = (v) => !!keysHeld[typeof v == 'string' ? v.toLowerCase() : v];

	function getTouchInfo(touch) {
		const rect = $.canvas.getBoundingClientRect();
		const sx = $.canvas.scrollWidth / $.width || 1;
		const sy = $.canvas.scrollHeight / $.height || 1;
		return {
			x: (touch.clientX - rect.left) / sx,
			y: (touch.clientY - rect.top) / sy,
			id: touch.identifier
		};
	}

	$._ontouchstart = (e) => {
		$._startAudio();
		q.touches = [...e.touches].map(getTouchInfo);
		if (!$._isTouchAware) {
			q.mouseX = $.touches[0].x;
			q.mouseY = $.touches[0].y;
			q.mouseIsPressed = true;
			q.mouseButton = $.LEFT;
			$.mousePressed(e);
		}
		$.touchStarted(e);
	};

	$._ontouchmove = (e) => {
		q.touches = [...e.touches].map(getTouchInfo);
		if (!$._isTouchAware) {
			q.mouseX = $.touches[0].x;
			q.mouseY = $.touches[0].y;
			if (!$.mouseDragged(e)) e.preventDefault();
		}
		if (!$.touchMoved(e)) e.preventDefault();
	};

	$._ontouchend = (e) => {
		q.touches = [...e.touches].map(getTouchInfo);
		if (!$._isTouchAware && !$.touches.length) {
			q.mouseIsPressed = false;
			if (!$.mouseReleased(e)) e.preventDefault();
		}
		if (!$.touchEnded(e)) e.preventDefault();
	};

	if (c) {
		let l = c.addEventListener.bind(c);
		l('mousedown', (e) => $._onmousedown(e));
		l('wheel', (e) => $._onwheel(e));
		l('click', (e) => $._onclick(e));

		l('touchstart', (e) => $._ontouchstart(e));
		l('touchmove', (e) => $._ontouchmove(e));
		l('touchend', (e) => $._ontouchend(e));
		l('touchcancel', (e) => $._ontouchend(e));
	}

	if (window) {
		let l = window.addEventListener;
		l('keydown', (e) => $._onkeydown(e), false);
		l('keyup', (e) => $._onkeyup(e), false);

		if (!c) {
			l('mousedown', (e) => $._onmousedown(e));
			l('wheel', (e) => $._onwheel(e));
			l('click', (e) => $._onclick(e));
		}

		l('mousemove', (e) => $._onmousemove(e), false);
		l('mouseup', (e) => {
			if (pressedInCanvas > 0) {
				pressedInCanvas--;
				$._onmouseup(e);
			}
		});
	}
};
Q5.modules.math = ($, q) => {
	$.RADIANS = 0;
	$.DEGREES = 1;

	$.PI = Math.PI;
	$.HALF_PI = Math.PI / 2;
	$.QUARTER_PI = Math.PI / 4;

	$.abs = Math.abs;
	$.ceil = Math.ceil;
	$.exp = Math.exp;
	$.floor = $.int = Math.floor;
	$.loge = Math.log;
	$.mag = Math.hypot;
	$.max = Math.max;
	$.min = Math.min;
	$.round = Math.round;
	$.pow = Math.pow;
	$.sqrt = Math.sqrt;

	$.SHR3 = 1;
	$.LCG = 2;

	let angleMode = ($._angleMode = 0);

	$.angleMode = (mode) => {
		angleMode = $._angleMode = mode == 0 || mode == 'radians' ? 0 : 1;
		return !angleMode ? 'radians' : 'degrees';
	};
	let DEGTORAD = ($._DEGTORAD = Math.PI / 180);
	let RADTODEG = ($._RADTODEG = 180 / Math.PI);
	$.degrees = (x) => x * $._RADTODEG;
	$.radians = (x) => x * $._DEGTORAD;

	$.map = Q5.prototype.map = (value, istart, istop, ostart, ostop, clamp) => {
		let val = ostart + (ostop - ostart) * (((value - istart) * 1.0) / (istop - istart));
		if (!clamp) {
			return val;
		}
		if (ostart < ostop) {
			return Math.min(Math.max(val, ostart), ostop);
		} else {
			return Math.min(Math.max(val, ostop), ostart);
		}
	};

	$.dist = function () {
		let a = arguments;
		if (a.length == 2) return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
		if (a.length == 4) return Math.hypot(a[0] - a[2], a[1] - a[3]);
		return Math.hypot(a[0] - a[3], a[1] - a[4], a[2] - a[5]);
	};

	$.lerp = (a, b, t) => a * (1 - t) + b * t;
	$.constrain = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
	$.norm = (value, start, stop) => $.map(value, start, stop, 0, 1);
	$.sq = (x) => x * x;
	$.fract = (x) => x - Math.floor(x);

	$.sin = (a) => Math.sin(!angleMode ? a : a * DEGTORAD);
	$.cos = (a) => Math.cos(!angleMode ? a : a * DEGTORAD);
	$.tan = (a) => Math.tan(!angleMode ? a : a * DEGTORAD);

	$.asin = (x) => {
		let a = Math.asin(x);
		return !angleMode ? a : a * RADTODEG;
	};
	$.acos = (x) => {
		let a = Math.acos(x);
		return !angleMode ? a : a * RADTODEG;
	};
	$.atan = (x) => {
		let a = Math.atan(x);
		return !angleMode ? a : a * RADTODEG;
	};
	$.atan2 = (y, x) => {
		let a = Math.atan2(y, x);
		return !angleMode ? a : a * RADTODEG;
	};

	function lcg() {
		const m = 4294967296;
		const a = 1664525;
		const c = 1013904223;
		let seed, z;
		return {
			setSeed(val) {
				z = seed = (val == null ? Math.random() * m : val) >>> 0;
			},
			getSeed() {
				return seed;
			},
			rand() {
				z = (a * z + c) % m;
				return z / m;
			}
		};
	}

	function shr3() {
		let jsr, seed;
		let m = 4294967295;
		return {
			setSeed(val) {
				jsr = seed = (val == null ? Math.random() * m : val) >>> 0;
			},
			getSeed() {
				return seed;
			},
			rand() {
				jsr ^= jsr << 17;
				jsr ^= jsr >> 13;
				jsr ^= jsr << 5;
				return (jsr >>> 0) / m;
			}
		};
	}

	let rng1 = shr3();
	rng1.setSeed();

	$.randomSeed = (seed) => rng1.setSeed(seed);
	$.random = (a, b) => {
		if (a === undefined) return rng1.rand();
		if (typeof a == 'number') {
			if (b !== undefined) {
				return rng1.rand() * (b - a) + a;
			} else {
				return rng1.rand() * a;
			}
		} else {
			return a[Math.trunc(a.length * rng1.rand())];
		}
	};

	$.randomGenerator = (method) => {
		if (method == $.LCG) rng1 = lcg();
		else if (method == $.SHR3) rng1 = shr3();
		rng1.setSeed();
	};

	var ziggurat = new (function () {
		var iz;
		var jz;
		var kn = new Array(128);
		var ke = new Array(256);
		var hz;
		var wn = new Array(128);
		var fn = new Array(128);
		var we = new Array(256);
		var fe = new Array(256);
		var SHR3 = () => {
			return rng1.rand() * 4294967296 - 2147483648;
		};
		var UNI = () => {
			return 0.5 + (SHR3() << 0) * 0.2328306e-9;
		};

		var RNOR = () => {
			hz = SHR3();
			iz = hz & 127;
			return Math.abs(hz) < kn[iz] ? hz * wn[iz] : nfix();
		};
		var REXP = () => {
			jz = SHR3() >>> 0;
			iz = jz & 255;
			return jz < kn[iz] ? jz * we[iz] : efix();
		};
		var nfix = () => {
			var r = 3.44262;
			var x, y;
			var u1, u2;
			for (;;) {
				x = hz * wn[iz];
				if (iz == 0) {
					do {
						u1 = UNI();
						u2 = UNI();
						x = -Math.log(u1) * 0.2904764;
						y = -Math.log(u2);
					} while (y + y < x * x);
					return hz > 0 ? r + x : -r - x;
				}

				if (fn[iz] + UNI() * (fn[iz - 1] - fn[iz]) < Math.exp(-0.5 * x * x)) {
					return x;
				}
				hz = SHR3();
				iz = hz & 127;
				if (Math.abs(hz) < kn[iz]) {
					return hz * wn[iz];
				}
			}
		};
		var efix = () => {
			var x;
			for (;;) {
				if (iz == 0) {
					return 7.69711 - Math.log(UNI());
				}
				x = jz * we[iz];
				if (fe[iz] + UNI() * (fe[iz - 1] - fe[iz]) < Math.exp(-x)) {
					return x;
				}
				jz = SHR3();
				iz = jz & 255;
				if (jz < ke[iz]) {
					return jz * we[iz];
				}
			}
		};

		var zigset = () => {
			var m1 = 2147483648;
			var m2 = 4294967296;
			var dn = 3.442619855899;
			var tn = dn;
			var vn = 9.91256303526217e-3;
			var q;
			var de = 7.697117470131487;
			var te = de;
			var ve = 3.949659822581572e-3;
			var i;

			/* Tables for RNOR */
			q = vn / Math.exp(-0.5 * dn * dn);
			kn[0] = Math.floor((dn / q) * m1);
			kn[1] = 0;
			wn[0] = q / m1;
			wn[127] = dn / m1;
			fn[0] = 1;
			fn[127] = Math.exp(-0.5 * dn * dn);
			for (i = 126; i >= 1; i--) {
				dn = Math.sqrt(-2 * Math.log(vn / dn + Math.exp(-0.5 * dn * dn)));
				kn[i + 1] = Math.floor((dn / tn) * m1);
				tn = dn;
				fn[i] = Math.exp(-0.5 * dn * dn);
				wn[i] = dn / m1;
			}
			/*Tables for REXP */
			q = ve / Math.exp(-de);
			ke[0] = Math.floor((de / q) * m2);
			ke[1] = 0;
			we[0] = q / m2;
			we[255] = de / m2;
			fe[0] = 1;
			fe[255] = Math.exp(-de);
			for (i = 254; i >= 1; i--) {
				de = -Math.log(ve / de + Math.exp(-de));
				ke[i + 1] = Math.floor((de / te) * m2);
				te = de;
				fe[i] = Math.exp(-de);
				we[i] = de / m2;
			}
		};
		this.SHR3 = SHR3;
		this.UNI = UNI;
		this.RNOR = RNOR;
		this.REXP = REXP;
		this.zigset = zigset;
	})();
	ziggurat.hasInit = false;

	$.randomGaussian = (mean, std) => {
		if (!ziggurat.hasInit) {
			ziggurat.zigset();
			ziggurat.hasInit = true;
		}
		return ziggurat.RNOR() * std + mean;
	};

	$.randomExponential = () => {
		if (!ziggurat.hasInit) {
			ziggurat.zigset();
			ziggurat.hasInit = true;
		}
		return ziggurat.REXP();
	};

	$.PERLIN = 'perlin';
	$.SIMPLEX = 'simplex';
	$.BLOCKY = 'blocky';

	$.Noise = Q5.PerlinNoise;
	let _noise;

	$.noiseMode = (mode) => {
		q.Noise = Q5[mode[0].toUpperCase() + mode.slice(1) + 'Noise'];
		_noise = null;
	};

	$.noiseSeed = (seed) => {
		_noise = new $.Noise(seed);
	};

	$.noise = (x = 0, y = 0, z = 0) => {
		_noise ??= new $.Noise();
		return _noise.noise(x, y, z);
	};

	$.noiseDetail = (lod, falloff) => {
		_noise ??= new $.Noise();
		if (lod > 0) _noise.octaves = lod;
		if (falloff > 0) _noise.falloff = falloff;
	};
};

Q5.Noise = class {};

Q5.PerlinNoise = class extends Q5.Noise {
	constructor(seed) {
		super();
		this.grad3 = [
			[1, 1, 0],
			[-1, 1, 0],
			[1, -1, 0],
			[-1, -1, 0],
			[1, 0, 1],
			[-1, 0, 1],
			[1, 0, -1],
			[-1, 0, -1],
			[0, 1, 1],
			[0, -1, 1],
			[0, 1, -1],
			[0, -1, -1]
		];
		this.octaves = 1;
		this.falloff = 0.5;
		if (seed == undefined) {
			this.p = Array.from({ length: 256 }, () => Math.floor(Math.random() * 256));
		} else {
			this.p = this.seedPermutation(seed);
		}
		this.p = this.p.concat(this.p);
	}

	seedPermutation(seed) {
		let p = [];
		for (let i = 0; i < 256; i++) {
			p[i] = i;
		}

		let n, q;
		for (let i = 255; i > 0; i--) {
			seed = (seed * 16807) % 2147483647;
			n = seed % (i + 1);
			q = p[i];
			p[i] = p[n];
			p[n] = q;
		}

		return p;
	}

	dot(g, x, y, z) {
		return g[0] * x + g[1] * y + g[2] * z;
	}

	mix(a, b, t) {
		return (1 - t) * a + t * b;
	}

	fade(t) {
		return t * t * t * (t * (t * 6 - 15) + 10);
	}

	noise(x, y, z) {
		let t = this;
		let total = 0;
		let freq = 1;
		let amp = 1;
		let maxAmp = 0;

		for (let i = 0; i < t.octaves; i++) {
			const X = Math.floor(x * freq) & 255;
			const Y = Math.floor(y * freq) & 255;
			const Z = Math.floor(z * freq) & 255;

			const xf = x * freq - Math.floor(x * freq);
			const yf = y * freq - Math.floor(y * freq);
			const zf = z * freq - Math.floor(z * freq);

			const u = t.fade(xf);
			const v = t.fade(yf);
			const w = t.fade(zf);

			const A = t.p[X] + Y;
			const AA = t.p[A] + Z;
			const AB = t.p[A + 1] + Z;
			const B = t.p[X + 1] + Y;
			const BA = t.p[B] + Z;
			const BB = t.p[B + 1] + Z;

			const lerp1 = t.mix(t.dot(t.grad3[t.p[AA] % 12], xf, yf, zf), t.dot(t.grad3[t.p[BA] % 12], xf - 1, yf, zf), u);
			const lerp2 = t.mix(
				t.dot(t.grad3[t.p[AB] % 12], xf, yf - 1, zf),
				t.dot(t.grad3[t.p[BB] % 12], xf - 1, yf - 1, zf),
				u
			);
			const lerp3 = t.mix(
				t.dot(t.grad3[t.p[AA + 1] % 12], xf, yf, zf - 1),
				t.dot(t.grad3[t.p[BA + 1] % 12], xf - 1, yf, zf - 1),
				u
			);
			const lerp4 = t.mix(
				t.dot(t.grad3[t.p[AB + 1] % 12], xf, yf - 1, zf - 1),
				t.dot(t.grad3[t.p[BB + 1] % 12], xf - 1, yf - 1, zf - 1),
				u
			);

			const mix1 = t.mix(lerp1, lerp2, v);
			const mix2 = t.mix(lerp3, lerp4, v);

			total += t.mix(mix1, mix2, w) * amp;

			maxAmp += amp;
			amp *= t.falloff;
			freq *= 2;
		}

		return (total / maxAmp + 1) / 2;
	}
};
Q5.modules.sound = ($, q) => {
	$.Sound = Q5.Sound;

	let sounds = [];

	$.loadSound = (path, cb) => {
		q._preloadCount++;
		let s = new Q5.Sound(path, cb);
		s.crossOrigin = 'Anonymous';
		s.addEventListener('canplaythrough', () => {
			if (!s.loaded) {
				q._preloadCount--;
				s.loaded = true;
				if (Q5.aud) s.init();
				if (cb) cb(s);
			}
		});
		sounds.push(s);
		return s;
	};
	$.getAudioContext = () => Q5.aud;
	$.userStartAudio = () => {
		if (window.AudioContext) {
			if (!Q5.aud) {
				Q5.aud = new window.AudioContext();
				for (let s of sounds) s.init();
			}
			return Q5.aud.resume();
		}
	};
};

if (window.Audio) {
	Q5.Sound ??= class extends Audio {
		init() {
			let s = this;
			s.panner = Q5.aud.createStereoPanner();
			s.source = Q5.aud.createMediaElementSource(s);
			s.source.connect(s.panner);
			s.panner.connect(Q5.aud.destination);
			let pan = s.pan;
			Object.defineProperty(s, 'pan', {
				get: () => s.panner.pan.value,
				set: (v) => (s.panner.pan.value = v)
			});
			if (pan) s.pan = pan;
		}
		setVolume(level) {
			this.volume = level;
		}
		setLoop(loop) {
			this.loop = loop;
		}
		setPan(value) {
			this.pan = value;
		}
		isLoaded() {
			return this.loaded;
		}
		isPlaying() {
			return !this.paused;
		}
	};
}
Q5.modules.util = ($, q) => {
	$._loadFile = (path, cb, type) => {
		q._preloadCount++;
		let ret = {};
		fetch(path)
			.then((r) => {
				if (type == 'json') return r.json();
				return r.text();
			})
			.then((r) => {
				q._preloadCount--;
				if (type == 'csv') r = $.CSV.parse(r);
				Object.assign(ret, r);
				if (cb) cb(r);
			});
		return ret;
	};

	$.loadText = (path, cb) => $._loadFile(path, cb, 'text');
	$.loadJSON = (path, cb) => $._loadFile(path, cb, 'json');
	$.loadCSV = (path, cb) => $._loadFile(path, cb, 'csv');

	$.CSV = {};
	$.CSV.parse = (csv, sep = ',', lineSep = '\n') => {
		if (!csv.length) return [];
		let a = [],
			lns = csv.split(lineSep),
			headers = lns[0].split(sep).map((h) => h.replaceAll('"', ''));
		for (let i = 1; i < lns.length; i++) {
			let o = {},
				ln = lns[i].split(sep);
			headers.forEach((h, i) => (o[h] = JSON.parse(ln[i])));
			a.push(o);
		}
		return a;
	};

	if (typeof localStorage == 'object') {
		$.storeItem = localStorage.setItem;
		$.getItem = localStorage.getItem;
		$.removeItem = localStorage.removeItem;
		$.clearStorage = localStorage.clear;
	}

	$.year = () => new Date().getFullYear();
	$.day = () => new Date().getDay();
	$.hour = () => new Date().getHours();
	$.minute = () => new Date().getMinutes();
	$.second = () => new Date().getSeconds();
};
Q5.modules.vector = ($) => {
	$.createVector = (x, y, z) => new Q5.Vector(x, y, z, $);
};

Q5.Vector = class {
	constructor(x, y, z, $) {
		this.x = x || 0;
		this.y = y || 0;
		this.z = z || 0;
		this._$ = $ || window;
		this._cn = null;
		this._cnsq = null;
	}

	set(x, y, z) {
		this.x = x?.x || x || 0;
		this.y = x?.y || y || 0;
		this.z = x?.z || z || 0;
		return this;
	}

	copy() {
		return new Q5.Vector(this.x, this.y, this.z);
	}

	_arg2v(x, y, z) {
		if (x?.x !== undefined) return x;
		if (y !== undefined) {
			return { x, y, z: z || 0 };
		}
		return { x: x, y: x, z: x };
	}

	_calcNorm() {
		this._cnsq = this.x * this.x + this.y * this.y + this.z * this.z;
		this._cn = Math.sqrt(this._cnsq);
	}

	add() {
		let u = this._arg2v(...arguments);
		this.x += u.x;
		this.y += u.y;
		this.z += u.z;
		return this;
	}

	rem() {
		let u = this._arg2v(...arguments);
		this.x %= u.x;
		this.y %= u.y;
		this.z %= u.z;
		return this;
	}

	sub() {
		let u = this._arg2v(...arguments);
		this.x -= u.x;
		this.y -= u.y;
		this.z -= u.z;
		return this;
	}

	mult() {
		let u = this._arg2v(...arguments);
		this.x *= u.x;
		this.y *= u.y;
		this.z *= u.z;
		return this;
	}

	div() {
		let u = this._arg2v(...arguments);
		if (u.x) this.x /= u.x;
		else this.x = 0;
		if (u.y) this.y /= u.y;
		else this.y = 0;
		if (u.z) this.z /= u.z;
		else this.z = 0;
		return this;
	}

	mag() {
		this._calcNorm();
		return this._cn;
	}

	magSq() {
		this._calcNorm();
		return this._cnsq;
	}

	dot() {
		let u = this._arg2v(...arguments);
		return this.x * u.x + this.y * u.y + this.z * u.z;
	}

	dist() {
		let u = this._arg2v(...arguments);
		let x = this.x - u.x;
		let y = this.y - u.y;
		let z = this.z - u.z;
		return Math.sqrt(x * x + y * y + z * z);
	}

	cross() {
		let u = this._arg2v(...arguments);
		let x = this.y * u.z - this.z * u.y;
		let y = this.z * u.x - this.x * u.z;
		let z = this.x * u.y - this.y * u.x;
		this.x = x;
		this.y = y;
		this.z = z;
		return this;
	}

	normalize() {
		this._calcNorm();
		let n = this._cn;
		if (n != 0) {
			this.x /= n;
			this.y /= n;
			this.z /= n;
		}
		this._cn = 1;
		this._cnsq = 1;
		return this;
	}

	limit(m) {
		this._calcNorm();
		let n = this._cn;
		if (n > m) {
			let t = m / n;
			this.x *= t;
			this.y *= t;
			this.z *= t;
			this._cn = m;
			this._cnsq = m * m;
		}
		return this;
	}

	setMag(m) {
		this._calcNorm();
		let n = this._cn;
		let t = m / n;
		this.x *= t;
		this.y *= t;
		this.z *= t;
		this._cn = m;
		this._cnsq = m * m;
		return this;
	}

	heading() {
		return this._$.atan2(this.y, this.x);
	}

	setHeading(ang) {
		let mag = this.mag();
		this.x = mag * this._$.cos(ang);
		this.y = mag * this._$.sin(ang);
		return this;
	}

	rotate(ang) {
		let costh = this._$.cos(ang);
		let sinth = this._$.sin(ang);
		let vx = this.x * costh - this.y * sinth;
		let vy = this.x * sinth + this.y * costh;
		this.x = vx;
		this.y = vy;
		return this;
	}

	angleBetween() {
		let u = this._arg2v(...arguments);
		let o = Q5.Vector.cross(this, u);
		let ang = this._$.atan2(o.mag(), this.dot(u));
		return ang * Math.sign(o.z || 1);
	}

	lerp() {
		let args = [...arguments];
		let amt = args.at(-1);
		if (amt == 0) return this;
		let u = this._arg2v(...args.slice(0, -1));
		this.x += (u.x - this.x) * amt;
		this.y += (u.y - this.y) * amt;
		this.z += (u.z - this.z) * amt;
		return this;
	}

	slerp() {
		let args = [...arguments];
		let amt = args.at(-1);
		if (amt == 0) return this;
		let u = this._arg2v(...args.slice(0, -1));
		if (amt == 1) return this.set(u);

		let v0Mag = this.mag();
		let v1Mag = u.mag();

		if (v0Mag == 0 || v1Mag == 0) {
			return this.mult(1 - amt).add(u.mult(amt));
		}

		let axis = Q5.Vector.cross(this, u);
		let axisMag = axis.mag();
		let theta = Math.atan2(axisMag, this.dot(u));

		if (axisMag > 0) {
			axis.div(axisMag);
		} else if (theta < this._$.HALF_PI) {
			return this.mult(1 - amt).add(u.mult(amt));
		} else {
			if (this.z == 0 && u.z == 0) axis.set(0, 0, 1);
			else if (this.x != 0) axis.set(this.y, -this.x, 0).normalize();
			else axis.set(1, 0, 0);
		}

		let ey = axis.cross(this);
		let lerpedMagFactor = 1 - amt + (amt * v1Mag) / v0Mag;
		let cosMultiplier = lerpedMagFactor * Math.cos(amt * theta);
		let sinMultiplier = lerpedMagFactor * Math.sin(amt * theta);

		this.x = this.x * cosMultiplier + ey.x * sinMultiplier;
		this.y = this.y * cosMultiplier + ey.y * sinMultiplier;
		this.z = this.z * cosMultiplier + ey.z * sinMultiplier;
		return this;
	}

	reflect(n) {
		n.normalize();
		return this.sub(n.mult(2 * this.dot(n)));
	}

	array() {
		return [this.x, this.y, this.z];
	}

	equals(u, epsilon) {
		epsilon ??= Number.EPSILON || 0;
		return Math.abs(u.x - this.x) < epsilon && Math.abs(u.y - this.y) < epsilon && Math.abs(u.z - this.z) < epsilon;
	}

	fromAngle(th, l) {
		if (l === undefined) l = 1;
		this._cn = l;
		this._cnsq = l * l;
		this.x = l * this._$.cos(th);
		this.y = l * this._$.sin(th);
		this.z = 0;
		return this;
	}

	fromAngles(th, ph, l) {
		if (l === undefined) l = 1;
		this._cn = l;
		this._cnsq = l * l;
		const cosph = this._$.cos(ph);
		const sinph = this._$.sin(ph);
		const costh = this._$.cos(th);
		const sinth = this._$.sin(th);
		this.x = l * sinth * sinph;
		this.y = -l * costh;
		this.z = l * sinth * cosph;
		return this;
	}

	random2D() {
		this._cn = this._cnsq = 1;
		return this.fromAngle(Math.random() * Math.PI * 2);
	}

	random3D() {
		this._cn = this._cnsq = 1;
		return this.fromAngles(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
	}

	toString() {
		return `[${this.x}, ${this.y}, ${this.z}]`;
	}
};

Q5.Vector.add = (v, u) => v.copy().add(u);
Q5.Vector.cross = (v, u) => v.copy().cross(u);
Q5.Vector.dist = (v, u) => Math.hypot(v.x - u.x, v.y - u.y, v.z - u.z);
Q5.Vector.div = (v, u) => v.copy().div(u);
Q5.Vector.dot = (v, u) => v.copy().dot(u);
Q5.Vector.equals = (v, u, epsilon) => v.equals(u, epsilon);
Q5.Vector.lerp = (v, u, amt) => v.copy().lerp(u, amt);
Q5.Vector.slerp = (v, u, amt) => v.copy().slerp(u, amt);
Q5.Vector.limit = (v, m) => v.copy().limit(m);
Q5.Vector.heading = (v) => this._$.atan2(v.y, v.x);
Q5.Vector.magSq = (v) => v.x * v.x + v.y * v.y + v.z * v.z;
Q5.Vector.mag = (v) => Math.sqrt(Q5.Vector.magSq(v));
Q5.Vector.mult = (v, u) => v.copy().mult(u);
Q5.Vector.normalize = (v) => v.copy().normalize();
Q5.Vector.rem = (v, u) => v.copy().rem(u);
Q5.Vector.sub = (v, u) => v.copy().sub(u);

for (let k of ['fromAngle', 'fromAngles', 'random2D', 'random3D']) {
	Q5.Vector[k] = (u, v, t) => new Q5.Vector()[k](u, v, t);
}
/**
 * q5-webgpu
 *
 * EXPERIMENTAL, for developer testing only!
 */
Q5.renderers.webgpu = {};

Q5.renderers.webgpu.canvas = ($, q) => {
	let c = $.canvas;

	c.width = $.width = 500;
	c.height = $.height = 500;

	// q2d graphics context
	$._g = $.createGraphics(1, 1);

	if ($.colorMode) $.colorMode('rgb', 1);

	let pass,
		mainView,
		colorIndex = 1,
		colorStackIndex = 8;

	$._pipelineConfigs = [];
	$._pipelines = [];

	// local variables used for slightly better performance
	// stores pipeline shifts and vertex counts/image indices
	let drawStack = ($.drawStack = []);

	// colors used for each draw call
	let colorStack = ($.colorStack = new Float32Array(1e6));

	// prettier-ignore
	colorStack.set([
		0, 0, 0, 1, // black
		1, 1, 1, 1 // white
	]);

	let mainLayout = Q5.device.createBindGroupLayout({
		label: 'mainLayout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX,
				buffer: { type: 'uniform' }
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX,
				buffer: { type: 'read-only-storage' }
			},
			{
				binding: 2,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: 'read-only-storage' }
			}
		]
	});

	$.bindGroupLayouts = [mainLayout];

	let uniformBuffer = Q5.device.createBuffer({
		size: 8, // Size of two floats
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});

	let createMainView = () => {
		mainView = Q5.device
			.createTexture({
				size: [$.canvas.width, $.canvas.height],
				sampleCount: 4,
				format: 'bgra8unorm',
				usage: GPUTextureUsage.RENDER_ATTACHMENT
			})
			.createView();
	};

	$._createCanvas = (w, h, opt) => {
		q.ctx = q.drawingContext = c.getContext('webgpu');

		opt.format ??= navigator.gpu.getPreferredCanvasFormat();
		opt.device ??= Q5.device;
		if (opt.alpha) opt.alphaMode = 'premultiplied';

		$.ctx.configure(opt);

		Q5.device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([$.canvas.hw, $.canvas.hh]));

		createMainView();
		return c;
	};

	$._resizeCanvas = (w, h) => {
		$._setCanvasSize(w, h);
		createMainView();
	};

	$.pixelDensity = (v) => {
		if (!v || v == $._pixelDensity) return $._pixelDensity;
		$._pixelDensity = v;
		$._setCanvasSize(c.w, c.h);
		createMainView();
		return v;
	};

	// current color index, used to associate a vertex with a color
	let addColor = (r, g, b, a = 1) => {
		if (typeof r == 'string') r = $.color(r);
		else if (b == undefined) {
			// grayscale mode `fill(1, 0.5)`
			a = g ?? 1;
			g = b = r;
		}
		if (r._q5Color) {
			a = r.a;
			b = r.b;
			g = r.g;
			r = r.r;
		}

		let cs = colorStack,
			i = colorStackIndex;
		cs[i++] = r;
		cs[i++] = g;
		cs[i++] = b;
		cs[i++] = a;
		colorStackIndex = i;

		colorIndex++;
	};

	$._stroke = 0;
	$._fill = $._tint = $._globalAlpha = 1;
	$._doFill = $._doStroke = true;

	$.fill = (r, g, b, a) => {
		addColor(r, g, b, a);
		$._doFill = $._fillSet = true;
		$._fill = colorIndex;
	};
	$.stroke = (r, g, b, a) => {
		addColor(r, g, b, a);
		$._doStroke = $._strokeSet = true;
		$._stroke = colorIndex;
	};
	$.tint = (r, g, b, a) => {
		addColor(r, g, b, a);
		$._tint = colorIndex;
	};
	$.opacity = (a) => ($._globalAlpha = a);

	$.noFill = () => ($._doFill = false);
	$.noStroke = () => ($._doStroke = false);
	$.noTint = () => ($._tint = 1);

	$._strokeWeight = 1;
	$.strokeWeight = (v) => ($._strokeWeight = Math.abs(v));

	const MAX_TRANSFORMS = 1e7, // or whatever maximum you need
		MATRIX_SIZE = 16, // 4×4 matrix
		transforms = new Float32Array(MAX_TRANSFORMS * MATRIX_SIZE);

	let matrix,
		matrices = [],
		matricesIndexStack = [];

	// tracks if the matrix has been modified
	$._matrixDirty = false;

	// initialize with a 4×4 identity matrix
	// prettier-ignore
	matrices.push([
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1
	]);

	transforms.set(matrices[0]);

	$.resetMatrix = () => {
		matrix = matrices[0].slice();
		$._matrixIndex = 0;
	};
	$.resetMatrix();

	$.translate = (x, y, z) => {
		if (!x && !y && !z) return;
		// update the translation values
		matrix[12] += x;
		matrix[13] -= y;
		matrix[14] += z || 0;
		$._matrixDirty = true;
	};

	$.rotate = (a) => {
		if (!a) return;
		if ($._angleMode) a *= $._DEGTORAD;

		let cosR = Math.cos(a),
			sinR = Math.sin(a),
			m = matrix,
			m0 = m[0],
			m1 = m[1],
			m4 = m[4],
			m5 = m[5];

		// if identity matrix, just set the rotation values
		if (m0 == 1 && !m1 && !m4 && m5 == 1) {
			m[0] = cosR;
			m[1] = -sinR;
			m[4] = sinR;
			m[5] = cosR;
		} else {
			// combine the current rotation with the new rotation
			m[0] = m0 * cosR + m1 * sinR;
			m[1] = m1 * cosR - m0 * sinR;
			m[4] = m4 * cosR + m5 * sinR;
			m[5] = m5 * cosR - m4 * sinR;
		}

		$._matrixDirty = true;
	};

	$.scale = (x = 1, y, z = 1) => {
		y ??= x;

		$._scale = Math.max(Math.abs(x), Math.abs(y));
		$._scaledSW = $._strokeWeight * $._scale;

		let m = matrix;

		m[0] *= x;
		m[1] *= x;
		m[2] *= x;
		m[3] *= x;
		m[4] *= y;
		m[5] *= y;
		m[6] *= y;
		m[7] *= y;
		m[8] *= z;
		m[9] *= z;
		m[10] *= z;
		m[11] *= z;

		$._matrixDirty = true;
	};

	$.shearX = (ang) => {
		if (!ang) return;
		if ($._angleMode) ang *= $._DEGTORAD;

		let tanAng = Math.tan(ang),
			m = matrix,
			m0 = m[0],
			m1 = m[1],
			m4 = m[4],
			m5 = m[5];

		m[0] = m0 + m4 * tanAng;
		m[1] = m1 + m5 * tanAng;

		$._matrixDirty = true;
	};

	$.shearY = (ang) => {
		if (!ang) return;
		if ($._angleMode) ang *= $._DEGTORAD;

		let tanAng = Math.tan(ang),
			m = matrix,
			m0 = m[0],
			m1 = m[1],
			m4 = m[4],
			m5 = m[5];

		m[4] = m4 + m0 * tanAng;
		m[5] = m5 + m1 * tanAng;

		$._matrixDirty = true;
	};

	$.applyMatrix = (...args) => {
		let m;
		if (args.length == 1) m = args[0];
		else m = args;

		if (m.length == 9) {
			// convert 3×3 matrix to 4×4 matrix
			m = [m[0], m[1], 0, m[2], m[3], m[4], 0, m[5], 0, 0, 1, 0, m[6], m[7], 0, m[8]];
		} else if (m.length != 16) {
			throw new Error('Matrix must be a 3×3 or 4×4 array.');
		}

		// overwrite the current transformation matrix
		matrix = m.slice();
		$._matrixDirty = true;
	};

	// function to save the current matrix state if dirty
	$._saveMatrix = () => {
		transforms.set(matrix, matrices.length * MATRIX_SIZE);
		$._matrixIndex = matrices.length;
		matrices.push(matrix.slice());
		$._matrixDirty = false;
	};

	// push the current matrix index onto the stack
	$.pushMatrix = () => {
		if ($._matrixDirty) $._saveMatrix();
		matricesIndexStack.push($._matrixIndex);
	};

	$.popMatrix = () => {
		if (!matricesIndexStack.length) {
			return console.warn('Matrix index stack is empty!');
		}
		// pop the last matrix index and set it as the current matrix index
		let idx = matricesIndexStack.pop();
		matrix = matrices[idx].slice();
		$._matrixIndex = idx;
		$._matrixDirty = false;
	};

	$.push = () => {
		$.pushMatrix();
		$.pushStyles();
	};

	$.pop = () => {
		$.popMatrix();
		$.popStyles();
	};

	$._calcBox = (x, y, w, h, mode) => {
		let hw = w / 2;
		let hh = h / 2;

		// left, right, top, bottom
		let l, r, t, b;
		if (!mode || mode == 'corner') {
			l = x;
			r = x + w;
			t = -y;
			b = -(y + h);
		} else if (mode == 'center') {
			l = x - hw;
			r = x + hw;
			t = -(y - hh);
			b = -(y + hh);
		} else {
			// CORNERS
			l = x;
			r = w;
			t = -y;
			b = -h;
		}

		return [l, r, t, b];
	};

	// prettier-ignore
	let blendFactors = [
			'zero',                // 0
			'one',                 // 1
			'src-alpha',           // 2
			'one-minus-src-alpha', // 3
			'dst',                 // 4
			'dst-alpha',           // 5
			'one-minus-dst-alpha', // 6
			'one-minus-src'        // 7
	];
	let blendOps = [
		'add', // 0
		'subtract', // 1
		'reverse-subtract', // 2
		'min', // 3
		'max' // 4
	];

	// other blend modes are not supported yet
	const blendModes = {
		normal: [2, 3, 0, 2, 3, 0],
		// destination_over: [6, 1, 0, 6, 1, 0],
		additive: [1, 1, 0, 1, 1, 0]
		// source_in: [5, 0, 0, 5, 0, 0],
		// destination_in: [0, 2, 0, 0, 2, 0],
		// source_out: [6, 0, 0, 6, 0, 0],
		// destination_out: [0, 3, 0, 0, 3, 0],
		// source_atop: [5, 3, 0, 5, 3, 0],
		// destination_atop: [6, 2, 0, 6, 2, 0]
	};

	$.blendConfigs = {};

	for (const [name, mode] of Object.entries(blendModes)) {
		$.blendConfigs[name] = {
			color: {
				srcFactor: blendFactors[mode[0]],
				dstFactor: blendFactors[mode[1]],
				operation: blendOps[mode[2]]
			},
			alpha: {
				srcFactor: blendFactors[mode[3]],
				dstFactor: blendFactors[mode[4]],
				operation: blendOps[mode[5]]
			}
		};
	}

	$._blendMode = 'normal';

	$.blendMode = (mode) => {
		if (mode == $._blendMode) return;
		if (mode == 'source-over') mode = 'normal';
		if (mode == 'lighter') mode = 'additive';
		mode = mode.toLowerCase().replace(/[ -]/g, '_');
		$._blendMode = mode;

		for (let i = 0; i < $._pipelines.length; i++) {
			$._pipelineConfigs[i].fragment.targets[0].blend = $.blendConfigs[mode];
			$._pipelines[i] = Q5.device.createRenderPipeline($._pipelineConfigs[i]);
		}
	};

	$.clear = () => {};

	$._beginRender = () => {
		$.encoder = Q5.device.createCommandEncoder();

		pass = q.pass = $.encoder.beginRenderPass({
			label: 'q5-webgpu',
			colorAttachments: [
				{
					view: mainView,
					resolveTarget: $.ctx.getCurrentTexture().createView(),
					loadOp: 'clear',
					storeOp: 'store',
					clearValue: [0, 0, 0, 0]
				}
			]
		});
	};

	$._render = () => {
		let transformBuffer = Q5.device.createBuffer({
			size: matrices.length * MATRIX_SIZE * 4, // 4 bytes per float
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});

		new Float32Array(transformBuffer.getMappedRange()).set(transforms.slice(0, matrices.length * MATRIX_SIZE));
		transformBuffer.unmap();

		let colorsBuffer = Q5.device.createBuffer({
			size: colorStackIndex * 4,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});

		new Float32Array(colorsBuffer.getMappedRange()).set(colorStack.slice(0, colorStackIndex));
		colorsBuffer.unmap();

		let mainBindGroup = Q5.device.createBindGroup({
			layout: mainLayout,
			entries: [
				{ binding: 0, resource: { buffer: uniformBuffer } },
				{ binding: 1, resource: { buffer: transformBuffer } },
				{ binding: 2, resource: { buffer: colorsBuffer } }
			]
		});

		pass.setBindGroup(0, mainBindGroup);

		for (let m of $._hooks.preRender) m();

		let drawVertOffset = 0,
			imageVertOffset = 0,
			textCharOffset = 0,
			curPipelineIndex = -1;

		for (let i = 0; i < drawStack.length; i += 2) {
			let v = drawStack[i + 1];

			if (curPipelineIndex != drawStack[i]) {
				curPipelineIndex = drawStack[i];
				pass.setPipeline($._pipelines[curPipelineIndex]);
			}

			if (curPipelineIndex == 0) {
				// draw shapes
				// v is the number of vertices
				pass.draw(v, 1, drawVertOffset);
				drawVertOffset += v;
			} else if (curPipelineIndex == 1) {
				// draw images
				// v is the texture index
				pass.setBindGroup(1, $._textureBindGroups[v]);
				pass.draw(4, 1, imageVertOffset);
				imageVertOffset += 4;
			} else if (curPipelineIndex == 2) {
				// draw text
				let o = drawStack[i + 2];
				pass.setBindGroup(1, $._fonts[o].bindGroup);
				pass.setBindGroup(2, $._textBindGroup);

				// v is the number of characters in the text
				pass.draw(4, v, 0, textCharOffset);
				textCharOffset += v;
				i++;
			}
		}
	};

	$._finishRender = () => {
		pass.end();
		let commandBuffer = $.encoder.finish();
		Q5.device.queue.submit([commandBuffer]);

		q.pass = $.encoder = null;

		// clear the stacks for the next frame
		$.drawStack = drawStack = [];
		colorIndex = 1;
		colorStackIndex = 8;
		matrices = [matrices[0]];
		matricesIndexStack = [];

		for (let m of $._hooks.postRender) m();
	};
};

Q5.initWebGPU = async () => {
	if (!navigator.gpu) {
		console.warn('q5 WebGPU not supported on this browser! Use Google Chrome or Edge.');
		return false;
	}
	if (!Q5.device) {
		let adapter = await navigator.gpu.requestAdapter();
		if (!adapter) {
			console.warn('q5 WebGPU could not start! No appropriate GPUAdapter found, vulkan may need to be enabled.');
			return false;
		}
		Q5.device = await adapter.requestDevice();
	}
	return true;
};

Q5.webgpu = async function (scope, parent) {
	if (!scope || scope == 'global') Q5._hasGlobal = true;
	if (!(await Q5.initWebGPU())) {
		return new Q5(scope, parent, 'webgpu-fallback');
	}
	return new Q5(scope, parent, 'webgpu');
};
Q5.renderers.webgpu.drawing = ($, q) => {
	let c = $.canvas,
		drawStack = $.drawStack,
		vertexStack = new Float32Array(1e7),
		vertIndex = 0;

	let drawingShader = Q5.device.createShaderModule({
		label: 'drawingShader',
		code: `
struct Uniforms {
	halfWidth: f32,
	halfHeight: f32
}
struct VertexParams {
	@location(0) pos: vec2f,
	@location(1) colorIndex: f32,
	@location(2) matrixIndex: f32
}
struct FragmentParams {
	@builtin(position) position: vec4f,
	@location(0) color: vec4f
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage> transforms: array<mat4x4<f32>>;
@group(0) @binding(2) var<storage> colors : array<vec4f>;

@vertex
fn vertexMain(v: VertexParams) -> FragmentParams {
	var vert = vec4f(v.pos, 0.0, 1.0);
	vert = transforms[i32(v.matrixIndex)] * vert;
	vert.x /= uniforms.halfWidth;
	vert.y /= uniforms.halfHeight;

	var f: FragmentParams;
	f.position = vert;
	f.color = colors[i32(v.colorIndex)];
	return f;
}

@fragment
fn fragmentMain(@location(0) color: vec4f) -> @location(0) vec4f {
	return color;
}
`
	});

	let vertexBufferLayout = {
		arrayStride: 16, // 4 floats * 4 bytes
		attributes: [
			{ format: 'float32x2', offset: 0, shaderLocation: 0 }, // position
			{ format: 'float32', offset: 8, shaderLocation: 1 }, // colorIndex
			{ format: 'float32', offset: 12, shaderLocation: 2 } // matrixIndex
		]
	};

	let pipelineLayout = Q5.device.createPipelineLayout({
		label: 'drawingPipelineLayout',
		bindGroupLayouts: $.bindGroupLayouts
	});

	$._pipelineConfigs[0] = {
		label: 'drawingPipeline',
		layout: pipelineLayout,
		vertex: {
			module: drawingShader,
			entryPoint: 'vertexMain',
			buffers: [vertexBufferLayout]
		},
		fragment: {
			module: drawingShader,
			entryPoint: 'fragmentMain',
			targets: [{ format: 'bgra8unorm', blend: $.blendConfigs.normal }]
		},
		primitive: { topology: 'triangle-strip', stripIndexFormat: 'uint32' },
		multisample: { count: 4 }
	};

	$._pipelines[0] = Q5.device.createRenderPipeline($._pipelineConfigs[0]);

	const addVert = (x, y, ci, ti) => {
		let v = vertexStack,
			i = vertIndex;
		v[i++] = x;
		v[i++] = y;
		v[i++] = ci;
		v[i++] = ti;
		vertIndex = i;
	};

	const addRect = (x1, y1, x2, y2, x3, y3, x4, y4, ci, ti) => {
		let v = vertexStack,
			i = vertIndex;

		v[i++] = x1;
		v[i++] = y1;
		v[i++] = ci;
		v[i++] = ti;

		v[i++] = x2;
		v[i++] = y2;
		v[i++] = ci;
		v[i++] = ti;

		v[i++] = x4;
		v[i++] = y4;
		v[i++] = ci;
		v[i++] = ti;

		v[i++] = x3;
		v[i++] = y3;
		v[i++] = ci;
		v[i++] = ti;

		vertIndex = i;
		drawStack.push(0, 4);
	};

	const addEllipse = (x, y, a, b, n, ci, ti) => {
		y = -y;
		let t = 0,
			angleIncrement = $.TAU / n;

		let v = vertexStack,
			i = vertIndex;

		for (let j = 0; j <= n; j++) {
			// add center vertex
			v[i++] = x;
			v[i++] = y;
			v[i++] = ci;
			v[i++] = ti;

			// calculate perimeter vertex
			let vx = x + a * Math.cos(t);
			let vy = y + b * Math.sin(t);

			// add perimeter vertex
			v[i++] = vx;
			v[i++] = vy;
			v[i++] = ci;
			v[i++] = ti;

			t += angleIncrement;
		}

		// close the triangle strip
		// add center vertex
		v[i++] = x;
		v[i++] = y;
		v[i++] = ci;
		v[i++] = ti;

		// add first perimeter vertex
		v[i++] = x + a;
		v[i++] = y;
		v[i++] = ci;
		v[i++] = ti;

		vertIndex = i;
		drawStack.push(0, (n + 1) * 2 + 2);
	};

	const addEllipseStroke = (x, y, outerA, outerB, innerA, innerB, n, ci, ti) => {
		y = -y;
		let angleIncrement = $.TAU / n;
		let t = 0;

		let v = vertexStack,
			i = vertIndex;

		for (let j = 0; j <= n; j++) {
			// Outer vertex
			let vxOuter = x + outerA * Math.cos(t);
			let vyOuter = y + outerB * Math.sin(t);

			// Inner vertex
			let vxInner = x + innerA * Math.cos(t);
			let vyInner = y + innerB * Math.sin(t);

			// Add vertices for triangle strip
			v[i++] = vxOuter;
			v[i++] = vyOuter;
			v[i++] = ci;
			v[i++] = ti;

			v[i++] = vxInner;
			v[i++] = vyInner;
			v[i++] = ci;
			v[i++] = ti;

			t += angleIncrement;
		}

		vertIndex = i;
		drawStack.push(0, (n + 1) * 2); // Use triangle strip
	};

	$.rectMode = (x) => ($._rectMode = x);

	$.rect = (x, y, w, h) => {
		let [l, r, t, b] = $._calcBox(x, y, w, h, $._rectMode);
		let ci, ti;
		if ($._matrixDirty) $._saveMatrix();
		ti = $._matrixIndex;

		if ($._doFill) {
			ci = $._fill;
			addRect(l, t, r, t, r, b, l, b, ci, ti);
		}

		if ($._doStroke) {
			ci = $._stroke;
			let sw = $._strokeWeight / 2;

			// Calculate stroke positions
			let lsw = l - sw,
				rsw = r + sw,
				tsw = t + sw,
				bsw = b - sw,
				lpsw = l + sw,
				rpsw = r - sw,
				tpsw = t - sw,
				bpsw = b + sw;

			addRect(lsw, tpsw, rsw, tpsw, rsw, tsw, lsw, tsw, ci, ti); // Top
			addRect(lsw, bsw, rsw, bsw, rsw, bpsw, lsw, bpsw, ci, ti); // Bottom

			// Adjust side strokes to avoid overlapping corners
			tsw = t - sw;
			bsw = b + sw;

			addRect(lsw, tsw, lpsw, tsw, lpsw, bsw, lsw, bsw, ci, ti); // Left
			addRect(rpsw, tsw, rsw, tsw, rsw, bsw, rpsw, bsw, ci, ti); // Right
		}
	};

	$.square = (x, y, s) => $.rect(x, y, s, s);

	// prettier-ignore
	const getArcSegments = (d) =>
		d < 4 ? 6 :
		d < 6 ? 8 :
		d < 10 ? 10 :
		d < 16 ? 12 :
		d < 20 ? 14 :
		d < 22 ? 16 :
		d < 24 ? 18 :
		d < 28 ? 20 :
		d < 34 ? 22 :
		d < 42 ? 24 :
		d < 48 ? 26 :
		d < 56 ? 28 :
		d < 64 ? 30 :
		d < 72 ? 32 :
		d < 84 ? 34 :
		d < 96 ? 36 :
		d < 98 ? 38 :
		d < 113 ? 40 :
		d < 149 ? 44 :
		d < 199 ? 48 :
		d < 261 ? 52 :
		d < 353 ? 56 :
		d < 461 ? 60 :
		d < 585 ? 64 :
		d < 1200 ? 70 :
		d < 1800 ? 80 :
		d < 2400 ? 90 :
		100;

	$.ellipseMode = (x) => ($._ellipseMode = x);

	$.ellipse = (x, y, w, h) => {
		let n = getArcSegments(Math.max(Math.abs(w), Math.abs(h)) * $._scale);
		let a = w / 2;
		let b = w == h ? a : h / 2;

		if ($._matrixDirty) $._saveMatrix();
		let ti = $._matrixIndex;

		if ($._doFill) {
			addEllipse(x, y, a, b, n, $._fill, ti);
		}
		if ($._doStroke) {
			let sw = $._strokeWeight / 2;
			// Draw the stroke as a ring using triangle strips
			addEllipseStroke(x, y, a + sw, b + sw, a - sw, b - sw, n, $._stroke, ti);
		}
	};

	$.circle = (x, y, d) => $.ellipse(x, y, d, d);

	$.point = (x, y) => {
		if ($._matrixDirty) $._saveMatrix();
		let ti = $._matrixIndex,
			ci = $._stroke,
			sw = $._strokeWeight;

		if ($._scaledSW < 2) {
			let [l, r, t, b] = $._calcBox(x, y, sw, sw, 'corner');
			addRect(l, t, r, t, r, b, l, b, ci, ti);
		} else {
			let n = getArcSegments(sw);
			sw /= 2;
			addEllipse(x, y, sw, sw, n, ci, ti);
		}
	};

	$._strokeJoin = 'round';

	$.strokeJoin = (x) => {
		$._strokeJoin = x;
	};

	$.line = (x1, y1, x2, y2) => {
		if ($._matrixDirty) $._saveMatrix();
		let ti = $._matrixIndex,
			ci = $._stroke,
			sw = $._strokeWeight,
			hsw = sw / 2;

		// calculate the direction vector and length
		let dx = x2 - x1,
			dy = y2 - y1,
			length = Math.hypot(dx, dy);

		// calculate the perpendicular vector for line thickness
		let px = -(dy / length) * hsw,
			py = (dx / length) * hsw;

		addRect(x1 + px, -y1 - py, x1 - px, -y1 + py, x2 - px, -y2 + py, x2 + px, -y2 - py, ci, ti);

		if ($._scaledSW > 2 && $._strokeJoin != 'none') {
			let n = getArcSegments($._scaledSW);
			addEllipse(x1, y1, hsw, hsw, n, ci, ti);
			addEllipse(x2, y2, hsw, hsw, n, ci, ti);
		}
	};

	let shapeVertCount;
	let sv = []; // shape vertices
	let curveVertices = []; // curve vertices

	$.beginShape = () => {
		shapeVertCount = 0;
		sv = [];
		curveVertices = [];
	};

	$.vertex = (x, y) => {
		if ($._matrixDirty) $._saveMatrix();
		sv.push(x, -y, $._fill, $._matrixIndex);
		shapeVertCount++;
	};

	$.curveVertex = (x, y) => {
		if ($._matrixDirty) $._saveMatrix();
		curveVertices.push({ x: x, y: -y });
	};

	$.endShape = (close) => {
		if (curveVertices.length > 0) {
			// duplicate start and end points if necessary
			let points = [...curveVertices];
			if (points.length < 4) {
				// duplicate first and last points
				while (points.length < 4) {
					points.unshift(points[0]);
					points.push(points[points.length - 1]);
				}
			}

			for (let i = 0; i < points.length - 3; i++) {
				let p0 = points[i];
				let p1 = points[i + 1];
				let p2 = points[i + 2];
				let p3 = points[i + 3];

				for (let t = 0; t <= 1; t += 0.1) {
					let t2 = t * t;
					let t3 = t2 * t;

					let x =
						0.5 *
						(2 * p1.x +
							(-p0.x + p2.x) * t +
							(2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
							(-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

					let y =
						0.5 *
						(2 * p1.y +
							(-p0.y + p2.y) * t +
							(2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
							(-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

					sv.push(x, y, $._fill, $._matrixIndex);
					shapeVertCount++;
				}
			}
		}

		if (shapeVertCount < 3) {
			throw new Error('A shape must have at least 3 vertices.');
		}

		// close the shape if requested
		if (close) {
			let firstIndex = 0;
			let lastIndex = (shapeVertCount - 1) * 4;

			let firstX = sv[firstIndex];
			let firstY = sv[firstIndex + 1];
			let lastX = sv[lastIndex];
			let lastY = sv[lastIndex + 1];

			if (firstX !== lastX || firstY !== lastY) {
				sv.push(firstX, firstY, sv[firstIndex + 2], sv[firstIndex + 3]);
				shapeVertCount++;
			}
		}

		if ($._doFill) {
			if (shapeVertCount == 5) {
				// for quads, draw two triangles
				addVert(sv[0], sv[1], sv[2], sv[3]); // v0
				addVert(sv[4], sv[5], sv[6], sv[7]); // v1
				addVert(sv[12], sv[13], sv[14], sv[15]); // v3
				addVert(sv[8], sv[9], sv[10], sv[11]); // v2
				drawStack.push(0, 4);
			} else {
				// triangulate the shape
				for (let i = 1; i < shapeVertCount - 1; i++) {
					let v0 = 0;
					let v1 = i * 4;
					let v2 = (i + 1) * 4;

					addVert(sv[v0], sv[v0 + 1], sv[v0 + 2], sv[v0 + 3]);
					addVert(sv[v1], sv[v1 + 1], sv[v1 + 2], sv[v1 + 3]);
					addVert(sv[v2], sv[v2 + 1], sv[v2 + 2], sv[v2 + 3]);
				}
				drawStack.push(0, (shapeVertCount - 2) * 3);
			}
		}

		if ($._doStroke) {
			// draw lines between vertices
			for (let i = 0; i < shapeVertCount - 1; i++) {
				let v1 = i * 4;
				let v2 = (i + 1) * 4;
				$.line(sv[v1], -sv[v1 + 1], sv[v2], -sv[v2 + 1]);
			}
			if (close) {
				let v1 = (shapeVertCount - 1) * 4;
				let v2 = 0;
				$.line(sv[v1], -sv[v1 + 1], sv[v2], -sv[v2 + 1]);
			}
		}

		// reset for the next shape
		shapeVertCount = 0;
		sv = [];
		curveVertices = [];
	};

	$.triangle = (x1, y1, x2, y2, x3, y3) => {
		$.beginShape();
		$.vertex(x1, y1);
		$.vertex(x2, y2);
		$.vertex(x3, y3);
		$.endShape(true);
	};

	$.quad = (x1, y1, x2, y2, x3, y3, x4, y4) => {
		$.beginShape();
		$.vertex(x1, y1);
		$.vertex(x2, y2);
		$.vertex(x3, y3);
		$.vertex(x4, y4);
		$.endShape(true);
	};

	$.background = (r, g, b, a) => {
		let mi = $._matrixIndex;
		$._matrixIndex = 0;
		$._doStroke = false;
		if (r.src) {
			let img = r;
			let im = $._imageMode;
			$._imageMode = 'corner';
			$.image(img, -c.hw, -c.hh, c.w, c.h);
			$._imageMode = im;
		} else {
			let rm = $._rectMode;
			$._rectMode = 'corner';
			let fill = $._fill;
			$.fill(r, g, b, a);
			$.rect(-c.hw, -c.hh, c.w, c.h);
			$._rectMode = rm;
			$._fill = fill;
		}
		$._doStroke = true;
		$._matrixIndex = mi;
	};

	$._hooks.preRender.push(() => {
		$.pass.setPipeline($._pipelines[0]);

		let vertexBuffer = Q5.device.createBuffer({
			size: vertIndex * 4,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});

		new Float32Array(vertexBuffer.getMappedRange()).set(vertexStack.slice(0, vertIndex));
		vertexBuffer.unmap();

		$.pass.setVertexBuffer(0, vertexBuffer);
	});

	$._hooks.postRender.push(() => {
		drawStack = $.drawStack;
		vertIndex = 0;
	});
};
Q5.renderers.webgpu.image = ($, q) => {
	let vertexStack = new Float32Array(1e7),
		vertIndex = 0;

	let imageShader = Q5.device.createShaderModule({
		label: 'imageShader',
		code: `
struct Uniforms {
	halfWidth: f32,
	halfHeight: f32
}
struct VertexParams {
	@location(0) pos: vec2f,
	@location(1) texCoord: vec2f,
	@location(2) tintIndex: f32,
	@location(3) matrixIndex: f32,
	@location(4) globalAlpha: f32
}
struct FragmentParams {
	@builtin(position) position: vec4f,
	@location(0) texCoord: vec2f,
	@location(1) tintIndex: f32,
	@location(2) globalAlpha: f32
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage> transforms: array<mat4x4<f32>>;
@group(0) @binding(2) var<storage> colors : array<vec4f>;

@group(1) @binding(0) var samp: sampler;
@group(1) @binding(1) var texture: texture_2d<f32>;

@vertex
fn vertexMain(v: VertexParams) -> FragmentParams {
	var vert = vec4f(v.pos, 0.0, 1.0);
	vert = transforms[i32(v.matrixIndex)] * vert;
	vert.x /= uniforms.halfWidth;
	vert.y /= uniforms.halfHeight;

	var f: FragmentParams;
	f.position = vert;
	f.texCoord = v.texCoord;
	f.tintIndex = v.tintIndex;
	f.globalAlpha = v.globalAlpha;
	return f;
}

@fragment
fn fragmentMain(f: FragmentParams) -> @location(0) vec4f {
		let texColor = textureSample(texture, samp, f.texCoord);
		let tintColor = colors[i32(f.tintIndex)];
		
		// Mix original and tinted colors using tint alpha as blend factor
		let tinted = vec4f(texColor.rgb * tintColor.rgb, texColor.a * f.globalAlpha);
		return mix(texColor, tinted, tintColor.a);
}
	`
	});

	$._textureBindGroups = [];

	let textureLayout = Q5.device.createBindGroupLayout({
		label: 'textureLayout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: { type: 'filtering' }
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				texture: { viewDimension: '2d', sampleType: 'float' }
			}
		]
	});

	const vertexBufferLayout = {
		arrayStride: 28,
		attributes: [
			{ shaderLocation: 0, offset: 0, format: 'float32x2' },
			{ shaderLocation: 1, offset: 8, format: 'float32x2' },
			{ shaderLocation: 2, offset: 16, format: 'float32' }, // tintIndex
			{ shaderLocation: 3, offset: 20, format: 'float32' }, // matrixIndex
			{ shaderLocation: 4, offset: 24, format: 'float32' } // globalAlpha
		]
	};

	const pipelineLayout = Q5.device.createPipelineLayout({
		label: 'imagePipelineLayout',
		bindGroupLayouts: [...$.bindGroupLayouts, textureLayout]
	});

	$._pipelineConfigs[1] = {
		label: 'imagePipeline',
		layout: pipelineLayout,
		vertex: {
			module: imageShader,
			entryPoint: 'vertexMain',
			buffers: [{ arrayStride: 0, attributes: [] }, vertexBufferLayout]
		},
		fragment: {
			module: imageShader,
			entryPoint: 'fragmentMain',
			targets: [{ format: 'bgra8unorm', blend: $.blendConfigs.normal }]
		},
		primitive: { topology: 'triangle-strip', stripIndexFormat: 'uint32' },
		multisample: { count: 4 }
	};

	$._pipelines[1] = Q5.device.createRenderPipeline($._pipelineConfigs[1]);

	let sampler;

	let makeSampler = (filter) => {
		sampler = Q5.device.createSampler({
			magFilter: filter,
			minFilter: filter
		});
	};

	$.smooth = () => makeSampler('linear');
	$.noSmooth = () => makeSampler('nearest');

	$.smooth();

	let MAX_TEXTURES = 12000;

	$._textures = [];
	let tIdx = 0;

	$._createTexture = (img) => {
		if (img.canvas) img = img.canvas;

		let textureSize = [img.width, img.height, 1];

		let texture = Q5.device.createTexture({
			size: textureSize,
			format: 'bgra8unorm',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
		});

		Q5.device.queue.copyExternalImageToTexture(
			{ source: img },
			{
				texture,
				colorSpace: $.canvas.colorSpace
			},
			textureSize
		);

		$._textures[tIdx] = texture;
		img.textureIndex = tIdx;

		const textureBindGroup = Q5.device.createBindGroup({
			layout: textureLayout,
			entries: [
				{ binding: 0, resource: sampler },
				{ binding: 1, resource: texture.createView() }
			]
		});
		$._textureBindGroups[tIdx] = textureBindGroup;

		tIdx = (tIdx + 1) % MAX_TEXTURES;

		// if the texture array is full, destroy the oldest texture
		if ($._textures[tIdx]) {
			$._textures[tIdx].destroy();
			delete $._textures[tIdx];
			delete $._textureBindGroups[tIdx];
		}
	};

	$.loadImage = (src, cb) => {
		q._preloadCount++;
		let g = $._g.loadImage(src, (img) => {
			g.defaultWidth = img.width * $._defaultImageScale;
			g.defaultHeight = img.height * $._defaultImageScale;
			$._createTexture(img);
			q._preloadCount--;
			if (cb) cb(img);
		});
		return g;
	};

	$.imageMode = (x) => ($._imageMode = x);

	const addVert = (x, y, u, v, ci, ti, ga) => {
		let s = vertexStack,
			i = vertIndex;
		s[i++] = x;
		s[i++] = y;
		s[i++] = u;
		s[i++] = v;
		s[i++] = ci;
		s[i++] = ti;
		s[i++] = ga;
		vertIndex = i;
	};

	$.image = (img, dx = 0, dy = 0, dw, dh, sx = 0, sy = 0, sw, sh) => {
		let g = img;
		if (img.canvas) img = img.canvas;
		if (img.textureIndex == undefined) return;

		if ($._matrixDirty) $._saveMatrix();

		let w = img.width,
			h = img.height,
			pd = g._pixelDensity || 1;

		dw ??= g.defaultWidth;
		dh ??= g.defaultHeight;
		sw ??= w;
		sh ??= h;

		dw *= pd;
		dh *= pd;

		let [l, r, t, b] = $._calcBox(dx, dy, dw, dh, $._imageMode);

		let u0 = sx / w,
			v0 = sy / h,
			u1 = (sx + sw) / w,
			v1 = (sy + sh) / h,
			ti = $._matrixIndex,
			ci = $._tint,
			ga = $._globalAlpha;

		addVert(l, t, u0, v0, ci, ti, ga);
		addVert(r, t, u1, v0, ci, ti, ga);
		addVert(l, b, u0, v1, ci, ti, ga);
		addVert(r, b, u1, v1, ci, ti, ga);

		$.drawStack.push(1, img.textureIndex);
	};

	$._hooks.preRender.push(() => {
		if (!$._textureBindGroups.length) return;

		// Switch to image pipeline
		$.pass.setPipeline($._pipelines[1]);

		let vertexBuffer = Q5.device.createBuffer({
			size: vertIndex * 5,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});

		new Float32Array(vertexBuffer.getMappedRange()).set(vertexStack.slice(0, vertIndex));
		vertexBuffer.unmap();

		$.pass.setVertexBuffer(1, vertexBuffer);
	});

	$._hooks.postRender.push(() => {
		vertIndex = 0;
	});
};

Q5.THRESHOLD = 1;
Q5.GRAY = 2;
Q5.OPAQUE = 3;
Q5.INVERT = 4;
Q5.POSTERIZE = 5;
Q5.DILATE = 6;
Q5.ERODE = 7;
Q5.BLUR = 8;
Q5.renderers.webgpu.text = ($, q) => {
	let textShader = Q5.device.createShaderModule({
		label: 'MSDF text shader',
		code: `
struct Uniforms {
	halfWidth: f32,
	halfHeight: f32
}
struct VertexParams {
	@builtin(vertex_index) vertex : u32,
	@builtin(instance_index) instance : u32
}
struct FragmentParams {
	@builtin(position) position : vec4f,
	@location(0) texCoord : vec2f,
	@location(1) fillColor : vec4f
}
struct Char {
	texOffset: vec2f,
	texExtent: vec2f,
	size: vec2f,
	offset: vec2f,
}
struct Text {
	pos: vec2f,
	scale: f32,
	matrixIndex: f32,
	fillIndex: f32,
	strokeIndex: f32
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage> transforms: array<mat4x4<f32>>;
@group(0) @binding(2) var<storage> colors : array<vec4f>;

@group(1) @binding(0) var fontTexture: texture_2d<f32>;
@group(1) @binding(1) var fontSampler: sampler;
@group(1) @binding(2) var<storage> fontChars: array<Char>;

@group(2) @binding(0) var<storage> textChars: array<vec4f>;
@group(2) @binding(1) var<storage> textMetadata: array<Text>;

const quad = array(vec2f(0, -1), vec2f(1, -1), vec2f(0, 0), vec2f(1, 0));

@vertex
fn vertexMain(v : VertexParams) -> FragmentParams {
	let char = textChars[v.instance];

	let text = textMetadata[i32(char.w)];

	let fontChar = fontChars[i32(char.z)];

	let charPos = ((quad[v.vertex] * fontChar.size + char.xy + fontChar.offset) * text.scale) + text.pos;

	var vert = vec4f(charPos, 0.0, 1.0);
	vert = transforms[i32(text.matrixIndex)] * vert;
	vert.x /= uniforms.halfWidth;
	vert.y /= uniforms.halfHeight;

	var f : FragmentParams;
	f.position = vert;
	f.texCoord = (quad[v.vertex] * vec2f(1, -1)) * fontChar.texExtent + fontChar.texOffset;
	f.fillColor = colors[i32(text.fillIndex)];
	return f;
}

fn sampleMsdf(texCoord: vec2f) -> f32 {
	let c = textureSample(fontTexture, fontSampler, texCoord);
	return max(min(c.r, c.g), min(max(c.r, c.g), c.b));
}

@fragment
fn fragmentMain(f : FragmentParams) -> @location(0) vec4f {
	// pxRange (AKA distanceRange) comes from the msdfgen tool,
	// uses the default which is 4.
	let pxRange = 4.0;
	let sz = vec2f(textureDimensions(fontTexture, 0));
	let dx = sz.x*length(vec2f(dpdxFine(f.texCoord.x), dpdyFine(f.texCoord.x)));
	let dy = sz.y*length(vec2f(dpdxFine(f.texCoord.y), dpdyFine(f.texCoord.y)));
	let toPixels = pxRange * inverseSqrt(dx * dx + dy * dy);
	let sigDist = sampleMsdf(f.texCoord) - 0.5;
	let pxDist = sigDist * toPixels;
	let edgeWidth = 0.5;
	let alpha = smoothstep(-edgeWidth, edgeWidth, pxDist);
	if (alpha < 0.001) {
		discard;
	}
	return vec4f(f.fillColor.rgb, f.fillColor.a * alpha);
}
`
	});

	let textBindGroupLayout = Q5.device.createBindGroupLayout({
		label: 'MSDF text group layout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: 'read-only-storage' }
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: 'read-only-storage' }
			}
		]
	});

	let fontSampler = Q5.device.createSampler({
		minFilter: 'linear',
		magFilter: 'linear',
		mipmapFilter: 'linear',
		maxAnisotropy: 16
	});

	let fontBindGroupLayout = Q5.device.createBindGroupLayout({
		label: 'MSDF font group layout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {}
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {}
			},
			{
				binding: 2,
				visibility: GPUShaderStage.VERTEX,
				buffer: { type: 'read-only-storage' }
			}
		]
	});

	let fontPipelineLayout = Q5.device.createPipelineLayout({
		bindGroupLayouts: [...$.bindGroupLayouts, fontBindGroupLayout, textBindGroupLayout]
	});

	$._pipelineConfigs[2] = {
		label: 'msdf font pipeline',
		layout: fontPipelineLayout,
		vertex: { module: textShader, entryPoint: 'vertexMain' },
		fragment: {
			module: textShader,
			entryPoint: 'fragmentMain',
			targets: [{ format: 'bgra8unorm', blend: $.blendConfigs.normal }]
		},
		primitive: { topology: 'triangle-strip', stripIndexFormat: 'uint32' },
		multisample: { count: 4 }
	};

	$._pipelines[2] = Q5.device.createRenderPipeline($._pipelineConfigs[2]);

	class MsdfFont {
		constructor(bindGroup, lineHeight, chars, kernings) {
			this.bindGroup = bindGroup;
			this.lineHeight = lineHeight;
			this.chars = chars;
			this.kernings = kernings;
			let charArray = Object.values(chars);
			this.charCount = charArray.length;
			this.defaultChar = charArray[0];
		}
		getChar(charCode) {
			return this.chars[charCode] ?? this.defaultChar;
		}
		// Gets the distance in pixels a line should advance for a given
		// character code. If the upcoming character code is given any
		// kerning between the two characters will be taken into account.
		getXAdvance(charCode, nextCharCode = -1) {
			let char = this.getChar(charCode);
			if (nextCharCode >= 0) {
				let kerning = this.kernings.get(charCode);
				if (kerning) {
					return char.xadvance + (kerning.get(nextCharCode) ?? 0);
				}
			}
			return char.xadvance;
		}
	}

	$._fonts = [];
	let fonts = {};

	let createFont = async (fontJsonUrl, fontName, cb) => {
		q._preloadCount++;

		let res = await fetch(fontJsonUrl);
		if (res.status == 404) {
			q._preloadCount--;
			return '';
		}
		let atlas = await res.json();

		let slashIdx = fontJsonUrl.lastIndexOf('/');
		let baseUrl = slashIdx != -1 ? fontJsonUrl.substring(0, slashIdx + 1) : '';
		// load font image
		res = await fetch(baseUrl + atlas.pages[0]);
		let img = await createImageBitmap(await res.blob());

		// convert image to texture
		let imgSize = [img.width, img.height, 1];
		let texture = Q5.device.createTexture({
			label: `MSDF ${fontName}`,
			size: imgSize,
			format: 'rgba8unorm',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
		});
		Q5.device.queue.copyExternalImageToTexture({ source: img }, { texture }, imgSize);

		// chars and kernings can be stored as csv strings, making the file
		// size smaller, but they need to be parsed into arrays of objects
		if (typeof atlas.chars == 'string') {
			atlas.chars = $.CSV.parse(atlas.chars, ' ');
			atlas.kernings = $.CSV.parse(atlas.kernings, ' ');
		}

		let charCount = atlas.chars.length;
		let charsBuffer = Q5.device.createBuffer({
			size: charCount * 32,
			usage: GPUBufferUsage.STORAGE,
			mappedAtCreation: true
		});

		let fontChars = new Float32Array(charsBuffer.getMappedRange());
		let u = 1 / atlas.common.scaleW;
		let v = 1 / atlas.common.scaleH;
		let chars = {};
		let o = 0; // offset
		for (let [i, char] of atlas.chars.entries()) {
			chars[char.id] = char;
			chars[char.id].charIndex = i;
			fontChars[o] = char.x * u; // texOffset.x
			fontChars[o + 1] = char.y * v; // texOffset.y
			fontChars[o + 2] = char.width * u; // texExtent.x
			fontChars[o + 3] = char.height * v; // texExtent.y
			fontChars[o + 4] = char.width; // size.x
			fontChars[o + 5] = char.height; // size.y
			fontChars[o + 6] = char.xoffset; // offset.x
			fontChars[o + 7] = -char.yoffset; // offset.y
			o += 8;
		}
		charsBuffer.unmap();

		let fontBindGroup = Q5.device.createBindGroup({
			label: 'msdf font bind group',
			layout: fontBindGroupLayout,
			entries: [
				{ binding: 0, resource: texture.createView() },
				{ binding: 1, resource: fontSampler },
				{ binding: 2, resource: { buffer: charsBuffer } }
			]
		});

		let kernings = new Map();
		if (atlas.kernings) {
			for (let kerning of atlas.kernings) {
				let charKerning = kernings.get(kerning.first);
				if (!charKerning) {
					charKerning = new Map();
					kernings.set(kerning.first, charKerning);
				}
				charKerning.set(kerning.second, kerning.amount);
			}
		}

		$._font = new MsdfFont(fontBindGroup, atlas.common.lineHeight, chars, kernings);

		$._font.index = $._fonts.length;
		$._fonts.push($._font);
		fonts[fontName] = $._font;

		q._preloadCount--;

		if (cb) cb(fontName);
	};

	$._g.colorMode($.RGB, 1);

	$.loadFont = (url, cb) => {
		let ext = url.slice(url.lastIndexOf('.') + 1);
		if (ext != 'json') return $._g.loadFont(url, cb);
		let fontName = url.slice(url.lastIndexOf('/') + 1, url.lastIndexOf('-'));
		createFont(url, fontName, cb);
		return fontName;
	};

	$._loadDefaultFont = (fontName) => {
		fonts[fontName] = null;
		if (navigator.onLine) {
			$.loadFont(`https://q5js.org/fonts/${fontName}-msdf.json`);
		} else {
			$.loadFont(`/node_modules/q5/builtinFonts/${fontName}-msdf.json`);
		}
	};

	$._textSize = 18;
	$._textAlign = 'left';
	$._textBaseline = 'alphabetic';
	let leadingSet = false,
		leading = 22.5,
		leadDiff = 4.5,
		leadPercent = 1.25;

	$.textFont = (fontName) => {
		let font = fonts[fontName];
		if (font) $._font = font;
		else if (font === undefined) $._loadDefaultFont(fontName);
	};

	$.textSize = (size) => {
		$._textSize = size;
		if (!leadingSet) {
			leading = size * leadPercent;
			leadDiff = leading - size;
		}
	};

	$.textLeading = (lineHeight) => {
		$._font.lineHeight = leading = lineHeight;
		leadDiff = leading - $._textSize;
		leadPercent = leading / $._textSize;
		leadingSet = true;
	};

	$.textAlign = (horiz, vert) => {
		$._textAlign = horiz;
		if (vert) $._textBaseline = vert;
	};

	let charStack = [],
		textStack = [];

	let measureText = (font, text, charCallback) => {
		let maxWidth = 0,
			offsetX = 0,
			offsetY = 0,
			line = 0,
			printedCharCount = 0,
			lineWidths = [],
			nextCharCode = text.charCodeAt(0);

		for (let i = 0; i < text.length; ++i) {
			let charCode = nextCharCode;
			nextCharCode = i < text.length - 1 ? text.charCodeAt(i + 1) : -1;
			switch (charCode) {
				case 10: // newline
					lineWidths.push(offsetX);
					line++;
					maxWidth = Math.max(maxWidth, offsetX);
					offsetX = 0;
					offsetY -= font.lineHeight * leadPercent;
					break;
				case 13: // CR
					break;
				case 32: // space
					// advance the offset without actually adding a character
					offsetX += font.getXAdvance(charCode);
					break;
				case 9: // tab
					offsetX += font.getXAdvance(charCode) * 2;
					break;
				default:
					if (charCallback) {
						charCallback(offsetX, offsetY, line, font.getChar(charCode));
					}
					offsetX += font.getXAdvance(charCode, nextCharCode);
					printedCharCount++;
			}
		}
		lineWidths.push(offsetX);
		maxWidth = Math.max(maxWidth, offsetX);
		return {
			width: maxWidth,
			height: lineWidths.length * font.lineHeight * leadPercent,
			lineWidths,
			printedCharCount
		};
	};

	$.text = (str, x, y, w, h) => {
		if (!$._font) {
			// if the default font hasn't been loaded yet, try to load it
			if ($._font !== null) $.textFont('sans-serif');
			return;
		}

		let type = typeof str;
		if (type != 'string') {
			if (type == 'object') str = str.toString();
			else str = str + '';
		}

		if (str.length > w) {
			let wrapped = [];
			let i = 0;
			while (i < str.length && wrapped.length < h) {
				let max = i + w;
				if (max >= str.length) {
					wrapped.push(str.slice(i));
					break;
				}
				let end = str.lastIndexOf(' ', max);
				if (end == -1 || end < i) end = max;
				wrapped.push(str.slice(i, end));
				i = end + 1;
			}
			str = wrapped.join('\n');
		}

		let spaces = 0, // whitespace char count, not literal spaces
			hasNewline;
		for (let i = 0; i < str.length; i++) {
			let c = str[i];
			switch (c) {
				case '\n':
					hasNewline = true;
				case '\r':
				case '\t':
				case ' ':
					spaces++;
			}
		}

		let charsData = [];

		let ta = $._textAlign,
			tb = $._textBaseline,
			textIndex = textStack.length,
			o = 0, // offset
			measurements;

		if (ta == 'left' && !hasNewline) {
			measurements = measureText($._font, str, (textX, textY, line, char) => {
				charsData[o] = textX;
				charsData[o + 1] = textY;
				charsData[o + 2] = char.charIndex;
				charsData[o + 3] = textIndex;
				o += 4;
			});

			if (tb == 'alphabetic') y -= $._textSize;
			else if (tb == 'center') y -= $._textSize * 0.5;
			else if (tb == 'bottom') y -= leading;
		} else {
			// measure the text to get the line widths before setting
			// the x position to properly align the text
			measurements = measureText($._font, str);

			let offsetY = 0;
			if (tb == 'alphabetic') y -= $._textSize;
			else if (tb == 'center') offsetY = measurements.height * 0.5;
			else if (tb == 'bottom') offsetY = measurements.height;

			measureText($._font, str, (textX, textY, line, char) => {
				let offsetX = 0;
				if (ta == 'center') {
					offsetX = measurements.width * -0.5 - (measurements.width - measurements.lineWidths[line]) * -0.5;
				} else if (ta == 'right') {
					offsetX = -measurements.lineWidths[line];
				}
				charsData[o] = textX + offsetX;
				charsData[o + 1] = textY + offsetY;
				charsData[o + 2] = char.charIndex;
				charsData[o + 3] = textIndex;
				o += 4;
			});
		}
		charStack.push(charsData);

		let txt = [];

		if ($._matrixDirty) $._saveMatrix();

		txt[0] = x;
		txt[1] = -y;
		txt[2] = $._textSize / 44;
		txt[3] = $._matrixIndex;
		txt[4] = $._fillSet ? $._fill : 0;
		txt[5] = $._stroke;

		textStack.push(txt);
		$.drawStack.push(2, measurements.printedCharCount, $._font.index);
	};

	$.textWidth = (str) => {
		if (!$._font) return 0;
		return measureText($._font, str).width;
	};

	$.createTextImage = (str, w, h) => {
		$._g.textSize($._textSize);

		if ($._doFill) {
			let fi = $._fill * 4;
			$._g.fill(colorStack.slice(fi, fi + 4));
		}
		if ($._doStroke) {
			let si = $._stroke * 4;
			$._g.stroke(colorStack.slice(si, si + 4));
		}

		let img = $._g.createTextImage(str, w, h);

		if (img.canvas.textureIndex == undefined) {
			$._createTexture(img);
		} else if (img.modified) {
			let cnv = img.canvas;
			let textureSize = [cnv.width, cnv.height, 1];
			let texture = $._textures[cnv.textureIndex];

			Q5.device.queue.copyExternalImageToTexture(
				{ source: cnv },
				{ texture, colorSpace: $.canvas.colorSpace },
				textureSize
			);
			img.modified = false;
		}
		return img;
	};

	$.textImage = (img, x, y) => {
		if (typeof img == 'string') img = $.createTextImage(img);

		let og = $._imageMode;
		$._imageMode = 'corner';

		let ta = $._textAlign;
		if (ta == 'center') x -= img.canvas.hw;
		else if (ta == 'right') x -= img.width;

		let bl = $._textBaseline;
		if (bl == 'alphabetic') y -= img._leading;
		else if (bl == 'center') y -= img._middle;
		else if (bl == 'bottom') y -= img._bottom;
		else if (bl == 'top') y -= img._top;

		$.image(img, x, y);
		$._imageMode = og;
	};

	$._hooks.preRender.push(() => {
		if (!charStack.length) return;

		// calculate total buffer size for text data
		let totalTextSize = 0;
		for (let charsData of charStack) {
			totalTextSize += charsData.length * 4;
		}

		// create a single buffer for all the char data
		let charBuffer = Q5.device.createBuffer({
			size: totalTextSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});

		// copy all the text data into the buffer
		new Float32Array(charBuffer.getMappedRange()).set(charStack.flat());
		charBuffer.unmap();

		// calculate total buffer size for metadata
		let totalMetadataSize = textStack.length * 6 * 4;

		// create a single buffer for all metadata
		let textBuffer = Q5.device.createBuffer({
			label: 'textBuffer',
			size: totalMetadataSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});

		// copy all metadata into the buffer
		new Float32Array(textBuffer.getMappedRange()).set(textStack.flat());
		textBuffer.unmap();

		// create a single bind group for the text buffer and metadata buffer
		$._textBindGroup = Q5.device.createBindGroup({
			label: 'msdf text bind group',
			layout: textBindGroupLayout,
			entries: [
				{ binding: 0, resource: { buffer: charBuffer } },
				{ binding: 1, resource: { buffer: textBuffer } }
			]
		});
	});

	$._hooks.postRender.push(() => {
		charStack = [];
		textStack = [];
	});
};
