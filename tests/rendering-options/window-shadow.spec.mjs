import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

for (const mode of ['source', 'built']) test(`${mode}: shell shadows are opt-in for classic and custom window artwork`, async ({page, servers}, info) => {
  await openHarness(page, servers, mode);
  const observations=[];
  for (const slug of ['windows-95','slimes']) {
    const row=await page.evaluate(async slug=>{
      const result=await window.controlMatrix.runWindowLayout({slug,layout:'grid',scale:1});
      if(result.status!=='rendered')throw Error(result.error);
      const hosts=[...document.querySelector(result.outputSelector).querySelectorAll('[data-scriptoscope-window-host]')];
      const snapshot=()=>hosts.map(host=>{
        const part=host.shadowRoot.querySelector('[part~=window]'),canvas=host.shadowRoot.querySelector('canvas.scriptoscope-chrome');
        const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        return {hostShadow:getComputedStyle(host).boxShadow,partShadow:getComputedStyle(part).boxShadow,partFilter:getComputedStyle(part).filter,
          canvas:canvas.toDataURL(),transparentPixels:Array.from(pixels).filter((v,i)=>i%4===3&&v===0).length};
      });
      const before=snapshot();
      for(const host of hosts)host.style.setProperty('--scriptoscope-window-shadow','4px 5px 0 rgb(1, 2, 3)');
      const optedIn=snapshot();
      for(const host of hosts)host.style.removeProperty('--scriptoscope-window-shadow');
      const restored=snapshot();
      return {slug,before,optedIn,restored};
    },slug);
    expect(row.before).toHaveLength(2);
    for(let i=0;i<2;i++) {
      expect(row.before[i].hostShadow).toBe('none');
      expect(row.before[i].partShadow).toBe('none');
      expect(row.before[i].partFilter).toBe('none');
      if(slug==='slimes')expect(row.before[i].transparentPixels, 'custom chrome exercises transparent artwork bounds').toBeGreaterThan(0);
      expect(row.optedIn[i].hostShadow).toBe('none');
      expect(row.optedIn[i].partShadow).toBe('rgb(1, 2, 3) 4px 5px 0px 0px');
      expect(row.optedIn[i].canvas).toBe(row.before[i].canvas);
      expect(row.restored[i]).toEqual(row.before[i]);
    }
    // Record occupancy and CSS policy, not the full unchanged image payload.
    observations.push({...row,before:row.before.map(({canvas,...v})=>v),optedIn:row.optedIn.map(({canvas,...v})=>v),restored:row.restored.map(({canvas,...v})=>v)});
  }
  await attachObservations(info,'window-shadow',mode,{mode,observations,claim:'Modern optional shell-decoration policy only; no original-engine shadow claim.'});
});
