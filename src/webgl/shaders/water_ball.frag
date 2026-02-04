#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform vec4 uMouse;
uniform vec2 uVelocity;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  ) * 2.0 - 1.0;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

// --- Waves ---

float waterWaves(vec2 pos, float time, vec2 mouse, float velMag) {
  float waves = 0.0;
  
  // Organic wave layers
  vec2 d1 = normalize(vec2(0.8, 0.6));
  waves += sin(dot(pos, d1) * 2.2 + time * 0.9) * 0.22;
  
  vec2 d2 = normalize(vec2(-0.7, 0.4));
  waves += sin(dot(pos, d2) * 4.3 - time * 1.5) * 0.15;
  
  float angle3 = time * 0.2;
  vec2 d3 = vec2(cos(angle3), sin(angle3));
  waves += sin(dot(pos, d3) * 7.1 + time * 2.1) * 0.08;
  
  vec2 d4 = normalize(vec2(0.1, -0.9));
  waves += sin(dot(pos, d4) * 13.0 - time * 3.2) * 0.05;
  
  waves += fbm(pos * 1.2 + vec2(time * 0.4, -time * 0.3)) * 0.2;
  
  // Interactions
  float distToMouse = length(pos - vec2(mouse.x, -mouse.y));
  float interactionStrength = exp(-distToMouse * 3.5);
  
  waves += fbm(pos * 4.0 + time * 1.8) * 0.25 * interactionStrength;
  
  float mouseWave = sin(pos.x * 6.0 + mouse.x * 15.0 + time * 3.0) * 
                    cos(pos.y * 6.0 + mouse.y * 15.0 + time * 2.5);
  waves += mouseWave * 0.35 * interactionStrength;
  
  waves += sin(distToMouse * 18.0 - time * 6.0) * velMag * 0.45 * interactionStrength;
  
  return waves;
}

vec2 raySphere(vec3 ro, vec3 rd, vec3 center, float radius) {
  vec3 oc = ro - center;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - radius * radius;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  float sq = sqrt(h);
  return vec2(-b - sq, -b + sq);
}

