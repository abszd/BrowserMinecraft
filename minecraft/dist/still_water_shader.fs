precision highp float;

float uOpacity = 0.9;

vec3 uTroughColor = vec3(0, 0.10196078431372549, 0.2);
vec3 uSurfaceColor = vec3(0, 0.6, 1.);


float uFresnelScale = 0.8;
float uFresnelPower = 0.5;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 v_position;
uniform samplerCube envMap;
uniform float renderDistance;
uniform float renderFade;

void main() {
	float fogFactor = smoothstep(renderDistance - renderFade, renderDistance, length(vec2(vWorldPosition.x - cameraPosition.x, vWorldPosition.z - cameraPosition.z)));
    if(fogFactor >= 1.){ discard; }
    
    vec3 viewDirection = normalize(vWorldPosition - cameraPosition);
    vec3 lightDir = normalize(vec3(1., .7, .8));
    
    float dotProduct = dot(viewDirection, vNormal);
    float smoothDot = smoothstep(-0.2, 1.0, dotProduct);
    float fresnel = uFresnelScale * pow(1.0 - smoothDot, uFresnelPower);
    
    float lightDot = max(0.0, dot(lightDir, vNormal));
    
    vec3 finalColor = mix(uTroughColor, uSurfaceColor, fresnel * lightDot);
    
    finalColor = mix(finalColor, vec3(.5, .8, .9), fogFactor);
    gl_FragColor = vec4(finalColor, uOpacity);
}