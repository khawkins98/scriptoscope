// Modern completed body diagnostics, independently frozen before runtime repair.
// Original literals remain intact; no native/provider/device truth is claimed.
import {test,attachObservations} from './fixtures.mjs';
import {observeCompletion} from './controls459/body-completion-browser.js';
import {cases,ringCase} from './controls459/body-completion-fixtures.mjs';
import {assertCompletion} from './controls459/body-completion-assertions.mjs';
for(const mode of ['source','built'])test(`${mode}: completed body diagnostics follow valid literal paint and actual typed transport`,async({page,servers},info)=>{
 await page.route('**/body-completion-harness.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Completed body diagnostics</title>'}));
 await page.goto(`${servers[mode]}/body-completion-harness.html`);
 const rows=await page.evaluate(observeCompletion,{apiUrl:mode==='source'?'/src/index.ts':'/dist/scriptoscope.js',cases,ring:ringCase(),mode});
 await attachObservations(info,'controls459-body-completion',mode,{mode,rows,limits:'Modern diagnostic contract; independent literal pixels and raw-byte identities; no native fidelity promotion'});
 assertCompletion(rows,cases);
 assertOptionalDerivedIdentity(rows,cases);
});

import {observeOwnerPolicy} from './controls459/body-completion-owner-browser.js';
import {policyCases,lateCases,admissionCases} from './controls459/body-completion-owner-fixtures.mjs';
import {assertOwnerPolicy,assertOptionalDerivedIdentity} from './controls459/body-completion-owner-assertions.mjs';
for(const mode of ['source','built'])test(`${mode}: inherited body policy preserves face owner, true absence and explicit admission failures`,async({page,servers},info)=>{
 await page.route('**/body-owner-harness.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Body owner policy</title>'}));
 await page.goto(`${servers[mode]}/body-owner-harness.html`);
 const rows=await page.evaluate(observeOwnerPolicy,{apiUrl:mode==='source'?'/src/index.ts':'/dist/scriptoscope.js',cases:policyCases,late:lateCases,admission:admissionCases(),mode});
 await attachObservations(info,'controls459-body-owner',mode,{mode,rows,limits:'Mandatory modern same-face-owner policy, explicit malformed transport/UNKNOWN and bounded1:1 admission; not native provider equivalence'});
 assertOwnerPolicy(rows,policyCases,lateCases);
});

import {observePlainPolicy,assertPlainPolicy} from './controls459/body-completion-policy-plain.mjs';
for(const mode of ['source','built'])test(`${mode}: body owner and admission policies also hold without diagnostics or provenance`,async({page,servers},info)=>{
 await page.route('**/body-plain-harness.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Plain body policy</title>'}));
 await page.goto(`${servers[mode]}/body-plain-harness.html`);
 const rows=await page.evaluate(observePlainPolicy,{apiUrl:mode==='source'?'/src/index.ts':'/dist/scriptoscope.js',cases:policyCases,admission:admissionCases(),mode});
 await attachObservations(info,'controls459-body-plain',mode,{mode,rows,limits:'Functional facade policy with diagnostics and provenance omitted; independently frozen literal inputs/outcomes'});
 assertPlainPolicy(rows,policyCases);
});

import {metadataOwnerCase,observeMetadataOwner,assertMetadataOwner} from './controls459/body-completion-metadata-owner.mjs';
for(const mode of ['source','built'])test(`${mode}: caller metadata lookup remains separate from the face-owned body binding`,async({page,servers},info)=>{
 await page.route('**/body-metadata-harness.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Separate metadata and body owners</title>'}));
 await page.goto(`${servers[mode]}/body-metadata-harness.html`);
 const fixture=metadataOwnerCase(),rows=await page.evaluate(observeMetadataOwner,{apiUrl:mode==='source'?'/src/index.ts':'/dist/scriptoscope.js',fixture,mode});
 await attachObservations(info,'controls459-body-metadata-owner',mode,{mode,rows,limits:'Ordinary caller-chain cinf selection plus face-owned body; static cinf pairing is not a consumed occurrence claim'});
 assertMetadataOwner(rows,fixture);
});
