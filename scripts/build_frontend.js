const fs=require("node:fs");
const path=require("node:path");
const postcss=require("postcss");
const tailwindcss=require("tailwindcss");
const autoprefixer=require("autoprefixer");
const esbuild=require("esbuild");
const ROOT=path.resolve(__dirname,".."),OUT=path.join(ROOT,"dist");
function copy(source){const from=path.join(ROOT,source);if(!fs.existsSync(from))throw new Error("Required frontend file is missing: "+source);fs.cpSync(from,path.join(OUT,source),{recursive:true,force:true});}
async function build(){
 fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
 ["index.html","app.js","crypto.js","security.js","webrtc.js","style.css","shadcn.css","manifest.webmanifest","sw.js","zyntrixly-logo.svg","assets","vendor","src"].forEach(copy);
 await esbuild.build({absWorkingDir:ROOT,entryPoints:["src/ui/main.jsx"],outfile:path.join(OUT,"v5-ui.js"),bundle:true,format:"iife",platform:"browser",target:["es2020"],jsx:"automatic",alias:{"@":path.join(ROOT,"src")},minify:true,sourcemap:false,legalComments:"none"});
 const css=fs.readFileSync(path.join(ROOT,"src/ui/index.css"),"utf8");
 const output=await postcss([tailwindcss(require("../tailwind.config.js")),autoprefixer]).process(css,{from:path.join(ROOT,"src/ui/index.css"),to:path.join(OUT,"v5-ui.css")});
 fs.writeFileSync(path.join(OUT,"v5-ui.css"),output.css);
 console.log("Zyntrixly V5 shadcn/ui frontend built to dist/.");
}
build().catch(error=>{console.error("Frontend build failed:",error);process.exitCode=1;});
