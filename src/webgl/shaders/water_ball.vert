#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  // Full-screen triangle
  vec2 pos[3] = vec2[](
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
  );
  gl_Position = vec4(pos[gl_VertexID], 0.0, 1.0);
  vUv = pos[gl_VertexID];
}
