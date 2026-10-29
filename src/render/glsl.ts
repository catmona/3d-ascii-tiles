// Shader snippets shared by the renderer's draw commands
import {
    LIGHTS_PER_CELL,
    LIGHT_CELL,
    RECORDS_PER_ROW,
    RECORD_TEXELS,
    Z_OFFSET,
} from './LightGrid'
import { DYNAMIC_LIGHTS } from '../map/Lighting'

export const NEAR = 0.5
export const FAR = 3000
export const EXPOSURE = 1.3

// Glyph instances pack four things into their `effect` float, all small whole
// numbers so the float holds them exactly:
//   effect + UPRIGHT * upright + LAMPS * lamps + NORMAL * (nx * 256 + ny)
// effect is ripple / glow / blink; upright marks walls, trees and props (they cast
// shadows and face the camera for lighting) as opposed to ground; lamps marks glyphs
// that some fixed light can reach (the rest skip the light grid entirely); nx and ny
// are the ground's slope normal, each mapped from -1..1 to a byte.
export const UPRIGHT = 4
export const LAMPS = 8
export const NORMAL = 16
// Detail records pack the same into their kind: kind + 32 * lamps + 64 * normal
export const DETAIL_LAMPS = 32
export const DETAIL_NORMAL = 64

export function packNormal(gx: number, gy: number): number {
    // The surface z = h(x, y) has normal (-gx, -gy, 1)
    const length = Math.hypot(gx, gy, 1)
    const byte = (v: number) => Math.round((v * 0.5 + 0.5) * 255)
    return byte(-gx / length) * 256 + byte(-gy / length)
}

export const FLAT = packNormal(0, 0)

// The sky colour in any direction. Shared by the sky and the glyphs, so fog always
// matches the sky behind it
export const SKY_GLSL = `
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uForward;
uniform float uFocal;
uniform float uAspect;
uniform vec2 uResolution;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uBackdrop;
uniform vec3 uSunDir; // toward the sun
uniform float uGlowFocus; // 0: the horizon glows all round; 1: mostly on the sun's side

vec3 viewRay(vec2 fragCoord) {
    vec2 ndc = fragCoord / uResolution * 2.0 - 1.0;
    return normalize(uForward + (uRight * ndc.x * uAspect + uUp * ndc.y) / uFocal);
}

vec3 skyColor(vec3 dir) {
    vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.45, dir.z));
    sky = mix(sky, uBackdrop, smoothstep(0.0, 0.5, -dir.z));
    float sunward = 0.5 + 0.5 * dot(normalize(dir.xy + 1e-4), normalize(uSunDir.xy + 1e-4));
    float gather = mix(1.0, 0.3 + 1.7 * sunward * sunward * sunward, uGlowFocus);
    return sky + uGlow * exp(-abs(dir.z) * 14.0) * gather;
}
`

// The camera's perspective, shared by everything drawn in the world so their depths
// agree (the terrain occluder has to land in exactly the same depth as the glyphs)
export const PROJECT_GLSL = `
uniform vec3 uEye;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uForward;
uniform float uFocal;
uniform float uAspect;

const float NEAR = ${NEAR.toFixed(1)};
const float FAR = ${FAR.toFixed(1)};

vec3 toView(vec3 world) {
    vec3 rel = world - uEye;
    return vec3(dot(rel, uRight), dot(rel, uUp), dot(rel, uForward));
}

vec4 project(vec3 view) {
    return vec4(
        view.x * uFocal / uAspect,
        view.y * uFocal,
        (view.z * (FAR + NEAR) - 2.0 * FAR * NEAR) / (FAR - NEAR),
        view.z
    );
}
`

// The sun's (or moon's) orthographic view, for the shadow map: x and y across it,
// z away from the light, all in tiles
export const LIGHT_SPACE_GLSL = `
uniform vec4 uShadowX;
uniform vec4 uShadowY;
uniform vec4 uShadowZ;
uniform vec4 uShadowScale; // 1 / half-width, 1 / half-height, 1 / half-depth, one texel

vec3 lightSpace(vec3 world) {
    return vec3(
        dot(world, uShadowX.xyz) - uShadowX.w,
        dot(world, uShadowY.xyz) - uShadowY.w,
        dot(world, uShadowZ.xyz) - uShadowZ.w
    );
}
`

// Depth 0..1 in an RGBA8 texel (24 bits are plenty)
export const PACK_GLSL = `
vec4 packDepth(float depth) {
    vec3 enc = fract(depth * vec3(1.0, 255.0, 65025.0));
    enc.xy -= enc.yz / 255.0;
    return vec4(enc, 1.0);
}

float unpackDepth(vec4 c) {
    return dot(c.rgb, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0));
}
`

