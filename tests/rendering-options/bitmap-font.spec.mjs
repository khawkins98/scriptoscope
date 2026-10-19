import {verifyBitmapRows,bitmapPins} from '../rendering-requirements/bitmap-cases.mjs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
for (const mode of ['source', 'built']) {
  test(`${mode}: prepared bitmap push keeps signed ink, source pen, clip and emboss without browser glyphs`, async ({ page, servers }, info) => {
    info.annotations.push({type:'fidelity-assertion',description:'bitmap.prepared-literal-paint'});
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async ({mode,caseIds}) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { bitmapFontFixture } = await import('/tests/decoder-fixtures/bitmap-font.mjs');
      const { colorIcon, colorInfo } = await import('/tests/decoder-fixtures/control-colors.mjs');
      const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
      const theme = await api.loadKaleidoscopeScheme(forkOf([
        { type:'cicn',id:-10239,data:colorIcon({entries:[[0,65535,65535,65535],[1,65535,0,0],[2,0,65535,0]],pixels:[0,1,2,0,0,0,0,0]}) },
        { type:'cinf',id:-10239,data:colorInfo({emboss:[2,0]}) },
      ]));
      const font = await api.prepareBitmapFont(bitmapFontFixture());
      const wide = bitmapFontFixture(); wide.glyphs[0].bearingX = -14;
      const overhangFont = await api.prepareBitmapFont(wide);
      const context = { controlOrigin:[-20,-2],portOrigin:[0,0],patternOrigin:{status:'unknown'},clip:{kind:'rect',rect:{x:-20,y:2,w:6,h:4}} };
      const fill = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = () => { throw new Error('Prepared path must not rasterize browser glyphs'); };
      try {
        const traces = new Map();
        const onComplete = t => traces.set(t.correlationId,t);
        const opts = {bitmapFont:overhangFont,label:'X X',height:6,minWidth:32,compositionContext:context};
        const output = await api.composeButton(theme,{...opts,diagnostics:{correlationId:'clip',onComplete}});
        const plain = await api.composeButton(theme,opts);
        await api.composeButton(theme,{...opts,compositionContext:{...context,clip:{kind:'rect',rect:{x:100,y:100,w:1,h:1}}},diagnostics:{correlationId:'empty-clip',onComplete}});
        const autoOptions={label:'X X',minWidth:0};
        const automatic = await api.composeButton(theme,{bitmapFont:font,...autoOptions,diagnostics:{correlationId:'auto',onComplete}});
        await Promise.all(['X',' '].map(label=>api.composeButton(theme,{bitmapFont:font,label,height:20,diagnostics:{correlationId:label,onComplete}})));
        const pixels=[];
        for(let y=0;y<output.height;y++)for(let x=0;x<output.width;x++)if(output.getPixel(x,y)[3])pixels.push([x,y,...output.getPixel(x,y)]);
        let unsupported;
        try { await api.composeButton(theme,{bitmapFont:font,label:'Y'}); } catch(e) { unsupported=e.message; }
        const frozen=v=>!v||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v).every(frozen);
        const inkPixels=[];for(let y=0;y<automatic.height;y++)for(let x=0;x<automatic.width;x++){const p=automatic.getPixel(x,y);if(p[3]&&p.slice(0,3).some(v=>v!==255))inkPixels.push([x,y,...p]);}
        const {bitmapFont:ignored,...clipOptions}=opts;
        const rows=[{caseId:caseIds[0],options:autoOptions,fontId:font.id,fontData:font.data,size:[automatic.width,automatic.height],trace:traces.get('auto'),pixelSelection:'nonwhite-opaque',pixels:inkPixels},
          {caseId:caseIds[1],options:clipOptions,fontId:overhangFont.id,fontData:overhangFont.data,size:[output.width,output.height],trace:traces.get('clip'),pixelSelection:'all-nontransparent',pixels}];
        return {rows,fontId:font.id,overhangId:overhangFont.id,size:[output.width,output.height],automatic:[automatic.width,automatic.height],pixels,
          parity:output.data.every((v,i)=>v===plain.data[i]),traces:Object.fromEntries(traces),unsupported,frozen:frozen(traces.get('auto'))};
      } finally {CanvasRenderingContext2D.prototype.fillText=fill;theme.dispose();}
    },{mode,caseIds:bitmapPins.cases.map(c=>c.id)});
    verifyBitmapRows(result.rows);
    expect(result.size).toEqual([32,6]);expect(result.automatic).toEqual([31,20]);expect(result.parity).toBe(true);
    // Independent clipped plane: red foreground overwrites green emboss at
    // overlapping mask points; negative bearing survives until actual face clip.
    expect(result.pixels).toEqual([
      [1,4,255,0,0,255],[2,4,255,255,255,255],[3,4,255,255,255,255],[4,4,255,0,0,255],[5,4,255,255,255,255],
      [0,5,255,0,0,255],[2,5,0,255,0,255],[5,5,255,0,0,255],
    ]);
    expect(result.traces.clip.bitmapTextPaint).toMatchObject({fontId:result.overhangId,pen:[-7,4],
      inkBounds:{x:-21,y:2,w:8,h:3},foreground:{pixels:4},emboss:{pixels:3}});
    expect(result.traces['empty-clip'].bitmapTextPaint).toBeUndefined();
    expect(result.traces.auto.bitmapTextPaint).toMatchObject({fontId:result.fontId,providerBasis:'caller-declared',pen:[12,14],advance:7,lineHeight:16,
      inkBounds:{x:11,y:12,w:8,h:3},foreground:{pixels:10},emboss:{pixels:10}});
    expect(result.traces.X.bitmapTextPaint.label).toBe('X');expect(result.traces[' '].bitmapTextPaint).toBeUndefined();
    expect(result.frozen).toBe(true);expect(result.unsupported).toContain('No bitmap glyph');
    await attachObservations(info,'bitmap-font',`${mode}-paint`,{mode,result,limit:'Synthetic glyphs and source-layout formula; no original font-provider authentication'});
  });
  test(`${mode}: bitmap run snapshots before decode and suppresses completed paint on late abort or failure`, async ({page,servers},info)=>{
    await openHarness(page,servers,mode);
    const result=await page.evaluate(async mode=>{
      const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
      const {bitmapFontFixture}=await import('/tests/decoder-fixtures/bitmap-font.mjs');
      const font=await api.prepareBitmapFont(bitmapFontFixture());
      const source=api.PixelBuffer.alloc(7,7);source.fillRect({x:0,y:0,w:7,h:7},255,255,255,255);
      const encoded=api.bufferToCanvas(source).toDataURL();const decode=HTMLImageElement.prototype.decode;const rows=[];
      try {
        for(const action of ['mutate','abort','fail']){
          const theme={baseUrl:'/',manifest:{chromeElements:{face:{asset:`${encoded}#${action}-face`,sourceCicnId:-10239},ring:{asset:`${encoded}#${action}-ring`,sourceCicnId:-10231}}}};
          let release,reached;const gate=new Promise(r=>release=r),held=new Promise(r=>reached=r);const controller=new AbortController();
          const target=theme.manifest.chromeElements[action==='mutate'?'face':'ring'].asset;
          HTMLImageElement.prototype.decode=async function(){if(this.src===target){reached();await gate;if(action==='fail')throw new Error('held ring failed');}return decode.call(this);};
          let trace,error;const opts={bitmapFont:font,label:'X',default:true,height:20,minWidth:40,diagnostics:{onComplete:t=>trace=t}};
          const pending=api.composeButton(theme,opts,controller.signal).catch(e=>{error=e.name;});
          await held;
          if(action==='mutate'){opts.label='Y';opts.bitmapFont={};opts.fontSize=99;}
          if(action==='abort')controller.abort();release();await pending;
          rows.push({action,trace,error});HTMLImageElement.prototype.decode=decode;
        }
        return {rows,fontId:font.id};
      } finally {HTMLImageElement.prototype.decode=decode;}
    },mode);
    expect(result.rows[0].trace.bitmapTextPaint).toMatchObject({fontId:result.fontId,label:'X',strikeSize:12});
    for(const row of result.rows.slice(1)){expect(row.trace.outcome.status).toBe('error');expect(row.trace.bitmapTextPaint).toBeUndefined();expect(row.error).toBe(row.action==='abort'?'AbortError':'Error');}
    await attachObservations(info,'bitmap-font',`${mode}-lifetime`,{mode,result});
  });
}
