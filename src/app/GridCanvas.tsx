"use client";

import { useEffect, useRef } from "react";

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform vec3 uColor;

float gridLine(float coord, float spacing) {
  float d = abs(fract(coord / spacing - 0.5) - 0.5) * spacing;
  return 1.0 - smoothstep(0.0, 1.0, d);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float spacing = 40.0;
  float g = max(gridLine(px.x, spacing), gridLine(px.y, spacing));

  // Horizontal position 0..1 across the screen
  float x = px.x / uRes.x;

  // Visible near the left and right edges, fading out toward the center
  float leftBand = 1.0 - smoothstep(0.02, 0.30, x);
  float rightBand = smoothstep(0.70, 0.98, x);
  float band = max(leftBand, rightBand);

  // Gentle vertical fade so it's stronger near the top
  float vFade = 1.0 - smoothstep(0.15, 0.95, px.y / uRes.y);

  float alpha = g * band * vFade * 0.6;
  gl_FragColor = vec4(uColor, alpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("Grid shader compile error:", gl.getShaderInfoLog(s));
  }
  return s;
}

// 2D fallback: draws a static grid if WebGL is unavailable.
function draw2d(canvas: HTMLCanvasElement, dark: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const color = dark ? "rgba(237,237,237,0.35)" : "rgba(23,23,23,0.35)";
  const render = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const spacing = 40;
    ctx.beginPath();
    for (let x = 0; x < w + spacing; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y < h + spacing; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  };
  render();
  // Redraw on resize only — no animation.
  window.addEventListener("resize", render);
  return () => window.removeEventListener("resize", render);
}

export default function GridCanvas({ dark }: { dark: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  let cleanup2d: (() => void) | undefined;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) {
      console.warn("WebGL unavailable — using 2D grid fallback");
      cleanup2d = draw2d(canvas, dark) ?? undefined;
      return;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Grid shader link failed:", gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uColor = gl.getUniformLocation(prog, "uColor");

    // Dark: light lines on dark bg. Light: dark lines.
    if (dark) gl.uniform3f(uColor, 0.93, 0.93, 0.93);
    else gl.uniform3f(uColor, 0.09, 0.09, 0.09);

    // Static grid: draw once, redraw only on resize.
    const draw = () => {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw();
    };
    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cleanup2d?.();
    };
  }, [dark]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 hidden h-full w-full lg:block"
    />
  );
}
