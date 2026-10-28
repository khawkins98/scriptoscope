import {test,expect,openHarness,attachCase} from './fixtures.mjs';

// Hand-derived union of c1/s2 insets in a 24x6 face. All four RGBA bytes
// outside the union stay zero; alternating pattern columns keep phase visible.
const coverage=['........................','..XXXXXXXXXXXXXXXXXXXX..','.XXXXXXXXXXXXXXXXXXXXXX.','.XXXXXXXXXXXXXXXXXXXXXX.','..XXXXXXXXXXXXXXXXXXXX..','........................'];
const colors=[[17,101,203,255],[71,19,137,255]];
const expected=coverage.flatMap(row=>[...row].flatMap((pixel,x)=>pixel==='X'?colors[x%2]:[0,0,0,0]));

for(const mode of ['source','built'])test(`${mode}: cached push pattern arrays preserve caller prototype observations and callback identity`,async({page,servers},info)=>{
 await openHarness(page,servers,mode);let rows;
 try{
  rows=await page.evaluate(async mode=>{
   const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
   const {loadOwnedControlFixture,plane}=await import('/tests/rendering-options/owned-control-fixture.mjs');
   const rows=[];
   for(const variant of ['prototype-count','prototype-mutate','prototype-throw','prototype-throw-and-callback','method-count','method-throw']){
    const owner=await loadOwnedControlFixture(api,{faces:[{id:-10239,name:'face',pixels:plane(7,7),cinf:{corner:1,side:2,resourceId:17}}],patterns:[{id:17,name:'pattern',pixels:[[[17,101,203,255],[71,19,137,255]]]}]});
    owner.baseUrl='owned-public-observation';
    const source=await api.loadCicnBuffer(owner.manifest.patterns.pattern.asset),data=source.data,original=Object.getPrototypeOf(data);
    const callbackError=new Error('caller completion sentinel'),observationError=new Error('caller array sentinel');
    let observations=0,callbacks=0,trace,out,caught;
    const events=[];
    if(variant.startsWith('prototype')){
     const bridge=Object.create(original);
     Object.setPrototypeOf(data,new Proxy(bridge,{getPrototypeOf(target){
      observations++;
      if(variant==='prototype-mutate')data[0]=123;
      if(variant.startsWith('prototype-throw'))throw observationError;
      return Reflect.getPrototypeOf(target);
     }}));
    }else Object.defineProperty(data,'subarray',{configurable:true,value:function(...args){
     observations++;
     if(variant==='method-throw')throw observationError;
     return Uint8ClampedArray.prototype.subarray.apply(this,args);
    }});
    try{
     events.push('start');
     out=await api.composeButton(owner,{label:'',minWidth:24,height:6,
      compositionContext:{controlOrigin:[0,0],portOrigin:[0,0],patternOrigin:{status:'known',offset:[0,0]},clip:{kind:'unbounded'}},
      diagnostics:{onComplete:t=>{callbacks++;trace=t;events.push('callback');if(variant.endsWith('and-callback'))throw callbackError;}},
     });
     events.push('resolved');
    }catch(error){caught=error;events.push('rejected');}
    finally{Object.setPrototypeOf(data,original);delete data.subarray;owner.dispose();}
    rows.push({variant,observations,callbacks,events,genuine:ArrayBuffer.isView(data),callbackIdentity:caught===callbackError,observationIdentity:caught===observationError,
     error:caught?{name:caught.name,message:caught.message}:null,output:out?{width:out.width,height:out.height,rgba:[...out.data]}:null,
     trace,frozen:Object.isFrozen(trace)&&Object.isFrozen(trace.steps)&&Object.isFrozen(trace.outcome),loadId:owner.byteProvenance.loadId});
   }
   return rows;
  },mode);
  expect(rows).toHaveLength(6);
  for(const row of rows){
   expect(row.genuine,row.variant).toBe(true);
   expect(row.observations,`${row.variant}: public drawing must preserve unobserved caller hooks`).toBe(0);
   expect(row.callbacks,row.variant).toBe(1);
   expect(row.frozen,row.variant).toBe(true);
   expect(row.trace.outcome,row.variant).toEqual({status:'themed',width:24,height:6});
   const body=row.trace.steps.filter(step=>step.bodyPaint);
   expect(body,row.variant).toHaveLength(1);
   expect(body[0]).toMatchObject({owner:{baseUrl:'owned-public-observation',chainDepth:0},resource:{type:'ppat',signedId:17,manifestKey:'pattern',byteProvenance:{loadId:row.loadId}},bodyPaint:{branch:'pattern-fill-union',paintedPixels:84,sourceSize:[2,1]}});
   expect(row.observationIdentity,row.variant).toBe(false);
   if(row.variant.endsWith('and-callback')){
    expect(row.callbackIdentity).toBe(true);
    expect(row.error).toEqual({name:'Error',message:'caller completion sentinel'});
    expect(row.output).toBeNull();
    expect(row.events).toEqual(['start','callback','rejected']);
   }else{
    expect(row.error,row.variant).toBeNull();
    expect(row.output,row.variant).toEqual({width:24,height:6,rgba:expected});
    expect(row.events,row.variant).toEqual(['start','callback','resolved']);
   }
  }
 }catch(error){await attachCase(page,info,{mode,rows,expected},error);throw error;}
});
