import React, { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { audioEngine } from '../../services/audioEngine';

// Vertex shader
const VS_SOURCE = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// 4 Fragment Shaders using DA Bioforge Leaf Palette
// Bioforge: Pulsing organic bioluminescent fluid ribbons (sage/eucalyptus/champagne)
const FS_BIOFORGE = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
  float dist = length(uv);
  
  float wave = sin(uv.x * 3.5 + u_time * 1.2 + u_bass * 2.0) * 0.25;
  wave += cos(uv.y * 4.0 - u_time * 0.8 + u_mid * 1.5) * 0.2;
  
  float line = abs(uv.y - wave) * (4.0 - u_bass * 1.5);
  float glow = 0.05 / (line + 0.02);
  
  // Colors: Sage (#94B89A), Eucalyptus (#6B8F7A), Champagne (#C9A57A)
  vec3 sage = vec3(0.58, 0.72, 0.60);
  vec3 euca = vec3(0.42, 0.56, 0.48);
  vec3 champ = vec3(0.79, 0.65, 0.48);
  
  vec3 col = mix(euca, sage, sin(dist * 2.0 - u_time) * 0.5 + 0.5);
  col = mix(col, champ, u_treble * 0.8) * glow;
  
  // Dark obsidian vignette
  col *= smoothstep(1.5, 0.2, dist);
  fragColor = vec4(col, 0.85);
}
`;

// Braise: Deep warm copper embers and glowing hearth waves
const FS_BRAISE = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
  float r = length(uv);
  
  float pulse = sin(u_time * 2.0 + r * 5.0) * u_bass * 0.3;
  float heat = sin(uv.x * 2.0 + u_time) * cos(uv.y * 3.0 - u_time) * 0.4;
  
  float glow = 0.08 / (abs(r - 0.5 - pulse + heat) + 0.04);
  
  // Copper (#A87D54), Champagne (#C9A57A), Warm stone (#D8CAB7)
  vec3 copper = vec3(0.66, 0.49, 0.33);
  vec3 champagne = vec3(0.79, 0.65, 0.48);
  
  vec3 col = mix(copper, champagne, u_mid) * glow * (1.0 + u_bass * 0.8);
  col *= smoothstep(1.3, 0.1, r);
  fragColor = vec4(col, 0.9);
}
`;

// Eau Noire: Liquid obsidian ripples with eucalyptus reflection
const FS_EAU_NOIRE = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  
  float d = length(p);
  float ripple = sin(d * 12.0 - u_time * 2.5 - u_bass * 4.0) * 0.5 + 0.5;
  ripple *= exp(-d * 1.5);
  
  vec3 surface = vec3(0.07, 0.09, 0.08); // #121714
  vec3 euca = vec3(0.42, 0.56, 0.48) * (ripple * (0.6 + u_treble * 0.8));
  
  vec3 col = surface + euca;
  fragColor = vec4(col, 0.85);
}
`;

// Statique: Minimalist discrete audio spectrum bars with champagne tips
const FS_STATIQUE = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float barCount = 48.0;
  float barIdx = floor(uv.x * barCount);
  float barNorm = barIdx / barCount;
  
  float energy = mix(u_bass, u_mid, barNorm);
  if (barNorm > 0.6) energy = mix(u_mid, u_treble, (barNorm - 0.6) / 0.4);
  
  float barHeight = energy * 0.7 + 0.05 + sin(barIdx + u_time * 3.0) * 0.02;
  float inBar = step(uv.y, barHeight);
  float barBorder = step(0.15, fract(uv.x * barCount));
  
  vec3 sage = vec3(0.58, 0.72, 0.60);
  vec3 champ = vec3(0.79, 0.65, 0.48);
  
  vec3 col = mix(sage, champ, uv.y / max(0.01, barHeight));
  col *= (inBar * barBorder);
  
  fragColor = vec4(col, 0.75);
}
`;

export const ShaderVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { shaderPreset, shaderActive } = useSettingsStore();
  const { isPlaying } = usePlayerStore();

  useEffect(() => {
    if (!shaderActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) return;

    let animId: number;
    let isWindowFocused = true;

    const onFocus = () => { isWindowFocused = true; };
    const onBlur = () => { isWindowFocused = false; };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    // Pick shader source
    let fsSource = FS_BIOFORGE;
    if (shaderPreset === 'braise') fsSource = FS_BRAISE;
    else if (shaderPreset === 'eau_noire') fsSource = FS_EAU_NOIRE;
    else if (shaderPreset === 'statique') fsSource = FS_STATIQUE;

    // Compile shaders
    const createShader = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const vs = createShader(gl.VERTEX_SHADER, VS_SOURCE);
    const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Quad geometry
    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uResLoc = gl.getUniformLocation(prog, 'u_resolution');
    const uTimeLoc = gl.getUniformLocation(prog, 'u_time');
    const uBassLoc = gl.getUniformLocation(prog, 'u_bass');
    const uMidLoc = gl.getUniformLocation(prog, 'u_mid');
    const uTrebleLoc = gl.getUniformLocation(prog, 'u_treble');

    const startTime = performance.now();

    const render = () => {
      if (isWindowFocused) {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
        }

        const now = (performance.now() - startTime) / 1000.0;
        gl.uniform2f(uResLoc, canvas.width, canvas.height);
        gl.uniform1f(uTimeLoc, now);

        // Get live frequency data from Web Audio engine
        const freqData = audioEngine.getFrequencyData();
        let bass = 0;
        let mid = 0;
        let treble = 0;

        if (freqData.length > 0) {
          // Bass bins (0 - 10)
          for (let i = 0; i < 10; i++) bass += freqData[i] || 0;
          bass /= (10 * 255);

          // Mid bins (10 - 50)
          for (let i = 10; i < 50; i++) mid += freqData[i] || 0;
          mid /= (40 * 255);

          // Treble bins (50 - 120)
          for (let i = 50; i < 120; i++) treble += freqData[i] || 0;
          treble /= (70 * 255);
        }

        gl.uniform1f(uBassLoc, isPlaying ? bass : 0.05);
        gl.uniform1f(uMidLoc, isPlaying ? mid : 0.05);
        gl.uniform1f(uTrebleLoc, isPlaying ? treble : 0.05);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(vbo);
    };
  }, [shaderPreset, shaderActive, isPlaying]);

  if (!shaderActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-40 z-0"
    />
  );
};
