// water_ball.wgsl

struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  _pad0: f32,
  mouse: vec4<f32>,
  velocity: vec2<f32>,
  _pad1: vec2<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var output: VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = pos[vertexIndex];
  return output;
}

// --- Utils ---

fn hash(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}

fn noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2<f32>(1.0, 0.0)), u.x),
    mix(hash(i + vec2<f32>(0.0, 1.0)), hash(i + vec2<f32>(1.0, 1.0)), u.x),
    u.y
  ) * 2.0 - 1.0;
}

fn fbm(p: vec2<f32>) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var pos = p;
  for (var i = 0; i < 3; i = i + 1) {
    v = v + a * noise(pos);
    pos = pos * 2.02;
    a = a * 0.5;
  }
  return v;
}

// --- Waves ---

fn waterWaves(pos: vec2<f32>, time: f32, mouse: vec2<f32>, velMag: f32) -> f32 {
  var waves = 0.0;
  
  // Organic wave layers
  let d1 = normalize(vec2<f32>(0.8, 0.6));
  waves += sin(dot(pos, d1) * 2.2 + time * 0.9) * 0.22;
  
  let d2 = normalize(vec2<f32>(-0.7, 0.4));
  waves += sin(dot(pos, d2) * 4.3 - time * 1.5) * 0.15;
  
  let angle3 = time * 0.2;
  let d3 = vec2<f32>(cos(angle3), sin(angle3));
  waves += sin(dot(pos, d3) * 7.1 + time * 2.1) * 0.08;
  
  let d4 = normalize(vec2<f32>(0.1, -0.9));
  waves += sin(dot(pos, d4) * 13.0 - time * 3.2) * 0.05;
  
  waves += fbm(pos * 1.2 + vec2<f32>(time * 0.4, -time * 0.3)) * 0.2;
  
  // Mouse interactions
  let distToMouse = length(pos - vec2<f32>(mouse.x, -mouse.y));
  let interactionStrength = exp(-distToMouse * 3.5);
  
  waves += fbm(pos * 4.0 + time * 1.8) * 0.25 * interactionStrength;
  
  let mouseWave = sin(pos.x * 6.0 + mouse.x * 15.0 + time * 3.0) * 
                    cos(pos.y * 6.0 + mouse.y * 15.0 + time * 2.5);
  waves += mouseWave * 0.35 * interactionStrength;
  
  waves += sin(distToMouse * 18.0 - time * 6.0) * velMag * 0.45 * interactionStrength;
  
  return waves;
}

// --- Phsyics ---

fn raySphere(ro: vec3<f32>, rd: vec3<f32>, center: vec3<f32>, radius: f32) -> vec2<f32> {
  let oc = ro - center;
  let b = dot(oc, rd);
  let c = dot(oc, oc) - radius * radius;
  let h = b * b - c;
  if (h < 0.0) { return vec2<f32>(-1.0, -1.0); }
  let sq = sqrt(h);
  return vec2<f32>(-b - sq, -b + sq);
}

