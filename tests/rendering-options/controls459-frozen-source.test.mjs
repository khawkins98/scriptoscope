import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {frozenPushSource} from './controls459/frozen-push-source.mjs';
const text=readFileSync(new URL('../../docs/spec/engine/push-button.md',import.meta.url),'utf8');
test('frozen source reconstruction retains full prior document and separately sealed modern addition',()=>{const old=frozenPushSource(text);assert.ok(old.includes('| PB8 |'));assert.ok(!old.includes('## Modern raw-cinf compatibility policy'));});
test('native source-row mutation cannot hide behind additive-section projection',()=>{assert.ok(text.includes('| PB8 |'));assert.throws(()=>frozenPushSource(text.replace('| PB8 |','| PB0 |')),e=>e.code==='ERR_ASSERTION'&&/entire original source document/.test(e.message));});
test('modern policy change and duplicate section cannot hide behind source reconstruction',()=>{assert.throws(()=>frozenPushSource(text.replace('first raw occurrence','last raw occurrence')),e=>e.code==='ERR_ASSERTION'&&/modern policy section byte identity/.test(e.message));assert.throws(()=>frozenPushSource(text+'\n## Modern raw-cinf compatibility policy\n'),e=>e.code==='ERR_ASSERTION'&&/exactly one/.test(e.message));});
