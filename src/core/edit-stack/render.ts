import { validateEditStack, type EditStack, type EditStep } from "@/core/edit-stack/schema";
import { MAX_EXPORT_DIMENSION, MAX_PIXEL_COUNT } from "@/core/limits";

export async function renderEditStack(
  source: Blob,
  rawStack: unknown,
): Promise<{
  rendered: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  contentHash: string;
}> {
  if (typeof OffscreenCanvas === "undefined")
    throw new Error("Editing is not supported by this browser.");
  const stack: EditStack = validateEditStack(rawStack);
  const bitmap = await createImageBitmap(source);
  try {
    let canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not create an image editing surface.");
    context.drawImage(bitmap, 0, 0);
    for (const step of stack.steps) canvas = applyStep(canvas, step);
    if (
      canvas.width > MAX_EXPORT_DIMENSION ||
      canvas.height > MAX_EXPORT_DIMENSION ||
      canvas.width * canvas.height > MAX_PIXEL_COUNT
    ) {
      throw new Error("The edited image is larger than the supported export size.");
    }
    const rendered = await canvas.convertToBlob({
      type: source.type || "image/png",
      quality: 0.92,
    });
    const scale = Math.min(1, 320 / Math.max(canvas.width, canvas.height));
    const thumbCanvas = new OffscreenCanvas(
      Math.max(1, Math.round(canvas.width * scale)),
      Math.max(1, Math.round(canvas.height * scale)),
    );
    requireContext(thumbCanvas).drawImage(
      canvas,
      0,
      0,
      thumbCanvas.width,
      thumbCanvas.height,
    );
    const thumbnail = await thumbCanvas.convertToBlob({
      type: "image/webp",
      quality: 0.82,
    });
    const digest = await crypto.subtle.digest("SHA-256", await rendered.arrayBuffer());
    const contentHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return { rendered, thumbnail, width: canvas.width, height: canvas.height, contentHash };
  } finally {
    bitmap.close();
  }
}

function applyStep(source: OffscreenCanvas, step: EditStep): OffscreenCanvas {
  if (step.type === "crop") {
    const x = Math.round(source.width * step.x);
    const y = Math.round(source.height * step.y);
    const width = Math.max(1, Math.round(source.width * step.width));
    const height = Math.max(1, Math.round(source.height * step.height));
    const output = new OffscreenCanvas(width, height);
    const context = requireContext(output);
    context.drawImage(source, x, y, width, height, 0, 0, width, height);
    return output;
  }
  if (step.type === "resize") {
    const output = new OffscreenCanvas(step.width, step.height);
    requireContext(output).drawImage(source, 0, 0, step.width, step.height);
    return output;
  }
  if (step.type === "rotate" || step.type === "flip") {
    const rotated = step.type === "rotate" && step.degrees % 180 !== 0;
    const output = new OffscreenCanvas(
      rotated ? source.height : source.width,
      rotated ? source.width : source.height,
    );
    const context = requireContext(output);
    context.translate(output.width / 2, output.height / 2);
    if (step.type === "rotate") context.rotate((step.degrees * Math.PI) / 180);
    else context.scale(step.horizontal ? -1 : 1, step.vertical ? -1 : 1);
    context.drawImage(source, -source.width / 2, -source.height / 2);
    return output;
  }
  return applyAdjustment(source, step);
}

function requireContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not create an image editing surface.");
  return context;
}

function applyAdjustment(
  source: OffscreenCanvas,
  step: Extract<EditStep, { type: "adjust" }>,
): OffscreenCanvas {
  const gpuCanvas = new OffscreenCanvas(source.width, source.height);
  const gl = gpuCanvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  if (!gl)
    throw new Error("Color adjustments need WebGL, which is unavailable in this browser.");
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  if (source.width > maxTextureSize || source.height > maxTextureSize) {
    throw new Error("This image is larger than the current device's WebGL texture limit.");
  }
  const vertex = compileShader(
    gl,
    gl.VERTEX_SHADER,
    `attribute vec2 position; varying vec2 uv; void main(){ uv=position*0.5+0.5; gl_Position=vec4(position,0.0,1.0); }`,
  );
  const fragment = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `precision mediump float; uniform sampler2D image; uniform vec2 texel; uniform float brightness; uniform float contrast; uniform float saturation; uniform float sharpness; varying vec2 uv; void main(){ vec4 c=texture2D(image,uv); vec3 n=texture2D(image,uv+vec2(texel.x,0.0)).rgb+texture2D(image,uv-vec2(texel.x,0.0)).rgb+texture2D(image,uv+vec2(0.0,texel.y)).rgb+texture2D(image,uv-vec2(0.0,texel.y)).rgb; vec3 color=c.rgb+(c.rgb-n*0.25)*sharpness; color=(color-0.5)*contrast+0.5+brightness; float l=dot(color,vec3(0.2126,0.7152,0.0722)); color=mix(vec3(l),color,saturation); gl_FragColor=vec4(clamp(color,0.0,1.0),c.a); }`,
  );
  const program = gl.createProgram();
  if (!program) throw new Error("The WebGL editor could not start.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(
      gl.getProgramInfoLog(program) ?? "The WebGL editor could not link its shader.",
    );
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!buffer || !texture)
    throw new Error("The WebGL editor could not allocate image resources.");
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.uniform1i(gl.getUniformLocation(program, "image"), 0);
  gl.uniform2f(
    gl.getUniformLocation(program, "texel"),
    1 / source.width,
    1 / source.height,
  );
  gl.uniform1f(gl.getUniformLocation(program, "brightness"), step.brightness / 200);
  gl.uniform1f(gl.getUniformLocation(program, "contrast"), 1 + step.contrast / 100);
  gl.uniform1f(gl.getUniformLocation(program, "saturation"), 1 + step.saturation / 100);
  gl.uniform1f(gl.getUniformLocation(program, "sharpness"), step.sharpness * 0.8);
  gl.viewport(0, 0, source.width, source.height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  const output = new OffscreenCanvas(source.width, source.height);
  requireContext(output).drawImage(gpuCanvas, 0, 0);
  gl.deleteTexture(texture);
  gl.deleteBuffer(buffer);
  gl.deleteProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  return output;
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("The WebGL editor could not create a shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message =
      gl.getShaderInfoLog(shader) ?? "The WebGL editor could not compile its shader.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}
