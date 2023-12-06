import a from"repl";import{v as l}from"./package-15561fbc.mjs";import{t as m}from"./index-9eae64fa.mjs";import"url";import"esbuild";import"crypto";import"fs";import"path";import"os";console.log(`Welcome to tsx v${l} (Node.js ${process.version}).
Type ".help" for more information.`);const r=a.start(),{eval:p}=r,c=async function(e,t,o,s){const i=await m(e,o,{loader:"ts",tsconfigRaw:{compilerOptions:{preserveValueImports:!0}},define:{require:"global.require"}}).catch(n=>(console.log(n.message),{code:`
`}));return p.call(this,i.code,t,o,s)};r.eval=c;
