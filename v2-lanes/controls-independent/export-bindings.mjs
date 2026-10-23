import { createHash } from 'node:crypto';
import '../../tests/helpers/registerTs.mjs';
const {loadKaleidoscopeScheme:publicLoad}=await import('../../src/loadKaleidoscopeScheme.ts');
import { generate,describeConversion } from '../../tests/acceptance-bindings/generate.mjs';
import { enumerateForks,selectFork } from '../../tests/control-availability/source.mjs';
import { readFileSync,writeFileSync } from 'node:fs';
const choices=JSON.parse(readFileSync('tests/control-availability/source-choices.json'));
const expanded=[];for(const choice of choices.sources){const bytes=readFileSync(choice.path),selected=selectFork(bytes,await enumerateForks(bytes,choice.format),choice);const pub=await publicLoad(bytes,{encodeAssets:false});expanded.push({id:choice.slug,public:{manifest:pub.manifest,assets:pub.assets.map(a=>({path:a.path,width:a.width,height:a.height,rgbaSha256:createHash('sha256').update(a.rgba).digest('hex')}))},conversion:describeConversion(selected.bytes,JSON.parse(readFileSync(`themes/${choice.slug}/meta.json`)),`${choice.slug}/${choice.path.split('/').at(-1)}`)});}
writeFileSync(process.argv[2],JSON.stringify({bindings:await generate(),expanded},null,2)+'\n');
