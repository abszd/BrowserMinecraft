varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_position;
varying vec3 v_worldPos;
varying vec3 v_worldNormal;

uniform sampler2D colormap;
uniform float renderDistance;
uniform float renderFade;
uniform float time;

/* the vertex shader just passes stuff to the fragment shader after doing the
 * appropriate transformations of the vertex information
 */
void main() {
    // pass the texture coordinate to the fragment
    v_uv = uv;
    v_normal = normalMatrix * normal;
    v_worldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    v_worldPos = (modelMatrix * vec4(position, 1.0)).xyz;

    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    v_position = viewPos.xyz;
    
    // the main output of the shader (the vertex position)
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}
