Q5.renderers.webgpu.drawing = ($, q) => {
	$.CLOSE = 1;

	let verticesStack, drawStack, colorsStack;

	$._hooks.postCanvas.push(() => {
		let colorsLayout = Q5.device.createBindGroupLayout({
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'read-only-storage',
						hasDynamicOffset: false
					}
				}
			]
		});

		$.bindGroupLayouts.push(colorsLayout);

		verticesStack = $.verticesStack;
		drawStack = $.drawStack;
		colorsStack = $.colorsStack;

		let vertexBufferLayout = {
			arrayStride: 16, // 2 coordinates + 1 color index + 1 transform index * 4 bytes each
			attributes: [
				{ format: 'float32x2', offset: 0, shaderLocation: 0 }, // position
				{ format: 'float32', offset: 8, shaderLocation: 1 }, // colorIndex
				{ format: 'float32', offset: 12, shaderLocation: 2 } // transformIndex
			]
		};

		let vertexShader = Q5.device.createShaderModule({
			code: `
struct VertexOutput {
	@builtin(position) position: vec4<f32>,
	@location(1) colorIndex: f32
};

struct Uniforms {
	halfWidth: f32,
	halfHeight: f32
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var<storage, read> transforms: array<mat4x4<f32>>;

@vertex
fn vertexMain(@location(0) pos: vec2<f32>, @location(1) colorIndex: f32, @location(2) transformIndex: f32) -> VertexOutput {
	var vert = vec4<f32>(pos, 0.0, 1.0);
	vert *= transforms[i32(transformIndex)];
	vert.x /= uniforms.halfWidth;
	vert.y /= uniforms.halfHeight;

	var output: VertexOutput;
	output.position = vert;
	output.colorIndex = colorIndex;
	return output;
}
`
		});

		let fragmentShader = Q5.device.createShaderModule({
			code: `
@group(2) @binding(0) var<storage, read> uColors : array<vec4<f32>>;

@fragment
fn fragmentMain(@location(1) colorIndex: f32) -> @location(0) vec4<f32> {
	let index = u32(colorIndex);
	return mix(uColors[index], uColors[index + 1u], fract(colorIndex));
}
`
		});

		let pipelineLayout = Q5.device.createPipelineLayout({
			bindGroupLayouts: $.bindGroupLayouts
		});

		$._createPipeline = (blendConfig) => {
			return Q5.device.createRenderPipeline({
				layout: pipelineLayout,
				vertex: {
					module: vertexShader,
					entryPoint: 'vertexMain',
					buffers: [vertexBufferLayout]
				},
				fragment: {
					module: fragmentShader,
					entryPoint: 'fragmentMain',
					targets: [
						{
							format: 'bgra8unorm',
							blend: blendConfig
						}
					]
				},
				primitive: {
					topology: 'triangle-list'
				}
			});
		};

		$.pipelines[0] = $._createPipeline(blendConfigs.normal);
	});

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

	const blendModes = {
		normal: [2, 3, 0, 2, 3, 0],
		lighter: [2, 1, 0, 2, 1, 0],
		subtract: [2, 1, 2, 2, 1, 2],
		multiply: [4, 0, 0, 5, 0, 0],
		screen: [1, 3, 0, 1, 3, 0],
		darken: [1, 3, 3, 1, 3, 3],
		lighten: [1, 3, 4, 1, 3, 4],
		overlay: [2, 3, 0, 2, 3, 0],
		hard_light: [2, 3, 0, 2, 3, 0],
		soft_light: [2, 3, 0, 2, 3, 0],
		difference: [2, 3, 2, 2, 3, 2],
		exclusion: [2, 3, 0, 2, 3, 0],
		color_dodge: [1, 7, 0, 1, 7, 0],
		color_burn: [6, 1, 0, 6, 1, 0],
		linear_dodge: [2, 1, 0, 2, 1, 0],
		linear_burn: [2, 7, 1, 2, 7, 1],
		vivid_light: [2, 7, 0, 2, 7, 0],
		pin_light: [2, 7, 0, 2, 7, 0],
		hard_mix: [2, 7, 0, 2, 7, 0]
	};

	$.blendConfigs = {};

	Object.entries(blendModes).forEach(([name, mode]) => {
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
	});

	$._blendMode = 'normal';
	$.blendMode = (mode) => {
		if (mode == $._blendMode) return;
		if (mode == 'source-over') mode = 'normal';
		mode = mode.toLowerCase().replace(/[ -]/g, '_');
		$._blendMode = mode;
		$.pipelines[0] = $._createPipeline($.blendConfigs[mode]);
	};

	let shapeVertices;

	$.beginShape = () => {
		shapeVertices = [];
	};

	$.vertex = (x, y) => {
		if ($._matrixDirty) $._saveMatrix();
		shapeVertices.push(x, -y, $._colorIndex, $._transformIndex);
	};

	$.endShape = (close) => {
		let v = shapeVertices;
		if (v.length < 12) {
			throw new Error('A shape must have at least 3 vertices.');
		}
		if (close) {
			// Close the shape by adding the first vertex at the end
			v.push(v[0], v[1], v[2], v[3]);
		}
		// Convert the shape to triangles
		let triangles = [];
		for (let i = 4; i < v.length; i += 4) {
			triangles.push(
				v[0], // First vertex
				v[1],
				v[2],
				v[3],
				v[i - 4], // Previous vertex
				v[i - 3],
				v[i - 2],
				v[i - 1],
				v[i], // Current vertex
				v[i + 1],
				v[i + 2],
				v[i + 3]
			);
		}

		verticesStack.push(...triangles);
		drawStack.push(triangles.length / 4);
		shapeVertices = [];
	};

	$.triangle = (x1, y1, x2, y2, x3, y3) => {
		$.beginShape();
		$.vertex(x1, y1);
		$.vertex(x2, y2);
		$.vertex(x3, y3);
		$.endShape(1);
	};

	$.rect = (x, y, w, h) => {
		let hw = w / 2;
		let hh = h / 2;

		let left = x - hw;
		let right = x + hw;
		let top = -(y - hh); // y is inverted in WebGPU
		let bottom = -(y + hh);

		let ci = $._colorIndex;
		if ($._matrixDirty) $._saveMatrix();
		let ti = $._transformIndex;
		// two triangles make a rectangle
		verticesStack.push(
			left,
			top,
			ci,
			ti,
			right,
			top,
			ci,
			ti,
			left,
			bottom,
			ci,
			ti,
			right,
			top,
			ci,
			ti,
			left,
			bottom,
			ci,
			ti,
			right,
			bottom,
			ci,
			ti
		);
		drawStack.push(6);
	};

	$.background = () => {};

	/**
	 * Derived from: ceil(Math.log(d) * 7) * 2 - ceil(28)
	 * This lookup table is used for better performance.
	 * @param {Number} d diameter of the circle
	 * @returns n number of segments
	 */
	// prettier-ignore
	const getArcSegments = (d) => 
    d < 14 ? 8 :
    d < 16 ? 10 :
    d < 18 ? 12 :
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

	$.ellipse = (x, y, w, h) => {
		const n = getArcSegments(w == h ? w : Math.max(w, h));

		let a = Math.max(w, 1) / 2;
		let b = w == h ? a : Math.max(h, 1) / 2;

		let t = 0; // theta
		const angleIncrement = $.TAU / n;
		const ci = $._colorIndex;
		if ($._matrixDirty) $._saveMatrix();
		const ti = $._transformIndex;
		let vx1, vy1, vx2, vy2;
		for (let i = 0; i <= n; i++) {
			vx1 = vx2;
			vy1 = vy2;
			vx2 = x + a * Math.cos(t);
			vy2 = y + b * Math.sin(t);
			t += angleIncrement;

			if (i == 0) continue;

			verticesStack.push(x, y, ci, ti, vx1, vy1, ci, ti, vx2, vy2, ci, ti);
		}

		drawStack.push(n * 3);
	};

	$.circle = (x, y, d) => $.ellipse(x, y, d, d);

	$._hooks.preRender.push(() => {
		const vertexBuffer = Q5.device.createBuffer({
			size: verticesStack.length * 6,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
		});

		Q5.device.queue.writeBuffer(vertexBuffer, 0, new Float32Array(verticesStack));
		$.pass.setVertexBuffer(0, vertexBuffer);

		const colorsBuffer = Q5.device.createBuffer({
			size: colorsStack.length * 4,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
		});

		Q5.device.queue.writeBuffer(colorsBuffer, 0, new Float32Array(colorsStack));

		const colorsBindGroup = Q5.device.createBindGroup({
			layout: $.bindGroupLayouts[2],
			entries: [
				{
					binding: 0,
					resource: {
						buffer: colorsBuffer,
						offset: 0,
						size: colorsStack.length * 4
					}
				}
			]
		});

		// set the bind group once before rendering
		$.pass.setBindGroup(2, colorsBindGroup);
	});
};