// Stand a camera-facing card at a point in the world, light it and fog it toward
// the horizon. Glowing glyphs (glow = 1) are lit from within and cut through fog.
export const BILLBOARD_GLSL = `
${PROJECT_GLSL}
${LIGHT_SPACE_GLSL}
${PACK_GLSL}
uniform vec4 uLightPos[${DYNAMIC_LIGHTS}]; // xyz, radius
uniform vec4 uLightColor[${DYNAMIC_LIGHTS}]; // rgb, already scaled by intensity
uniform vec4 uLightBounds; // centre and radius of a sphere no moving light reaches past
uniform sampler2D uLightCells;
uniform sampler2D uLightRecords;
uniform vec2 uLightCellCount;
uniform vec2 uLightRecordSize;
uniform float uLightScale; // point lights matter at night, hardly at all by day
uniform vec3 uKeyDir; // toward the sun or moon
uniform vec3 uKeyColor;
uniform vec3 uAmbient;
uniform float uGlowLevel;
uniform sampler2D uShadowMap;
uniform float uFogStart;
uniform float uFogRange;
uniform float uDim;
uniform float uTime;
uniform vec2 uCellUV;
varying vec2 vUv;
varying vec3 vColor;
varying float vHaze;

// A slope normal packed as nx * 256 + ny, each a byte
vec3 unpackNormal(float code) {
    float qx = floor(code / 256.0);
    vec2 n = vec2(qx, code - qx * 256.0) / 255.0 * 2.0 - 1.0;
    return vec3(n, sqrt(max(0.0, 1.0 - dot(n, n))));
}

// Split a packed effect (see UPRIGHT, LAMPS and NORMAL) into its parts
float unpackEffect(float bits, out float upright, out float lamps, out vec3 normal) {
    float code = floor(bits / ${NORMAL}.0);
    float rest = bits - code * ${NORMAL}.0;
    lamps = floor(rest / ${LAMPS}.0);
    rest -= lamps * ${LAMPS}.0;
    upright = floor(rest / ${UPRIGHT}.0);
    normal = unpackNormal(code);
    return rest - upright * ${UPRIGHT}.0;
}

// The lantern and the motes: a few uniforms, rebuilt every frame. Most of the world
// is out of their reach and skips the loop entirely.
vec3 movingLights(vec3 world) {
    vec3 sum = vec3(0.0);
    vec3 fromBounds = world - uLightBounds.xyz;
    if (dot(fromBounds, fromBounds) > uLightBounds.w * uLightBounds.w) return sum;
    for (int i = 0; i < ${DYNAMIC_LIGHTS}; i++) {
        vec3 toLight = uLightPos[i].xyz - world;
        float reach = uLightPos[i].w;
        float falloff = max(0.0, 1.0 - dot(toLight, toLight) / (reach * reach));
        sum += uLightColor[i].rgb * falloff * falloff;
    }
    return sum;
}

// Every torch, brazier, beacon and crystal in the map, from the light grid (see
// LightGrid.ts): the cell under the glyph lists the few that can reach it
vec3 fixedLights(vec3 world) {
    vec3 sum = vec3(0.0);
    vec2 cell = floor(world.xy / ${LIGHT_CELL}.0);
    vec4 header = floor(texture2D(uLightCells, (cell + 0.5) / uLightCellCount) * 255.0 + 0.5);
    if (header.b < 0.5) return sum;
    float first = header.r * 256.0 + header.g;
    vec2 texel = vec2(1.0 / uLightRecordSize.x, 0.0);
    for (int i = 0; i < ${LIGHTS_PER_CELL}; i++) {
        if (float(i) >= header.b) break;
        float k = first + float(i);
        float row = floor(k / ${RECORDS_PER_ROW}.0);
        vec2 uv = (vec2((k - row * ${RECORDS_PER_ROW}.0) * ${RECORD_TEXELS}.0, row) + 0.5)
            / uLightRecordSize;
        vec4 a = texture2D(uLightRecords, uv) * 255.0;
        vec4 b = texture2D(uLightRecords, uv + texel) * 255.0;
        vec3 position = vec3(
            (a.r * 256.0 + a.g) / 32.0,
            (a.b * 256.0 + a.a) / 32.0,
            (b.r * 256.0 + b.g) / 64.0 - ${Z_OFFSET}.0
        );
        vec3 toLight = position - world;
        float reach = b.b / 4.0;
        float falloff = max(0.0, 1.0 - dot(toLight, toLight) / (reach * reach));
        if (falloff <= 0.0) continue;

        // Flames gutter and crystals breathe, each out of step with the next
        vec4 c = texture2D(uLightRecords, uv + texel * 2.0);
        float seed = position.x * 0.37 + position.y * 0.71;
        float flame = 0.75 + 0.25 * (sin(uTime * 13.0 + seed) * 0.5
            + sin(uTime * 7.3 + seed * 1.7) * 0.3
            + sin(uTime * 23.0 + seed * 3.1) * 0.2);
        float flicker = b.a / 255.0;
        float strength = 1.0 - flicker + flicker * flame;
        float pulse = c.a * 255.0 / 32.0;
        if (pulse > 0.0) strength *= 0.7 + 0.3 * sin(uTime * pulse + seed);
        sum += c.rgb * 2.0 * strength * falloff * falloff;
    }
    return sum;
}

// How much of the sun (or moon) reaches a point: 1 in the open, 0 in full shadow.
// A few taps of the shadow map soften the edges. Past the map's square, everything
// is lit, fading in toward its border so there's no hard line.
float sunlight(vec3 world) {
    // Look from a little toward the light so a glyph doesn't shadow itself
    vec3 s = lightSpace(world + uKeyDir * 0.7);
    vec2 uv = s.xy * uShadowScale.xy * 0.5 + 0.5;
    float edge = max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0;
    if (edge >= 1.0) return 1.0;
    float depth = s.z * uShadowScale.z * 0.5 + 0.5;
    float spread = uShadowScale.w * 1.5;
    float lit = step(depth, unpackDepth(texture2D(uShadowMap, uv + vec2(-spread, -spread))))
        + step(depth, unpackDepth(texture2D(uShadowMap, uv + vec2(spread, -spread))))
        + step(depth, unpackDepth(texture2D(uShadowMap, uv + vec2(-spread, spread))))
        + step(depth, unpackDepth(texture2D(uShadowMap, uv + vec2(spread, spread))));
    // Shadows keep a little of the light: the sky and the ground bounce some in
    return mix(0.2 + lit * 0.2, 1.0, smoothstep(0.8, 1.0, edge));
}

// How squarely the key light falls on a glyph. Ground faces up its slope. Upright
// things (walls, trunks, leaves) face the camera, so they're lit with the sun behind
// you and only rimmed by it from in front; they're rounder than a flat face, so the
// light wraps further round them.
float facing(vec3 normal, float upright) {
    if (upright > 0.5) {
        vec3 n = normalize(vec3(-uForward.xy, 0.6));
        return max(0.0, (dot(n, uKeyDir) + 0.6) / 1.6);
    }
    return max(0.0, (dot(normal, uKeyDir) + 0.2) / 1.2);
}

void billboard(vec3 world, vec2 corner, float size, vec2 uv, vec3 color, float shade,
    float glow, vec3 normal, float upright, float lamps) {
    vec3 view = toView(world);
    view.xy += vec2(corner.x - 0.5, 0.5 - corner.y) * size;
    gl_Position = project(view);
    vUv = uv + corner * uCellUV;

    // Sky light everywhere, plus the sun (or moon) where it reaches
    vec3 key = uKeyColor * facing(normal, upright);
    if (dot(key, key) > 1e-4) key *= sunlight(world);
    vec3 sky = uAmbient + key;

    // Point lights tint what they fall on by its own colour, plus a little of their
    // own so even dark glyphs pick up the hue
    vec3 lights = movingLights(world);
    if (lamps > 0.5) lights += fixedLights(world);
    lights *= uLightScale;
    vec3 lit = color * (shade * ${EXPOSURE.toFixed(2)} * sky + lights * 1.1) + lights * 0.08;
    // Roll off highlights so overlapping lights saturate instead of bleaching to white
    lit /= 1.0 + max(vec3(0.0), lit - 0.9);
    vColor = mix(lit, color * uGlowLevel * shade, glow) * uDim;
    vHaze = (1.0 - exp(-pow(max(0.0, length(world - uEye) - uFogStart) / uFogRange, 2.0)))
        * (1.0 - 0.5 * glow);
}
`

// Alpha-to-coverage turns the glyph's ink into MSAA coverage: smooth edges with no
// sorting, and far-off glyphs thin out instead of flickering
export const GLYPH_FRAG = `
precision highp float;
uniform sampler2D atlas;
${SKY_GLSL}
varying vec2 vUv;
varying vec3 vColor;
varying float vHaze;

void main() {
    float ink = texture2D(atlas, vUv).a;
    if (ink < 0.04) discard;
    gl_FragColor = vec4(mix(vColor, skyColor(viewRay(gl_FragCoord.xy)), vHaze), ink);
}
`

// Shadow casters write their distance from the light. Glyphs cast the shape of their
// ink, nothing from the empty part of the card.
export const CASTER_FRAG = `
precision highp float;
uniform sampler2D atlas;
uniform float uInked; // 0 for the terrain, which is solid
varying vec2 vUv;
varying float vDepth;
${PACK_GLSL}

void main() {
    if (uInked > 0.5 && texture2D(atlas, vUv).a < 0.5) discard;
    gl_FragColor = packDepth(vDepth);
}
`