vec3 getWaterNormal(vec3 p, float time, vec2 mouse, float velMag) {
  float eps = 0.008;
  float waves = waterWaves(p.xy, time, mouse, velMag);
  float wavesX = waterWaves(p.xy + vec2(eps, 0.0), time, mouse, velMag);
  float wavesY = waterWaves(p.xy + vec2(0.0, eps), time, mouse, velMag);
  
  float dx = (wavesX - waves) / eps;
  float dy = (wavesY - waves) / eps;
  
  // Sharpen normals slightly for better highlights
  return normalize(vec3(-dx * 0.25, -dy * 0.25, 0.8));
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = vUv;
  uv.x *= aspect;

  vec3 ro = vec3(0.0, 0.0, 3.5);
  vec3 rd = normalize(vec3(uv, -2.0));

  vec3 sphereCenter = vec3(0.0);
  float sphereRadius = 1.0;

  vec2 hit = raySphere(ro, rd, sphereCenter, sphereRadius);
  if (hit.x < 0.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec3 p = ro + rd * hit.x;
  vec3 baseNormal = normalize(p - sphereCenter);
  
  float distFromCenter = length(p.xy - sphereCenter.xy);
  float edgeSoftness = smoothstep(sphereRadius * 0.92, sphereRadius * 0.99, distFromCenter);
  float centerFactor = 1.0 - edgeSoftness;
  
  vec2 mousePos = uMouse.xy;
  float mouseStrength = length(mousePos);
  vec2 velocity = uVelocity;
  float velMag = length(velocity);

  // --- Normals ---
  vec3 waveNormal = getWaterNormal(p, uTime, mousePos, velMag);
  
  vec3 tangent = normalize(cross(baseNormal, vec3(0.0, 1.0, 0.001)));
  vec3 bitangent = cross(baseNormal, tangent);
  mat3 tbn = mat3(tangent, bitangent, baseNormal);
  vec3 normal = normalize(tbn * waveNormal);
  
  normal = normalize(mix(normal, baseNormal, edgeSoftness * 0.7));
  
  vec3 mouseWorld = vec3(mousePos.x * 1.2, -mousePos.y * 1.2, 0.5);
  vec3 toMouse = mouseWorld - p;
  float mouseDist = length(toMouse);
  
  float magneticPull = exp(-mouseDist * 1.5) * mouseStrength * 0.6 * centerFactor;
  vec3 magneticDir = normalize(toMouse);
  normal = normalize(normal + magneticDir * magneticPull);
  
  vec3 velDeform = vec3(velocity.x, -velocity.y, 0.0) * 0.3 * centerFactor;
  normal = normalize(normal + velDeform);
  
  float rippleDist = length(p.xy - vec2(mousePos.x, -mousePos.y));
  float ripple = sin(rippleDist * 20.0 - uTime * 8.0) * exp(-rippleDist * 2.0);
  float rippleStrength = (mouseStrength * 0.4 + velMag * 0.6) * centerFactor;
  normal = normalize(normal + vec3(ripple, ripple, 0.0) * rippleStrength);

  // Fresnel
  float viewDot = abs(dot(rd, baseNormal));
  float F0 = 0.02;
  float fresnel = F0 + (1.0 - F0) * pow(1.0 - viewDot, 5.0);

  // Refraction
  float ior = 1.33;
  vec3 refractDir = refract(rd, normal, 1.0 / ior);
  
  vec2 internalHit = raySphere(p + refractDir * 0.01, refractDir, sphereCenter, sphereRadius);
  vec3 exitPoint = p + refractDir * (internalHit.y + 0.01);
  vec3 exitNormal = normalize(exitPoint - sphereCenter);
  vec3 exitRefract = refract(refractDir, -exitNormal, ior);

  // Color & Scattering
  float waterDepth = length(exitPoint - p);
  
  vec3 deepWater = vec3(0.005, 0.04, 0.12);
  vec3 midWater = vec3(0.0, 0.25, 0.4);
  vec3 shallowWater = vec3(0.1, 0.5, 0.7);
  vec3 glowWater = vec3(0.2, 0.6, 0.9);
  vec3 sssColor = vec3(0.05, 0.4, 0.6);
  
  float absorption = exp(-waterDepth * 1.5);
  vec3 waterColor = mix(deepWater, shallowWater, absorption);
  
  float coreDarkness = smoothstep(0.4, 0.0, viewDot);
  waterColor = mix(waterColor, waterColor * 0.6, coreDarkness * 0.5);
  
  float sss = pow(max(dot(rd, -exitNormal), 0.0), 2.0) * (1.0 - fresnel);
  waterColor += sssColor * sss * 0.3;
  
  // Internal flow
  float flowTime = uTime * 0.8;
  vec2 flowDir = normalize(vec2(mousePos.x, -mousePos.y) + velocity + 0.001);
  
  float flowCoord1 = dot(p.xy, flowDir) * 5.0 + flowTime;
  float flowCoord2 = dot(p.xy, vec2(-flowDir.y, flowDir.x)) * 3.0 + flowTime * 0.7;
  float flowBand = sin(flowCoord1) * 0.5 + 0.5;
  float flowBand2 = cos(flowCoord2) * 0.5 + 0.5;
  
  waterColor = mix(waterColor * 0.9, waterColor * 1.15, flowBand * 0.25 * centerFactor);
  waterColor = mix(waterColor, glowWater, flowBand2 * mouseStrength * 0.15);
  
  float swirl = atan(p.y + mousePos.y, p.x - mousePos.x);
  float swirlPattern = sin(swirl * 4.0 + uTime * 1.2 + mouseDist * 6.0) * 0.5 + 0.5;
  waterColor = mix(waterColor, waterColor * 1.1, swirlPattern * mouseStrength * 0.2 * centerFactor);

  float magneticGlow = exp(-mouseDist * 2.5) * mouseStrength * centerFactor;
  waterColor += magneticGlow * vec3(0.1, 0.4, 0.6) * 0.8;

  // Caustics
  float ct = uTime * 0.4;
  float c1 = sin(exitPoint.x * 10.0 + ct) * cos(exitPoint.y * 8.0 + ct * 0.8);
  float c2 = sin(exitPoint.x * 8.0 - ct * 1.1) * cos(exitPoint.y * 10.0 - ct);
  float c3 = sin(exitPoint.x * 6.0 + exitPoint.y * 7.0 + ct * 0.6);
  float caustics = pow(max(c1 * c2 + 0.5, 0.0), 2.0) * 0.25;
  caustics += pow(max(c3 + 0.3, 0.0), 3.0) * 0.15;
  waterColor += caustics * vec3(0.35, 0.55, 0.85) * centerFactor;

  float velCaustics = pow(max(sin(exitPoint.x * 12.0 + velocity.x * 10.0) * 
                            cos(exitPoint.y * 12.0 - velocity.y * 10.0) + 0.5, 0.0), 2.0);
  waterColor += velCaustics * velMag * vec3(0.25, 0.45, 0.75) * 0.35 * centerFactor;

  float waveHeight = waterWaves(p.xy, uTime, mousePos, velMag);
  float waveHighlight = smoothstep(0.15, 0.35, waveHeight) * 0.12 * centerFactor;
  waterColor += waveHighlight * vec3(0.5, 0.75, 1.0);

  // Reflections
  vec3 reflectDir = reflect(rd, normal);
  vec3 envColor = mix(vec3(0.02, 0.1, 0.25), vec3(0.15, 0.4, 0.7), reflectDir.y * 0.5 + 0.5);
  waterColor = mix(waterColor, envColor, fresnel * 0.5);

  // Specular
  vec3 sunDir = normalize(vec3(0.4, 1.0, 0.7));
  vec3 sunHalf = normalize(sunDir - rd);
  float sunSpec1 = pow(max(dot(normal, sunHalf), 0.0), 2048.0) * centerFactor;
  float sunSpec2 = pow(max(dot(normal, sunHalf), 0.0), 256.0) * centerFactor;
  waterColor += (sunSpec1 * 3.5 + sunSpec2 * 0.4) * vec3(1.0, 0.98, 0.9);
  
  vec3 fillDir = normalize(vec3(-0.6, 0.6, 0.5));
  vec3 fillHalf = normalize(fillDir - rd);
  float fillSpec = pow(max(dot(normal, fillHalf), 0.0), 512.0) * centerFactor;
  waterColor += fillSpec * vec3(0.4, 0.6, 0.8) * 0.3;
  
  vec3 mouseLight = normalize(vec3(mousePos.x, -mousePos.y, 0.5));
  float mouseSpec = pow(max(dot(normal, mouseLight), 0.0), 128.0) * centerFactor;
  waterColor += mouseSpec * mouseStrength * vec3(0.5, 0.8, 1.0) * 0.6;

  float rim = pow(1.0 - viewDot, 3.5) * (1.0 - edgeSoftness * 0.5);
  waterColor += rim * vec3(0.18, 0.45, 0.85) * 0.4;

  float softEdge = smoothstep(0.85, 1.0, 1.0 - viewDot);
  waterColor = mix(waterColor, waterColor * 0.7 + vec3(0.08, 0.22, 0.45), softEdge * 0.6);

  // Extra details
  vec3 bubblePos = p * 6.0 + vec3(sin(uTime * 0.4) * 0.3, uTime * 0.5, cos(uTime * 0.3) * 0.2);
  float bubble = smoothstep(0.45, 0.5, noise(bubblePos.xy + bubblePos.z * 0.5));
  waterColor += bubble * 0.1 * centerFactor;

  float scatter = pow(max(1.0 - abs(dot(refractDir, exitNormal)), 0.0), 2.0);
  waterColor += scatter * vec3(0.1, 0.25, 0.4) * 0.2;

  // Final tone mapping
  float gray = dot(waterColor, vec3(0.299, 0.587, 0.114));
  waterColor = mix(vec3(gray), waterColor, 1.15);
  
  waterColor = waterColor / (waterColor + vec3(0.75));
  waterColor = pow(waterColor, vec3(1.0 / 1.1));
  waterColor = clamp(waterColor, vec3(0.0), vec3(1.0));
  
  float alpha = smoothstep(0.0, 0.15, viewDot);
  fragColor = vec4(waterColor, alpha);
}
