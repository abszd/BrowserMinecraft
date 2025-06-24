varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_position;
varying vec3 v_worldPos;
varying vec3 v_worldNormal;
varying float v_depth;
varying vec3 viewDir;

attribute float depth;

uniform float renderDistance;
uniform float renderFade;

void main() {
    v_uv = uv;
    v_normal = normalize(normalMatrix * normal);
    v_worldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    v_worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    viewDir = normalize(cameraPosition - v_worldPos);
    v_depth = depth;
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    v_position = viewPos.xyz;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}
