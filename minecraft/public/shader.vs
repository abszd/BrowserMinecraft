attribute vec2 atlasOffset;

varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_position;
varying vec3 v_worldPos;
varying vec3 v_worldNormal;
varying vec3 viewDir;
varying vec2 v_atlasOffset;

uniform sampler2D colormap;
uniform float time;
uniform vec2 atlasSize;
uniform vec2 tileSize;

void main() {
    v_uv = uv;
    v_normal = normalize(normalMatrix * normal);
    v_worldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    v_worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    viewDir = normalize(cameraPosition - v_worldPos);
    v_atlasOffset = atlasOffset;
    
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    v_position = viewPos.xyz;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}