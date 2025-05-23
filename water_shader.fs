precision highp float;

float uOpacity = 0.8;

vec3 uTroughColor = vec3(0, 0.10196078431372549, 0.2);
vec3 uSurfaceColor = vec3(0, 0.2, 0.4);
vec3 uPeakColor = vec3(0.4, 1., .8);

float uPeakThreshold = 0.15;
float uPeakTransition = 0.15;
float uTroughThreshold = -0.01;
float uTroughTransition = 0.15;

float uFresnelScale = 0.8;
float uFresnelPower = 0.5;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 v_position;
varying float noise;
uniform samplerCube envMap;
uniform float renderDistance;
uniform float renderFade;

void main() {
    vec3 viewDirection = normalize(vWorldPosition - cameraPosition);
    vec3 reflectedDirection = reflect(viewDirection, vNormal);
    reflectedDirection.x = -reflectedDirection.x;
    vec3 rotatedDirection = vec3(reflectedDirection.z, reflectedDirection.y, -reflectedDirection.x);

    vec4 reflectionColor = textureCube(envMap, rotatedDirection);

    float fresnel = uFresnelScale * pow(1.0 - clamp(dot(viewDirection, vNormal), 0.0, 1.0), uFresnelPower);

    float elevation = noise;

    float peakFactor = smoothstep(uPeakThreshold - uPeakTransition, uPeakThreshold + uPeakTransition, elevation);
    float troughFactor = smoothstep(uTroughThreshold - uTroughTransition, uTroughThreshold + uTroughTransition, elevation);

    vec3 mixedColor1 = mix(uTroughColor, uSurfaceColor, troughFactor);

    vec3 mixedColor2 = mix(mixedColor1, uPeakColor, peakFactor);


    vec3 finalColor = mix(mixedColor2, reflectionColor.rgb, fresnel);
        
    float fogFactor = smoothstep(renderDistance - renderFade, renderDistance, length(vec2(vWorldPosition.x - cameraPosition.x, vWorldPosition.z - cameraPosition.z)));
    if(fogFactor >= 1.){ discard; }
    
    finalColor = mix(finalColor, vec3(.5, .8, .9), fogFactor);

    gl_FragColor = vec4(finalColor, uOpacity);
}