import './registerTs.mjs';
import { registerHooks } from 'node:module';
import { sliderRuntimeMutations, mutateSliderRuntime } from './slider-runtime-mutations.mjs';
const mutation=sliderRuntimeMutations.find(m=>m.id===process.env.SCRIPTOSCOPE_SLIDER_MUTATION);
if(mutation)registerHooks({load(url,context,next){
  const result=next(url,context);
  if(!url.endsWith('/'+mutation.path))return result;
  // registerTs has already stripped the single non-null assertion in this probe.
  const actual={...mutation,before:mutation.before.replace('selected.bytes[0]!','selected.bytes[0]')};
  return {...result,source:mutateSliderRuntime(String(result.source),actual)};
}});
