/*wittyvisualizer
{
  "format": 1, "id": "rings", "name": "Aurora Rings",
  "description": "Glowing rings that swell with the bass and ripple outward in the colours of the theme. Slow and soft.",
  "tags": ["calm", "rings"], "cost": 2, "motion": "gentle"
}
*/
vec4 effect(vec2 uv) {
  vec2 p = centred(uv);
  float r = length(p);
  float a = atan(p.y, p.x);
  vec3 c = mix(vec3(0.01, 0.01, 0.03), vec3(0.03, 0.02, 0.07), smoothstep(1.1, 0.0, r));
  for (int i = 0; i < 6; i++) {
    float n = float(i) / 6.0;
    float radius = 0.16 + n * 0.17 + 0.05 * bass * intensity + 0.012 * sin(flow * 0.3 + n * 6.0);
    float wobble = 0.012 * sin(a * (3.0 + float(i)) + flow * (0.25 + n * 0.2)) * (0.4 + mid * intensity);
    float d = abs(r - radius - wobble);
    float glow = exp(-d * d * 700.0) + 0.35 * exp(-d * 18.0) * 0.25;
    float heard = spectrum(0.05 + n * 0.6);
    c += palette(0.3 + n * 0.45 + flow * 0.01) * glow * (0.35 + 0.9 * heard * intensity + 0.3 * level);
  }
  return vec4(c, 1.0);
}
