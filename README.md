# Water Ball experiments

just a little experiment with shaders and physics to create a realistic-ish water ball inside a glass sphere. it uses WebGPU for performance (if your browser supports it) and falls back to WebGL when needed.

## what's inside?
- **the ball:** a glass sphere containing dynamic liquid.
- **physics:** used some gerstner waves and radial distortion to make it feel "active" rather than just static.
- **interaction:** you can stir the water around using your mouse. the motion reacts to where you're pointing.
- **rendering:** dual-engine support with WebGPU and WebGL.

## tech
- TypeScript
- WebGL / WebGPU
- GLSL / WGSL for the shader magic

## how to run
if you wanna play with it locally:
1. `npm install`
2. `npm run dev`

feel free to poke around the shaders in `src/webgpu/shaders` if you're curious how the wave motion works.
