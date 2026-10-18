(function(){
  'use strict';
  // One recorder per composer. Microphone ownership ends on stop, navigation or logout.
  window.atlasCreateVoiceRecorder=function(host,onChange){
    let recorder,stream,chunks=[],blob=null,objectURL='',started=0,seconds=0,timer,epoch=0,pending=false;
    const notify=()=>onChange?.({recording:!!recorder&&recorder.state==='recording',pending,blob,seconds});
    function release(){clearInterval(timer);stream?.getTracks().forEach(t=>t.stop());stream=null}
    function draw(){
      host.replaceChildren();host.hidden=!blob;
      if(blob){const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=objectURL;audio.setAttribute('aria-label','Прослушать запись перед отправкой');host.appendChild(audio);
        const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Удалить запись');remove.addEventListener('click',clear);host.appendChild(remove)}
      notify();
    }
    function clear(){++epoch;pending=false;if(recorder){recorder.onstop=null;recorder.ondataavailable=null;if(recorder.state!=='inactive')recorder.stop();recorder=null}release();blob=null;seconds=0;if(objectURL)URL.revokeObjectURL(objectURL);objectURL='';draw()}
    async function start(){
      if(pending||recorder)return;
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Этот браузер не поддерживает запись. Открой сайт в Safari или Chrome по HTTPS.');
      clear();pending=true;notify();const own=epoch;
      try{
        const acquired=await navigator.mediaDevices.getUserMedia({audio:true});
        if(own!==epoch){acquired.getTracks().forEach(t=>t.stop());return}
        stream=acquired;const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
        if(!mime)throw Error('Браузер не поддерживает подходящий формат записи.');
        recorder=new MediaRecorder(stream,{mimeType:mime});chunks=[];started=performance.now();seconds=0;
        recorder.ondataavailable=e=>{if(e.data.size&&own===epoch)chunks.push(e.data)};
        recorder.onerror=()=>{clear();onChange?.({error:'Не удалось записать звук. Попробуй ещё раз.'})};
        recorder.onstop=()=>{if(own!==epoch)return;const type=recorder.mimeType.split(';')[0];seconds=Math.max(1,Math.round((performance.now()-started)/1000));blob=new Blob(chunks,{type});recorder=null;release();if(blob.size)objectURL=URL.createObjectURL(blob);else blob=null;draw()};
        recorder.start(1000);pending=false;timer=setInterval(()=>{seconds=Math.floor((performance.now()-started)/1000);notify()},1000);notify();
      }catch(err){if(own===epoch){clear();throw Error(err.name==='NotAllowedError'?'Разреши доступ к микрофону в настройках браузера.':err.message)}}
    }
    function stop(){if(recorder?.state==='recording'){recorder.stop();release()}}
    return {start,stop,clear,get value(){return blob?{blob,seconds}:null},get recording(){return !!recorder&&recorder.state!=='inactive'},get pending(){return pending}};
  };
})();
