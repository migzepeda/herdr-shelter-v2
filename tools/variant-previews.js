// Redraws previews/shelter_v2-{green,sage,amber}.svg from layouts/shelter_v2.svg and the three themes.
// Run from the repo root: node tools/variant-previews.js   (rerun after editing a theme or the drawing)
const fs=require("fs"),path=require("path");const R=process.argv[2]||path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(R,p),"utf8");
const src=read("layouts/shelter_v2.svg"),orig=JSON.parse(read("themes/shelter_v2.json")).colors;
const T=["canvas","background","chrome","surface","raised","border","input","foreground","muted","dim","accent","blocked"];
fs.writeFileSync(path.join(R,"previews/shelter_v2-green.svg"),src);
for(const n of ["sage","amber"]){const nx=JSON.parse(read(`themes/shelter_v2_${n}.json`)).colors,m={};
for(const t of T)m[orig[t].slice(0,7).toLowerCase()]=nx[t].slice(0,7);
let s=src.replace(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b/g,x=>{const b=x.slice(0,7).toLowerCase();if(!m[b])throw new Error(n+": no token "+x);return m[b]+x.slice(7)});
s=s.replace("SHELTER-OS","SHELTER-OS "+n.toUpperCase());fs.writeFileSync(path.join(R,`previews/shelter_v2-${n}.svg`),s);console.log("wrote",n)}
