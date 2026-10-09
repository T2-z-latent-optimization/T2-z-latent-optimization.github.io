const $=s=>document.querySelector(s);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const hero=$('#hero-video');
if(reduced)hero.pause();
new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&!reduced)hero.play().catch(()=>{});else hero.pause();}),{threshold:.1}).observe(hero);

fetch('data.json').then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json();}).then(data=>{
 let taskIndex=7,env=0;
 const film=$('.project-film');
 film.poster=`assets/project-poster.jpg?v=${data.filmRevision}`;
 film.querySelector('source').src=`assets/project-video.mp4?v=${data.filmRevision}&stream=1`;film.load();
 const keys=['gt','standard','lora','dino','ttt','ours'];
 const labels={gt:'Ground truth',standard:'Standard World Model',lora:'LoRA TTA',dino:'DINOv2 Context',ttt:'TTT-KQV',ours:'T2-z (Ours)'};
 const tabs=$('#task-tabs');
 const strip=document.createElement('div');strip.className='task-strip';const track=document.createElement('div');track.className='task-track';strip.append(track);tabs.append(strip);
 const taskCount=data.tasks.length;let dialReady=false;
 function centerTask(smooth=true){
  const a=strip.getBoundingClientRect(),mid=a.left+a.width/2;
  const candidates=[...track.children].filter(b=>Number(b.dataset.task)===taskIndex);
  const button=dialReady?candidates.reduce((best,b)=>Math.abs(b.getBoundingClientRect().left+b.offsetWidth/2-mid)<Math.abs(best.getBoundingClientRect().left+best.offsetWidth/2-mid)?b:best):candidates[2];
  const b=button.getBoundingClientRect();
  strip.scrollTo({left:strip.scrollLeft+b.left+b.width/2-mid,behavior:dialReady&&smooth&&!reduced?'smooth':'instant'});dialReady=true;
 }
 // Repeated copies keep adjacent tasks present across both ends of the cycle.
 for(let copy=0;copy<5;copy++)data.tasks.forEach((task,i)=>{
  const b=document.createElement('button');b.type='button';b.textContent=task.title;b.dataset.task=String(i);b.dataset.copy=String(copy);b.setAttribute('aria-pressed',String(i===taskIndex));
  if(copy!==2){b.setAttribute('aria-hidden','true');b.tabIndex=-1;}
  b.onclick=()=>{if(taskIndex===i&&(pending||activeTask===i&&activeEnv===env))return;taskIndex=i;env=0;render();};
  b.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();taskIndex=(i+(e.key==='ArrowRight'?1:-1)+taskCount)%taskCount;env=0;render();track.children[2*taskCount+taskIndex].focus({preventScroll:true});}};
  track.append(b);
 });
 strip.addEventListener('scroll',()=>{
  const cycle=track.children[taskCount].offsetLeft-track.children[0].offsetLeft;
  if(!dialReady||!cycle)return;
  if(strip.scrollLeft<cycle)strip.scrollTo({left:strip.scrollLeft+cycle,behavior:'instant'});
  else if(strip.scrollLeft>3*cycle)strip.scrollTo({left:strip.scrollLeft-cycle,behavior:'instant'});
 },{passive:true});
 new ResizeObserver(()=>centerTask(false)).observe(strip);
 let groups=[],pending=null,activeTask=-1,activeEnv=-1;
 const loadQueue=[];let loadingGroups=0;
 const box=$('#comparison');
 function dispose(list){
  list.forEach(g=>{g.disposed=true;g.loader?.abort();g.videos.forEach(v=>{v.pause();v.removeAttribute('src');v.load();});});
 }
 function loadGroup(group){
  if(group.loaded)return;
  group.loaded=true;
  if(group.active)loadQueue.push(group);else loadQueue.unshift(group);
  drainLoadQueue();
 }
 function drainLoadQueue(){
  while(loadingGroups<2&&loadQueue.length){
   const group=loadQueue.shift();if(group.disposed)continue;
   loadingGroups++;group.loader=new AbortController();
   group.videos.forEach(v=>{v.preload='auto';v.src=v.dataset.src;v.load();});
   Promise.all(group.videos.map(v=>waitForStart(v,group.loader.signal)))
    .then(()=>playGroup(group)).catch(error=>{if(error.name!=='AbortError')console.warn(error.message);})
    .finally(()=>{loadingGroups--;drainLoadQueue();});
  }
 }
 function playGroup(group){
  if(group.disposed)return;
  const visible=group.active&&group.cells.some(cell=>cell.dataset.visible==='true');
  if(visible)loadGroup(group);
  const ready=group.videos.every(v=>v.readyState>=3&&!v.seeking);
  if(!visible||reduced||!ready){group.videos.forEach(v=>v.pause());return;}
  // No playback is permitted during preparation. Each new action starts at zero.
  if(!group.started){
   group.started=true;
   group.videos.forEach(v=>{v.currentTime=0;});
   requestAnimationFrame(()=>playGroup(group));
   return;
  }
  group.videos.forEach(v=>{if(v.paused)v.play().catch(()=>{});});
 }
 const cellsObserver=new IntersectionObserver(entries=>{
  entries.forEach(e=>e.target.dataset.visible=String(e.isIntersecting));
  groups.forEach(playGroup);
 },{threshold:0.08});
 function waitForStart(video,signal){
  return new Promise((resolve,reject)=>{
   const events=['canplay','seeked','loadeddata'];
   const cleanup=()=>{events.forEach(e=>video.removeEventListener(e,check));video.removeEventListener('error',fail);signal.removeEventListener('abort',abort);clearTimeout(timer);};
   const check=()=>{
    if(video.readyState>=3&&!video.seeking){
     if(video.currentTime!==0){video.currentTime=0;return;}
     video.removeAttribute('poster');cleanup();resolve();
    }
   };
   const fail=()=>{cleanup();reject(Error(`Video could not be prepared: ${video.dataset.src} (readyState ${video.readyState}, ${video.error?.message||'timeout'})`));};
   const abort=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'));};
   const timer=setTimeout(fail,45000);
   events.forEach(e=>video.addEventListener(e,check));video.addEventListener('error',fail);signal.addEventListener('abort',abort);
   if(signal.aborted)abort();else check();
  });
 }
 async function render(){
  if(pending){pending.controller.abort();dispose(pending.groups);pending.staging?.remove();}
  const requestedTask=taskIndex,requestedEnv=env,task=data.tasks[taskIndex],selected=task.environments[env];
  const controller=new AbortController(),nextGroups=selected.actions.map(()=>({cells:[],videos:[],active:false,started:false,loaded:false,disposed:false}));
  const transition={controller,groups:nextGroups};pending=transition;
  [...track.children].forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.task)===taskIndex)));centerTask();
  box.setAttribute('aria-busy','true');
  const select=$('#env-select');select.disabled=true;
  const matrix=document.createElement('table');matrix.className='video-matrix';
  matrix.style.setProperty('--actions',selected.actions.length);
  matrix.setAttribute('aria-label',`${task.title}, ${selected.label}: methods by action`);
  const header=matrix.createTHead().insertRow(),corner=document.createElement('th');
  corner.scope='col';corner.textContent='Method';header.append(corner);
  selected.actions.forEach(action=>{const h=document.createElement('th');h.scope='col';h.textContent=action.label;header.append(h);});
  const body=matrix.createTBody();
  keys.forEach(k=>{
   const row=body.insertRow();row.className='method-row';if(k==='ours')row.classList.add('ours');
   const heading=document.createElement('th');heading.scope='row';heading.textContent=labels[k];row.append(heading);
   selected.actions.forEach((action,i)=>{
    const clip=action.clips[k],group=nextGroups[i],cell=row.insertCell(),v=document.createElement('video');
    cell.dataset.visible='false';v.dataset.action=String(i);v.muted=true;v.loop=true;v.playsInline=true;v.preload='none';
    v.poster=clip.poster;v.dataset.src=clip.path;
    v.setAttribute('aria-label',`${task.title}, ${selected.label}, ${action.label}, ${labels[k]}`);
    v.addEventListener('loadedmetadata',()=>{v.playbackRate=v.duration/5;});
    ['canplay','seeked','waiting'].forEach(event=>v.addEventListener(event,()=>playGroup(group)));
    cell.append(v);group.cells.push(cell);group.videos.push(v);
   });
  });
  // Keep media elements attached while buffering, without replacing the visible table.
  const staging=document.createElement('div');staging.className='video-staging';staging.setAttribute('aria-hidden','true');
  staging.style.cssText='position:fixed;left:-20000px;top:0;width:1440px;pointer-events:none';
  staging.append(matrix);document.body.append(staging);transition.staging=staging;
  // Prepare the columns that will be visible; retain the existing table meanwhile.
  // Other columns retain their exact first-frame posters until their own group is ready.
  // Bound concurrent buffering so remote video requests cannot block the whole table.
  const initialGroups=nextGroups.slice(0,1);
  try{
   initialGroups.forEach(loadGroup);
   await Promise.all(initialGroups.flatMap(g=>g.videos.map(v=>waitForStart(v,controller.signal))));
   if(pending!==transition)return;
   const previous=groups;
   cellsObserver.disconnect();groups=nextGroups;
   // One DOM replacement, with first frames already buffered: never an empty grid.
   box.classList.toggle('real',task.domain!=='Simulation');box.replaceChildren(matrix);staging.remove();box.scrollLeft=0;
   $('#task-title').textContent=task.title;$('#task-domain').textContent=task.domain;$('#task-caption').textContent=task.caption;
   select.replaceChildren();task.environments.forEach((e,i)=>select.add(new Option(e.label,String(i))));select.value=String(requestedEnv);
   activeTask=requestedTask;activeEnv=requestedEnv;
   groups.forEach(g=>{g.active=true;g.cells.forEach(cell=>cellsObserver.observe(cell));});
   pending=null;box.setAttribute('aria-busy','false');select.disabled=false;
   dispose(previous);
  }catch(error){
   dispose(nextGroups);staging.remove();
   if(pending!==transition)return;
   pending=null;box.setAttribute('aria-busy','false');select.disabled=false;
   if(activeTask>=0){
    taskIndex=activeTask;env=activeEnv;select.value=String(env);
    [...track.children].forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.task)===taskIndex)));centerTask();
   }
   if(error.name!=='AbortError'){
    console.warn(error.message);
    const message=document.createElement('p');message.setAttribute('role','status');
    message.textContent='These videos could not be loaded. Please select the task again.';
    box.append(message);
   }
  }
 }
 $('#env-select').onchange=e=>{const value=Number(e.target.value);if(value===env)return;env=value;render();};
 render();
 const colors=['#9aa4ad','#d6b96d','#7bb4bc','#a997c4','#bf8ee7'];
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1160 470');svg.setAttribute('role','img');svg.setAttribute('aria-label','Action success by task and method. Exact values are also available in the table.');
 function el(type,attr,text){const e=document.createElementNS(ns,type);Object.entries(attr).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;svg.append(e);return e;}
 for(let j=0;j<=5;j++){const y=355-j*60;el('line',{x1:60,x2:1140,y1:y,y2:y,stroke:'#303034'});el('text',{x:47,y:y+5,'text-anchor':'end',fill:'#b4b4ba','font-size':14},`${j*20}%`);}
 data.tasks.forEach((t,i)=>{const x=70+i*98;t.success.forEach((v,j)=>{const h=v*3;const bar=el('rect',{x:x+j*14,y:355-h,width:11,height:h,fill:colors[j],rx:2,tabindex:0,class:'chart-bar','data-method':j,'aria-label':`${t.title}, ${data.methods[j]}: ${v}%`});const title=document.createElementNS(ns,'title');title.textContent=`${t.title} · ${data.methods[j]}: ${v}%`;bar.append(title);});const parts=t.title==='Diverse Backgrounds'?['Diverse','Backgrounds']:t.title.split(' ');parts.forEach((p,k)=>el('text',{x:x+33,y:381+k*18,'text-anchor':'middle',fill:'#d4d4d8','font-size':13},p));});
 $('#success-chart').append(svg);
 data.methods.forEach((m,j)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed','false');const sw=document.createElement('i');sw.style.backgroundColor=colors[j];b.append(sw,document.createTextNode(m));b.onclick=()=>{const turnOn=b.getAttribute('aria-pressed')==='false';$('#chart-legend').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed',String(turnOn));svg.querySelectorAll('.chart-bar').forEach(x=>x.classList.toggle('dim',turnOn&&Number(x.dataset.method)!==j));};$('#chart-legend').append(b);});
 const table=$('#results-table');const head=table.createTHead().insertRow();['Task',...data.methods].forEach(t=>{const th=document.createElement('th');th.scope='col';th.textContent=t;head.append(th);});const body=table.createTBody();data.tasks.forEach(t=>{const tr=body.insertRow();[t.title,...t.success.map(v=>`${v}%`)].forEach(v=>tr.insertCell().textContent=v);});
}).catch(e=>{$('#comparison').textContent='The videos could not be loaded. Please refresh the page.';console.error(e);});
