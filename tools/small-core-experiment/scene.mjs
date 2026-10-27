export async function scene(api, rounds = 1) {
  const source = document.createElement('canvas'); source.width=32; source.height=20;
  const cx=source.getContext('2d'); cx.fillStyle='#336699'; cx.fillRect(0,0,32,20); cx.fillStyle='#aaccff'; cx.fillRect(3,3,26,14);
  const asset=source.toDataURL();
  const theme={baseUrl:'',manifest:{name:'Caller-authored probe',windowTypes:{},chromeElements:{push:{asset,width:32,height:20,sourceCicnId:-10239,sourceCinfId:-10239,slice:{cornerSize:3,sideThickness:3,tileSides:0}}},patterns:{}}};
  const output=document.createElement('main'); document.body.replaceChildren(output);
  const times=[];
  for(let frame=0;frame<rounds;frame++) {
    const start=performance.now(); const nodes=[];
    for(let w=0;w<4;w++) {
      const win=await api.renderWindow(theme,{title:`Authored ${w}`,width:240,height:120,state:w%2?'inactive':'active'}); nodes.push(win);
      for(let b=0;b<4;b++) { const pixels=await api.composeButton(theme,{label:`Button ${b}`,minWidth:80,height:20}); if(pixels) win.append(api.bufferToCanvas(pixels)); }
      for(const pixels of [api.platinumCheckable('checkbox',{checked:true}),api.platinumSlider({value:frame%100}),api.platinumScrollbar({length:120}),api.platinumDisclosure({}),api.platinumBevelButton({label:'Bevel'}),api.platinumMenuBar({}),api.platinumMenu({}),api.platinumPopupMenu({}),api.platinumListHeader({})]) win.append(api.bufferToCanvas(pixels));
    }
    output.replaceChildren(...nodes); output.getBoundingClientRect(); times.push(performance.now()-start);
  }
  const canvases=[...output.querySelectorAll('canvas')]; const data=canvases.flatMap(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data));
  const digest=await crypto.subtle.digest('SHA-256',new Uint8Array(data));
  return {times,canvases:canvases.length,pixelBytes:data.length,hash:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')};
}
