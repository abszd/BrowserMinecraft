varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_position;
varying float v_fogDepth;
varying vec3 v_worldPos;
varying vec3 v_worldNormal;

uniform float time;

void main() {
    v_uv = uv;
    v_normal = normalMatrix * normal;
    v_worldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    v_position = viewPos.xyz;

    float waveHeight = 0.05;
    float waveFrequency = 2.0;
    
    v_worldPos = (modelMatrix * vec4(position, 1.0)).xyz;

    float wave = sin(position.x + time * 3. ) * 
                sin(position.z + time * 3.) * 
                waveHeight - waveHeight/2.;
    
    vec3 newPosition = position;
    newPosition.y += wave * .5;
    newPosition.x += wave * 1.;
    newPosition.z += wave * 1.333;

    v_fogDepth =  sqrt(v_position.z * v_position.z + v_position.x * v_position.x);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);

}