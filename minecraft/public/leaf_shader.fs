/* Procedural shading example */
/* the student should make this more interesting */


varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_position;
varying vec3 v_worldNormal;

varying float v_fogDepth;
varying vec3 v_worldPos;

uniform sampler2D colormap;
uniform float time;
uniform float renderDistance;
uniform float renderFade;

void main() {
    vec4 texColor = texture2D(colormap, v_uv);
    
    // Convert grey texture to green with subtle variation
    float grey = dot(texColor.rgb, vec3(0.333));
    float colorNoise = sin(v_worldPos.x * 0.1 + time * 0.1) * cos(v_worldPos.z * 0.1) * 0.1;
    
    // Darker green palette
    vec3 darkGreen = vec3(0.3, 0.7, 0.2);
    vec3 baseGreen = vec3(0.4, 1., 0.3);
    
    vec3 leafColor = mix(darkGreen, baseGreen, grey + colorNoise);
    texColor.rgb = leafColor * texColor.rgb;
    
    vec3 lightDir = normalize(vec3(.6, .5, .8));
    vec3 sunColor = vec3(1.0, 0.95, 0.8);
    vec3 viewDir = normalize(cameraPosition - v_worldPos);

    vec3 wnormal = normalize(v_worldNormal);
    vec3 normal = normalize(v_normal);

    float diffuse = max(dot(wnormal, lightDir), 0.2);
    diffuse += 0.5 * max(dot(normal, lightDir), 0.2);
    
    float backLight = max(0.0, dot(-lightDir, normal)) * 0.3;
    diffuse = pow(diffuse + backLight, 0.8) * 0.75 + 0.25;

    float ao = max(normal.y, 0.0) * 0.2 + 0.2;
    float cavityAO = 1.0 - pow(max(0.0, dot(normal, vec3(0, -1, 0))), 2.0) * 0.3;
    float skyLight = ao * cavityAO;
    
    vec3 halfDir = normalize(lightDir + viewDir);
    float specular = pow(max(dot(normal, halfDir), 0.0), 16.0) * 0.1;
    
    vec3 finalColor = texColor.rgb * (diffuse * sunColor + vec3(0.6, 0.7, 1.0) * skyLight);
    finalColor += specular * sunColor; 

    float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
    float saturationFactor = 3.; 
    finalColor = mix(vec3(luminance), finalColor, saturationFactor);
    
    float warmth = max(0.0, dot(normal, lightDir));
    finalColor = mix(finalColor, finalColor * vec3(1.05, 1.0, 0.95), warmth * 0.1);
    
    finalColor = pow(finalColor, vec3(0.8)); 
    
    float fogFactor = smoothstep(renderDistance - renderFade, renderDistance, length(vec2(v_worldPos.x - cameraPosition.x, v_worldPos.z - cameraPosition.z)));
    if(fogFactor >= 1.){ discard; }
    
    finalColor = mix(finalColor, vec3(1., 1., 1.), fogFactor);
    
    
    gl_FragColor = vec4(finalColor, texColor.a);
}