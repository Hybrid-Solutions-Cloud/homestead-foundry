import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('gateway enforces auth and preserves model routing, retry limits, streams and regional paths', async (t) => {
  const requests = [];
  const backend = http.createServer(async (req, res) => {
    const parts=[]; for await (const b of req) parts.push(b);
    const text=Buffer.concat(parts).toString();
    const body=text && req.headers['content-type']?.includes('json') ? JSON.parse(text) : undefined;
    requests.push({ path:req.url, body, text, key:req.headers['api-key'] });
    res.setHeader('Content-Type', 'application/json');
    if (body?.temperature !== undefined) {
      res.writeHead(400); res.end(JSON.stringify({error:{param:'temperature',code:'unsupported_parameter'}})); return;
    }
    if (body?.stream) {
      res.setHeader('Content-Type','text/event-stream');
      res.end('data: {"model":"chosen","choices":[{"delta":{"content":"ok"}}]}\n\ndata: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":1}}\n\ndata: [DONE]\n\n'); return;
    }
    res.end(JSON.stringify({model:'chosen',choices:[{message:{content:'ok'},finish_reason:'stop'}]}));
  });
  t.after(() => { backend.closeAllConnections(); backend.close(); });
  backend.listen(0,'127.0.0.1'); await once(backend,'listening');
  const reservation=http.createServer(); reservation.listen(0,'127.0.0.1'); await once(reservation,'listening');
  const port=reservation.address().port; await new Promise(r=>reservation.close(r));
  const dir=await mkdtemp(join(tmpdir(),'gateway-test-'));
  const routing=join(dir,'routing.json');
  const endpoint=`http://127.0.0.1:${backend.address().port}/openai`;
  await writeFile(routing,JSON.stringify({generation:'test',defaultBackend:'old',backends:{old:{endpoint,keyEnv:'TEST_OLD'},new:{endpoint,keyEnv:'TEST_NEW'}},prefixes:{'/new/eus2':'new','/eus2':'old'},models:{'model-router':{backend:'new'}}}));
  const proc=spawn(process.execPath,[new URL('./foundry-proxy.mjs',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],{env:{...process.env,FOUNDRY_PROXY_HOST:'127.0.0.1',PORT:String(port),FOUNDRY_GATEWAY_TOKEN:'test-token',FOUNDRY_ROUTING_PATH:routing,TEST_OLD:'old-test-key',TEST_NEW:'new-test-key',APPLICATIONINSIGHTS_CONNECTION_STRING:''},stdio:['ignore','pipe','pipe']});
  let logs=''; proc.stdout.on('data',b=>{logs+=b;}); proc.stderr.on('data',b=>{logs+=b;});
  const base=`http://127.0.0.1:${port}`;
  try {
    for(let i=0;i<60;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
    assert.equal((await fetch(base+'/v1/models')).status,401);
    assert.equal(requests.length,0);
    const headers={Authorization:'Bearer test-token','Content-Type':'application/json'};
    const response=await fetch(base+'/v1/chat/completions',{method:'POST',headers,body:JSON.stringify({model:'model-router',messages:[{role:'user',content:'private-test-text'}],temperature:0.1,max_completion_tokens:32,stream:true})});
    assert.equal(response.status,200); assert.equal(response.headers.get('x-foundry-backend'),'new');
    assert.match(await response.text(),/\[DONE\]/);
    assert.equal(requests.length,2); assert.equal(requests[1].key,'new-test-key');
    assert.equal(requests[1].body.temperature,undefined); assert.equal(requests[1].body.max_completion_tokens,32);
    const poll=await fetch(base+'/new/eus2/v1/videos/test-job',{headers});
    assert.equal(poll.status,200); await poll.text();
    assert.equal(requests.at(-1).path,'/openai/v1/videos/test-job'); assert.equal(requests.at(-1).key,'new-test-key');
    const form=new FormData(); form.set('model','whisper'); form.set('file',new Blob(['test-audio']),'test.wav');
    const upload=await fetch(base+'/eus2/deployments/whisper/audio/transcriptions?api-version=test',{method:'POST',headers:{Authorization:'Bearer test-token'},body:form});
    assert.equal(upload.status,200); await upload.text();
    assert.equal(requests.at(-1).key,'old-test-key'); assert.match(requests.at(-1).text,/test-audio/);
    assert.equal(logs.includes('private-test-text'),false); assert.equal(logs.includes('new-test-key'),false);
  } finally {
    proc.kill(); await once(proc,'exit');
    backend.closeAllConnections(); await new Promise(r=>backend.close(r));
    await rm(dir,{recursive:true,force:true});
  }
});
