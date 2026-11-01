import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

// Longer arrays (length a multiple of 4) upload as vec4[] uniforms.
export type Uniforms = Record<string, number | [number, number] | [number, number, number] | number[]>;

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

type GLState = {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  locs: Map<string, WebGLUniformLocation | null>;
};

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    const numbered = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    throw new Error(`Shader compile error: ${log}\n${numbered}`);
  }
  return sh;
}

function init(canvas: HTMLCanvasElement, frag: string): GLState {
  const gl = canvas.getContext('webgl2', {
    preserveDrawingBuffer: true,
    antialias: false,
    premultipliedAlpha: true,
    alpha: true,
  });
  if (!gl) throw new Error('WebGL2 unavailable');
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Shader link error: ${gl.getProgramInfoLog(prog)}`);
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return { gl, prog, locs: new Map() };
}

/**
 * Full-frame fragment shader driven by the Remotion frame clock.
 * `t` is local seconds, `res` the drawing-buffer size; extra uniforms are passed through.
 * `scale` < 1 renders at reduced resolution and lets the browser upscale (for heavy shaders).
 */
export const ShaderCanvas: React.FC<{
  frag: string;
  uniforms?: Uniforms;
  scale?: number;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}> = ({ frag, uniforms = {}, scale = 1, width = 1920, height = 804, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<GLState | null>(null);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  useLayoutEffect(() => {
    const canvas = ref.current!;
    if (!state.current) state.current = init(canvas, frag);
    const { gl, prog, locs } = state.current;
    const u = (name: string) => {
      if (!locs.has(name)) locs.set(name, gl.getUniformLocation(prog, name));
      return locs.get(name)!;
    };
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.uniform1f(u('t'), frame / fps);
    gl.uniform2f(u('res'), w, h);
    for (const [k, v] of Object.entries(uniforms)) {
      if (typeof v === 'number') gl.uniform1f(u(k), v);
      else if (v.length > 3) gl.uniform4fv(u(k), v);
      else if (v.length === 2) gl.uniform2f(u(k), v[0], v[1]);
      else gl.uniform3f(u(k), v[0], v[1], v[2]!);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  });

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }}
    />
  );
};
