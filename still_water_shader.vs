precision highp float;

uniform float time;
uniform samplerCube envMap;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 v_position;

void main() {
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);

  vNormal = normalize(normalMatrix * normal);; 
  vWorldPosition = modelPosition.xyz;
  
  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
  v_position = viewPos.xyz;

  gl_Position = projectionMatrix * viewMatrix * modelPosition;
}