// Preserve historical availability receipts against their exact full source text.
// The modern policy addition is separately pinned, never substituted into a native receipt.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
export function frozenPushSource(text=readFileSync(new URL('../../../docs/spec/engine/push-button.md',import.meta.url),'utf8')){
 const heading='## Modern raw-cinf compatibility policy\n',start=text.indexOf(heading),end=text.indexOf('## 7. Test hooks',start);
 assert.ok(start>=0&&end>start,'required additive modern policy section');
 assert.equal(text.indexOf(heading,start+heading.length),-1,'exactly one additive modern section');
 const modern=text.slice(start,end);
 assert.equal(sha(modern),'28a6a82dc87543a4a6089e867cef24b6cec302f1aef0758cfd7d06891812dd0f','modern policy section byte identity');
 const original=text.slice(0,start)+text.slice(end);
 assert.equal(sha(original),'7cc4a7e27b4f4c773e81329d15c4bb6c7029054a88e7391571680da881cf72a0','entire original source document remains byte exact');
 return original;
}
