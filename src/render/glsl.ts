// Shader snippets shared by the renderer's draw commands
import { MAX_LIGHTS } from '../map/Lighting'

export const NEAR = 0.5
export const FAR = 3000
export const EXPOSURE = 1.3

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

vec3 viewRay(vec2 fragCoord) {
    vec2 ndc = fragCoord / uResolution * 2.0 - 1.0;
    return normalize(uForward + (uRight * ndc.x * uAspect + uUp * ndc.y) / uFocal);
}

vec3 skyColor(vec3 dir) {
    vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.45, dir.z));
    sky = mix(sky, uBackdrop, smoothstep(0.0, 0.5, -dir.z));
    return sky + uGlow * exp(-abs(dir.z) * 14.0);
}
`

// Stand a camera-facing card at a point in the world, light it and fog it toward
// the horizon. Glowing glyphs (glow = 1) are lit from within and cut through fog.
export const BILLBOARD_GLSL = `
uniform vec3 uEye;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uForward;
uniform float uFocal;
uniform float uAspect;
uniform vec4 uLightPos[${MAX_LIGHTS}]; // xyz, radius
uniform vec4 uLightColor[${MAX_LIGHTS}]; // rgb, already scaled by intensity
uniform vec4 uLightBounds; // centre and radius of a sphere no light reaches past
uniform float uFogStart;
uniform float uFogRange;
uniform float uDim;
uniform float uTime;
uniform vec2 uCellUV;
varying vec2 vUv;
varying vec3 vColor;
varying float vHaze;

const float NEAR = ${NEAR.toFixed(1)};
const float FAR = ${FAR.toFixed(1)};

// Coloured point lights with a smooth falloff to zero at each light's radius. Most of
// the world is out of reach of every light, and skips the loop entirely.
vec3 pointLights(vec3 world) {
    vec3 sum = vec3(0.0);
    vec3 fromBounds = world - uLightBounds.xyz;
    if (dot(fromBounds, fromBounds) > uLightBounds.w * uLightBounds.w) return sum;
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        vec3 toLight = uLightPos[i].xyz - world;
        float reach = uLightPos[i].w;
        float falloff = max(0.0, 1.0 - dot(toLight, toLight) / (reach * reach));
        sum += uLightColor[i].rgb * falloff * falloff;
    }
    return sum;
}

void billboard(vec3 world, vec2 corner, float size, vec2 uv, vec3 color, float shade, float glow) {
    vec3 rel = world - uEye;
    vec3 view = vec3(dot(rel, uRight), dot(rel, uUp), dot(rel, uForward));
    view.xy += vec2(corner.x - 0.5, 0.5 - corner.y) * size;
    gl_Position = vec4(
        view.x * uFocal / uAspect,
        view.y * uFocal,
        (view.z * (FAR + NEAR) - 2.0 * FAR * NEAR) / (FAR - NEAR),
        view.z
    );

    vUv = uv + corner * uCellUV;
    // Lights tint what they fall on by its own colour, plus a little of their own
    // so even dark glyphs pick up the hue
    vec3 lights = pointLights(world);
    vec3 lit = color * (shade * ${EXPOSURE.toFixed(2)} + lights * 1.1) + lights * 0.08;
    // Roll off highlights so overlapping lights saturate instead of bleaching to white
    lit /= 1.0 + max(vec3(0.0), lit - 0.9);
    vColor = mix(lit, color * 1.6 * shade, glow) * uDim;
    vHaze = (1.0 - exp(-pow(max(0.0, length(rel) - uFogStart) / uFogRange, 2.0)))
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
