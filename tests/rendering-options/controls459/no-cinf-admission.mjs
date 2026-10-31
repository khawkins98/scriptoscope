// Independent finite public diagnostic rule: PB9/PB10 suppress paint when the
// declared theme chain proves both exact cinf and cinf0 absent. Native pixels,
// external providers and malformed metadata remain UNKNOWN. No runtime imports.
// PF3 (#608): such a target now declares outcome 'unavailable'; see below.
export function compareNoCinfAdmission(expected,observed){
 const errors=[],check=(ok,message)=>{if(!ok)errors.push(message);},trace=observed.traces?.[0],target=expected.proposed;
 check(expected.family==='push-button','admission: wrong family');
 // #608 (push-button.md PF3) supersedes the 2026-10-23 themed-extent disposition:
 // a target declaring outcome 'unavailable' requires null plus a terminal PB9 face step.
 if(target?.outcome==='unavailable'){
  check(observed.result?.kind==='unavailable','admission: PF3 known art with proven NULL metadata returns null');
  check(trace?.outcome?.status==='unavailable','admission: PF3 public outcome is unavailable, not themed or error');
  const last=trace?.steps?.at(-1);
  check(last?.role==='face'&&last.action==='missing'&&last.basis==='source-dispatch'&&last.usage==='paint'&&last.reason==='engine:PB9:cinf:NULL','admission: PF3 terminal engine:PB9:cinf:NULL face step');
 } else {
 check(observed.result?.kind==='themed'&&observed.result.width>0&&observed.result.height>0,'admission: known art keeps positive public themed extent');
 check(trace?.outcome?.status==='themed','admission: public outcome is not art NULL or error');
 }
 const identity=target?.admission?.[0];check(target?.admission?.length===1&&identity?.type==='cicn'&&identity?.usage==='admission','admission: one exact cicn identity required');
 if(!identity)return errors;
 const selected=(trace?.steps??[]).filter(s=>s.role==='face'&&s.action==='selected'&&s.usage==='admission'&&s.reason==='resource-id');
 check(selected.length===1,'admission: one actual resource-id selection');
 if(selected.length===1){const s=selected[0];check(s.owner?.baseUrl===observed.owners?.[identity.ownerId]&&typeof s.owner?.baseUrl==='string','admission: actual owner URL');check(s.owner?.chainDepth===identity.chainDepth,'admission: owner depth');for(const k of ['type','signedId','sourceCinfId','manifestKey'])check(s.resource?.[k]===identity[k],`admission: actual ${k}`);}
 const declaration=target.metadataAbsence;check(declaration?.type==='cinf'&&declaration?.kind==='known-null-in-declared-theme-chain','admission: known-NULL declaration required');
 check(JSON.stringify(declaration?.requestedIds)===JSON.stringify([identity.signedId,0]),'admission: exact signed metadata then cinf0 declaration');
 const attempts=(trace?.steps??[]).filter(s=>s.usage!=='paint'&&s.reason?.startsWith('engine:')&&s.reason.includes(':cinf:'));
 check(JSON.stringify(attempts.map(s=>[s.requestedId,s.action]))===JSON.stringify([identity.signedId,0].map(id=>[id,'missing'])),'admission: exact metadata NULL transcript; UNKNOWN or malformed hit is not NULL');
 check(!(trace?.steps??[]).some(s=>s.action==='selected'&&s.usage==='paint'),'admission: no painted dependency');
 check(!trace?.bandPaints?.length&&!trace?.legacyFacePaint&&!trace?.bitmapTextPaint&&trace?.textColors?.labelPainted!==true,'admission: no completed face/body/label paint');
 return errors;
}