fn getWaterNormal(p: vec3<f32>, time: f32, mouse: vec2<f32>, velMag: f32) -> vec3<f32> {
  let eps = 0.008;
  let waves = waterWaves(p.xy, time, mouse, velMag);
  let wavesX = waterWaves(p.xy + vec2<f32>(eps, 0.0), time, mouse, velMag);
  let wavesY = waterWaves(p.xy + vec2<f32>(0.0, eps), time, mouse, velMag);
  
  let dx = (wavesX - waves) / eps;
  let dy = (wavesY - waves) / eps;
  
  return normalize(vec3<f32>(-dx * 0.25, -dy * 0.25, 0.8));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let aspect = u.resolution.x / u.resolution.y;
  var uv = input.uv;
  uv.x *= aspect;

  let ro = vec3<f32>(0.0, 0.0, 3.5);
  let rd = normalize(vec3<f32>(uv, -2.0));

  let sphereCenter = vec3<f32>(0.0, 0.0, 0.0);
  let sphereRadius = 1.0;

  let hit = raySphere(ro, rd, sphereCenter, sphereRadius);
  if (hit.x < 0.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }

  let p = ro + rd * hit.x;
  let baseNormal = normalize(p - sphereCenter);
  
  let distFromCenter = length(p.xy - sphereCenter.xy);
  let edgeSoftness = smoothstep(sphereRadius * 0.92, sphereRadius * 0.99, distFromCenter);
  let centerFactor = 1.0 - edgeSoftness;
  
  let mousePos = u.mouse.xy;
  let mouseStrength = length(mousePos);
  let velocity = u.velocity;
  let velMag = length(velocity);

  // --- Normal calculation ---
  let waveNormal = getWaterNormal(p, u.time, mousePos, velMag);
  
  let tangent = normalize(cross(baseNormal, vec3<f32>(0.0, 1.0, 0.001)));
  let bitangent = cross(baseNormal, tangent);
  let tbn = mat3x3<f32>(tangent, bitangent, baseNormal);
  var normal = normalize(tbn * waveNormal);
  
  normal = normalize(mix(normal, baseNormal, edgeSoftness * 0.7));
  
  let mouseWorld = vec3<f32>(mousePos.x * 1.2, -mousePos.y * 1.2, 0.5);
  let toMouse = mouseWorld - p;
  let mouseDist = length(toMouse);
  
  let magneticPull = exp(-mouseDist * 1.5) * mouseStrength * 0.6 * centerFactor;
  let magneticDir = normalize(toMouse);
  normal = normalize(normal + magneticDir * magneticPull);
  
  let velDeform = vec3<f32>(velocity.x, -velocity.y, 0.0) * 0.3 * centerFactor;
  normal = normalize(normal + velDeform);
  
  let rippleDist = length(p.xy - vec2<f32>(mousePos.x, -mousePos.y));
  let ripple = sin(rippleDist * 20.0 - u.time * 8.0) * exp(-rippleDist * 2.0);
  let rippleStrength = (mouseStrength * 0.4 + velMag * 0.6) * centerFactor;
  normal = normalize(normal + vec3<f32>(ripple, ripple, 0.0) * rippleStrength);

  // Fresnel
  let viewDot = abs(dot(rd, baseNormal));
  let F0 = 0.02;
  let fresnel = F0 + (1.0 - F0) * pow(1.0 - viewDot, 5.0);

  // Refraction
  let ior = 1.33;
  let refractDir = refract(rd, normal, 1.0 / ior);
  
  let internalHit = raySphere(p + refractDir * 0.01, refractDir, sphereCenter, sphereRadius);
  let exitPoint = p + refractDir * (internalHit.y + 0.01);
  let exitNormal = normalize(exitPoint - sphereCenter);
  let exitRefract = refract(refractDir, -exitNormal, ior);

  // Color & Scattering
  let waterDepth = length(exitPoint - p);
  
  let deepWater = vec3<f32>(0.005, 0.04, 0.12);
  let midWater = vec3<f32>(0.0, 0.25, 0.4);
  let shallowWater = vec3<f32>(0.1, 0.5, 0.7);
  let glowWater = vec3<f32>(0.2, 0.6, 0.9);
  let sssColor = vec3<f32>(0.05, 0.4, 0.6);
  
  let absorption = exp(-waterDepth * 1.5);
  var waterColor = mix(deepWater, shallowWater, absorption);
  
  let coreDarkness = smoothstep(0.4, 0.0, viewDot);
  waterColor = mix(waterColor, waterColor * 0.6, coreDarkness * 0.5);
  
  let sss = pow(max(dot(rd, -exitNormal), 0.0), 2.0) * (1.0 - fresnel);
  waterColor += sssColor * sss * 0.3;
  
  // Internal flow
  let flowTime = u.time * 0.8;
  let flowDir = normalize(vec2<f32>(mousePos.x, -mousePos.y) + velocity + 0.001);
  
  let flowCoord1 = dot(p.xy, flowDir) * 5.0 + flowTime;
  let flowCoord2 = dot(p.xy, vec2<f32>(-flowDir.y, flowDir.x)) * 3.0 + flowTime * 0.7;
  let flowBand = sin(flowCoord1) * 0.5 + 0.5;
  let flowBand2 = cos(flowCoord2) * 0.5 + 0.5;
  
  waterColor = mix(waterColor * 0.9, waterColor * 1.15, flowBand * 0.25 * centerFactor);
  waterColor = mix(waterColor, glowWater, flowBand2 * mouseStrength * 0.15);
  
  let swirl = atan2(p.y + mousePos.y, p.x - mousePos.x);
  let swirlPattern = sin(swirl * 4.0 + u.time * 1.2 + mouseDist * 6.0) * 0.5 + 0.5;
  waterColor = mix(waterColor, waterColor * 1.1, swirlPattern * mouseStrength * 0.2 * centerFactor);

  let magneticGlow = exp(-mouseDist * 2.5) * mouseStrength * centerFactor;
  waterColor += magneticGlow * vec3<f32>(0.1, 0.4, 0.6) * 0.8;

  // Caustics
  let ct = u.time * 0.4;
  let c1 = sin(exitPoint.x * 10.0 + ct) * cos(exitPoint.y * 8.0 + ct * 0.8);
  let c2 = sin(exitPoint.x * 8.0 - ct * 1.1) * cos(exitPoint.y * 10.0 - ct);
  let c3 = sin(exitPoint.x * 6.0 + exitPoint.y * 7.0 + ct * 0.6);
  var caustics = pow(max(c1 * c2 + 0.5, 0.0), 2.0) * 0.25;
  caustics += pow(max(c3 + 0.3, 0.0), 3.0) * 0.15;
  waterColor += caustics * vec3<f32>(0.35, 0.55, 0.85) * centerFactor;

  let velCaustics = pow(max(sin(exitPoint.x * 12.0 + velocity.x * 10.0) * 
                            cos(exitPoint.y * 12.0 - velocity.y * 10.0) + 0.5, 0.0), 2.0);
  waterColor += velCaustics * velMag * vec3<f32>(0.25, 0.45, 0.75) * 0.35 * centerFactor;

  let waveHeight = waterWaves(p.xy, u.time, mousePos, velMag);
  let waveHighlight = smoothstep(0.15, 0.35, waveHeight) * 0.12 * centerFactor;
  waterColor += waveHighlight * vec3<f32>(0.5, 0.75, 1.0);

  // Reflections
  let reflectDir = reflect(rd, normal);
  let envColor = mix(vec3<f32>(0.02, 0.1, 0.25), vec3<f32>(0.15, 0.4, 0.7), reflectDir.y * 0.5 + 0.5);
  waterColor = mix(waterColor, envColor, fresnel * 0.5);

  // Specular
  let sunDir = normalize(vec3<f32>(0.4, 1.0, 0.7));
  let sunHalf = normalize(sunDir - rd);
  let sunSpec1 = pow(max(dot(normal, sunHalf), 0.0), 2048.0) * centerFactor;
  let sunSpec2 = pow(max(dot(normal, sunHalf), 0.0), 256.0) * centerFactor;
  waterColor += (sunSpec1 * 3.5 + sunSpec2 * 0.4) * vec3<f32>(1.0, 0.98, 0.9);
  
  let fillDir = normalize(vec3<f32>(-0.6, 0.6, 0.5));
  let fillHalf = normalize(fillDir - rd);
  let fillSpec = pow(max(dot(normal, fillHalf), 0.0), 512.0) * centerFactor;
  waterColor += fillSpec * vec3<f32>(0.4, 0.6, 0.8) * 0.3;
  
  let mouseLight = normalize(vec3<f32>(mousePos.x, -mousePos.y, 0.5));
  let mouseSpec = pow(max(dot(normal, mouseLight), 0.0), 128.0) * centerFactor;
  waterColor += mouseSpec * mouseStrength * vec3<f32>(0.5, 0.8, 1.0) * 0.6;

  let rim = pow(1.0 - viewDot, 3.5) * (1.0 - edgeSoftness * 0.5);
  waterColor += rim * vec3<f32>(0.18, 0.45, 0.85) * 0.4;

  let softEdge = smoothstep(0.85, 1.0, 1.0 - viewDot);
  waterColor = mix(waterColor, waterColor * 0.7 + vec3<f32>(0.08, 0.22, 0.45), softEdge * 0.6);

  // Extra details
  let bubblePos = p * 6.0 + vec3<f32>(sin(u.time * 0.4) * 0.3, u.time * 0.5, cos(u.time * 0.3) * 0.2);
  let bubble = smoothstep(0.45, 0.5, noise(bubblePos.xy + bubblePos.z * 0.5));
  waterColor += bubble * 0.1 * centerFactor;

  let scatter = pow(max(1.0 - abs(dot(refractDir, exitNormal)), 0.0), 2.0);
  waterColor += scatter * vec3<f32>(0.1, 0.25, 0.4) * 0.2;

  // Final tone mapping
  let gray = dot(waterColor, vec3<f32>(0.299, 0.587, 0.114));
  waterColor = mix(vec3<f32>(gray), waterColor, 1.15);
  
  waterColor = waterColor / (waterColor + vec3<f32>(0.75));
  waterColor = pow(waterColor, vec3<f32>(1.0 / 1.1));
  waterColor = clamp(waterColor, vec3<f32>(0.0), vec3<f32>(1.0));
  
  let alpha = smoothstep(0.0, 0.15, viewDot);
  return vec4<f32>(waterColor, alpha);
}
