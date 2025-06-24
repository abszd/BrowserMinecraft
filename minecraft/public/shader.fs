in vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_worldNormal;
varying vec3 v_position;
varying vec3 v_worldPos;
in float v_depth;
varying vec3 viewDir;

uniform sampler2DArray textureArray;
uniform float time;
uniform float renderDistance;
uniform float renderFade;

vec3 lightDir = normalize(vec3(1., .7, .8));
vec3 sunColor = vec3(1.0, 0.95, 0.8);

void main() {
    float fogFactor = smoothstep(renderDistance - renderFade, renderDistance, length(vec2(v_worldPos.x - cameraPosition.x, v_worldPos.z - cameraPosition.z)));
    if(fogFactor >= 1.){ discard; }

    vec4 texColor = texture2D(textureArray, vec3(v_uv.x, -v_uv.y, int(v_depth)));
    
    vec3 viewDir = normalize(cameraPosition - v_worldPos);

    // diffuse/directional light
    float diffuse = max(dot(v_worldNormal, lightDir), 0.2);
    diffuse += 0.5 * max(dot(v_normal, lightDir), 0.2);
    float backLight = max(0.0, dot(-lightDir, v_normal)) * 0.3;
    diffuse = pow(diffuse + backLight, 0.8) * 0.75 + 0.25;

    //specular
    float skyLight = max(v_normal.y, 0.0) * 0.2 + 0.2;
    vec3 halfDir = normalize(lightDir + viewDir);
    float specular = pow(max(dot(v_normal, halfDir), 0.0), 16.0) * 0.1;
    
    vec3 finalColor = texColor.rgb * (diffuse * sunColor + vec3(0.6, 0.7, 1.0) * skyLight);
    finalColor += specular * sunColor; 
    
    //saturation
    float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
    float saturationFactor = 2.; 
    finalColor = mix(vec3(luminance), finalColor, saturationFactor);
    float warmth = max(0.0, dot(v_normal, lightDir));
    finalColor = mix(finalColor, finalColor * vec3(1.05, 1.0, 0.95), warmth * 0.2);
    

    //ao 
    // vec2 edgeDist = min(fract(v_uv), 1. - fract(v_uv));
    // float ao = smoothstep(0.0, .4, (edgeDist.x + edgeDist.y) * 0.5);
    // finalColor *= ao * 2.;

    finalColor = pow(finalColor, vec3(0.85)); 
    
    finalColor = mix(finalColor, vec3(.7, .9, 1.), fogFactor);
    
    gl_FragColor = vec4(finalColor, texColor.a);
}