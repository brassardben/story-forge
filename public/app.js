const $ = id => document.getElementById(id);
let dictating = false, activeDictationTarget = null;
let busy = false, configured = false, audioUrl = '', audioSource = '', previous = null;
const text = () => $('draft').value.trim();
const notice = (message, error=false) => { $('notice').textContent=message; $('notice').classList.toggle('error',error); };
const filename = () => ($('title').value.trim() || 'My story').replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,80) || 'My story';
function update() {
  const words = text().match(/\S+/g)?.length || 0;
  $('word-count').textContent = `${words.toLocaleString()} words`;
  for (const id of ['generate','continue','revise','narrate']) $(id).disabled = busy || dictating || !configured || (id !== 'generate' && !text()) || (id==='revise'&&!$('revision').value.trim());
  $('download-text').disabled = !text(); $('undo').disabled = busy || dictating || !previous;
  document.querySelectorAll('[data-dictate]').forEach(b=>b.disabled=busy || (dictating && b.dataset.dictate !== activeDictationTarget));
  for (const id of ['idea','genre','tone','length','revision','draft','title','voice','style']) $(id).disabled=busy || (dictating && ['draft','idea'].includes(id));
  document.querySelectorAll('[data-idea]').forEach(b=>b.disabled=busy || dictating);
  if (audioUrl) $('audio-note').textContent = audioSource === `${$('title').value}\n${text()}` ? 'Audio matches this draft.' : 'This audio is from an earlier draft. Generate again to hear your changes.';
}
async function request(endpoint, data) {
  let response;
  try { response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); }
  catch { throw new Error('Story Studio’s local server is not running. Return to this chat and ask to open Story Studio. Your text is still here.'); }
  if (!response.ok) { const result=await response.json().catch(()=>({})); throw new Error(result.error || 'The request could not finish. Please try again.'); }
  return response;
}
async function write(action) {
  if (busy) return;
  if (action==='generate' && !$('idea').value.trim()) { notice('Add an idea to start your story.',true); $('idea').focus(); return; }
  if (action==='generate' && text() && !confirm('Replace the current draft with a new story? You can undo this AI edit.')) return;
  busy=true; update();
  const button = $(action==='generate'?'generate':action==='continue'?'continue':'revise'); const old=button.textContent;
  button.textContent=action==='generate'?'Writing your story…':action==='continue'?'Writing the next part…':'Revising…';
  notice(action==='generate'?'Finding the first words. This may take a minute…':action==='continue'?'Following your story into its next chapter…':'Shaping your draft. Your original is kept for undo…');
  try {
    const response = await request('/api/story',{action,idea:$('idea').value,genre:$('genre').value,tone:$('tone').value,words:Number($('length').value),draft:text(),revision:$('revision').value});
    const result=await response.json(); previous={title:$('title').value,draft:$('draft').value};
    if(action==='continue') $('draft').value=text()+'\n\n'+result.text;
    else if(action==='generate') { const lines=result.text.split('\n'); $('title').value=lines.shift().replace(/^#+\s*|\*\*/g,'').slice(0,200); $('draft').value=lines.join('\n').trim(); }
    else $('draft').value=result.text;
    $('draft-status').textContent='Ready for your finishing touches.'; notice('Your draft is ready. Edit anything, or bring it to life with a narrator.');
  } catch(error) { notice(error.message,true); }
  finally { busy=false;button.textContent=old;update(); }
}
async function narrate() {
  if(busy || !text()) return;
  busy=true;update();const old=$('narrate').textContent;$('narrate').textContent='Recording your story…';
  notice('Your narrator is recording. Longer stories can take a few minutes.');
  try {
    const response=await request('/api/audio',{text:[$('title').value.trim(),text()].filter(Boolean).join('\n\n'),voice:$('voice').value,style:$('style').value});
    const blob=await response.blob(); if(!blob.size) throw new Error('No audio was returned. Please try again.');
    $('audio').pause(); if(audioUrl) URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(blob);audioSource=`${$('title').value}\n${text()}`;
    $('audio').src=audioUrl;$('audio').playbackRate=Number($('speed').value);$('download-audio').href=audioUrl;$('download-audio').download=filename()+'.mp3';
    $('audio-empty').hidden=true;$('audio-result').hidden=false;notice('Your audiobook is ready. Press play to listen, or download the MP3.');
  } catch(error) { notice(error.message,true); }
  finally {busy=false;$('narrate').textContent=old;update();}
}
$('generate').onclick=()=>write('generate');$('continue').onclick=()=>write('continue');$('revise').onclick=()=>write('revise');$('narrate').onclick=narrate;
for(const id of ['draft','title','revision']) $(id).addEventListener('input',update);
$('undo').onclick=()=>{if(!previous||busy)return; const current={title:$('title').value,draft:$('draft').value};$('title').value=previous.title;$('draft').value=previous.draft;previous=current;notice('Previous draft restored.');update();};
$('speed').onchange=()=>{$('audio').playbackRate=Number($('speed').value);};
document.querySelectorAll('[data-idea]').forEach(b=>b.onclick=()=>{$('idea').value=b.dataset.idea;$('idea').focus();});
$('download-text').onclick=()=>{const blob=new Blob([$('title').value+'\n\n'+text()],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename()+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('beforeunload',event=>{if(text()){event.preventDefault();event.returnValue='';}});
fetch('/api/status').then(r=>r.json()).then(result=>{configured=result.configured;if(!configured)notice('Finish OpenAI API key setup to enable story writing and narration.',true);update();}).catch(()=>notice('The app could not reach its server. Refresh to reconnect.',true));
update();
if(document.modelContext?.registerTool) {
  Promise.resolve(document.modelContext.registerTool({name:'read_story_draft',description:'Read the current story title and manuscript.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({title:$('title').value,text:text()})})).catch(()=>{});
}

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
const dictationButtons = [...document.querySelectorAll('[data-dictate]')];
const defaultLabels = new Map(dictationButtons.map(button=>[button,button.textContent]));
function endDictation(message='Voice typing stopped. You can edit your words.') {
  dictating=false; activeDictationTarget=null;
  dictationButtons.forEach(button=>{button.textContent=defaultLabels.get(button);button.setAttribute('aria-pressed','false');});
  $('dictation-status').textContent=message;update();
}
function deviceFallback(target) {
  $(target).focus();
  $('dictation-status').textContent='Use your device’s dictation in the selected text box.';
  notice('Voice typing is not available in this browser. On a phone, tap the microphone on your keyboard. On Mac or Windows, use your system dictation shortcut in this text box.');
}
for(const button of dictationButtons) button.addEventListener('click',()=>{
  const target=button.dataset.dictate;
  if(busy)return;
  if(dictating){recognition?.stop();return;}
  if(!Recognition){deviceFallback(target);return;}
  const field=$(target);
  const start=field.selectionStart ?? field.value.length;
  const end=field.selectionEnd ?? start;
  const before=field.value.slice(0,start),after=field.value.slice(end);
  let finalText='',failure='',truncated=false;
  recognition=new Recognition();recognition.lang=navigator.language || 'en-US';recognition.continuous=true;recognition.interimResults=true;
  recognition.onstart=()=>{$('dictation-status').textContent='Listening… Speak naturally, then click Stop dictation.';};
  recognition.onresult=event=>{
    let interim='';
    for(let i=event.resultIndex;i<event.results.length;i++){
      const result=event.results[i];
      if(result.isFinal)finalText+=result[0].transcript+' ';else interim+=result[0].transcript;
    }
    const spoken=finalText.trim();
    if(spoken){
      const insertion=(before && !/\s$/.test(before)?' ':'')+spoken+(after && !/^\s/.test(after)?' ':'');
      const available=Math.max(0,field.maxLength-before.length-after.length);
      field.value=before+insertion.slice(0,available)+after;
      if(insertion.length>available){truncated=true;recognition.stop();}
      update();
    }
    $('dictation-status').textContent=interim ? 'Hearing: '+interim : 'Listening… Click Stop dictation when you’re finished.';
  };
  recognition.onerror=event=>{
    failure=({ 'not-allowed':'Microphone access was denied. Allow it in browser settings, or use device dictation.', 'service-not-allowed':'This browser cannot use its speech service. Use device keyboard dictation instead.', 'audio-capture':'No microphone is available. Check your device’s microphone.', 'network':'The browser speech service could not connect. Try again or use device dictation.', 'no-speech':'No speech was heard. Try again when you’re ready.' })[event.error] || 'Voice typing stopped. Try again or use device dictation.';
    notice(failure,true);
  };
  recognition.onend=()=>{endDictation(truncated?'The text box is full. Your words have been kept.':failure||undefined);field.focus();};
  try{
    $('audio').pause();dictating=true;activeDictationTarget=target;button.textContent='■ Stop dictation';button.setAttribute('aria-pressed','true');update();
    $('dictation-status').textContent='Waiting for microphone permission…';recognition.start();
  }catch{endDictation('Voice typing could not start.');deviceFallback(target);}
});
if(!Recognition){
  $('dictation-help').textContent='This browser does not support voice typing. Click a Dictate button to focus the text box, then use your phone keyboard’s microphone or your computer’s dictation shortcut.';
}
window.addEventListener('pagehide',()=>recognition?.abort());
