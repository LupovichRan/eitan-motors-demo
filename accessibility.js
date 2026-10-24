(() => {
  'use strict';
  const key='eitan-accessibility-v1', defaults={size:100,contrast:false,links:false,motion:false};
  const $=id=>document.getElementById(id),panel=$('accessibility-panel'),opener=$('accessibility-toggle');
  function readSettings(){const result={...defaults};try{const raw=localStorage.getItem(key);if(raw&&raw.length<1024){const saved=JSON.parse(raw);if(saved&&typeof saved==='object'){result.size=[100,125,150,175,200].includes(saved.size)?saved.size:100;for(const k of ['contrast','links','motion'])result[k]=saved[k]===true}}}catch{}return result}
  let settings=readSettings(),frame=0;
  function fitViewport(){const v=window.visualViewport,style=document.documentElement.style;document.documentElement.toggleAttribute('data-viewport-narrow',(v?.width||innerWidth)<300);style.setProperty('--visible-width',(v?.width||innerWidth)+'px');style.setProperty('--visible-height',(v?.height||innerHeight)+'px');style.setProperty('--visible-left',(v?.offsetLeft||0)+'px');style.setProperty('--visible-top',(v?.offsetTop||0)+'px')}
  function scheduleFit(){cancelAnimationFrame(frame);frame=requestAnimationFrame(fitViewport)}
  function apply(persist=true){const active=document.activeElement;document.documentElement.style.fontSize=settings.size+'%';document.documentElement.toggleAttribute('data-text-large',settings.size>=150);for(const[k,c]of[['contrast','a11y-contrast'],['links','a11y-links'],['motion','a11y-reduce-motion']]){document.body.classList.toggle(c,settings[k]);document.documentElement.classList.toggle(c,settings[k]);$(k+'-toggle')?.setAttribute('aria-pressed',String(settings[k]))}if($('text-size'))$('text-size').textContent=settings.size+'%';if($('text-smaller'))$('text-smaller').disabled=settings.size<=100;if($('text-larger'))$('text-larger').disabled=settings.size>=200;if(persist)try{localStorage.setItem(key,JSON.stringify(settings))}catch{}fitViewport();if(active?.disabled){const target=active.id==='text-larger'?$('text-smaller'):$('text-larger');target?.focus({preventScroll:true})}}
  apply(false);
  window.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('scroll',scheduleFit);
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){settings=readSettings();apply(false)}});
  const syncModals=()=>{document.body.classList.toggle('has-modal',!!document.querySelector('dialog[open]'));fitViewport()};
  new MutationObserver(syncModals).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const dialog=document.activeElement?.closest('dialog[open]')||[...document.querySelectorAll('dialog[open]')].at(-1);if(!dialog)return;const items=[...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(!first)return;if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus()}else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus()}});
  if(!panel||!opener)return;
  opener.onclick=()=>{fitViewport();panel.showModal();opener.setAttribute('aria-expanded','true')};
  $('accessibility-close').onclick=()=>panel.close();
  panel.addEventListener('close',()=>{if(panel.open)return;opener.setAttribute('aria-expanded','false');opener.focus({preventScroll:true})});
  panel.addEventListener('click',event=>{if(event.target===panel){const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)panel.close()}});
  $('text-smaller').onclick=()=>{settings.size=Math.max(100,settings.size-25);apply()};$('text-larger').onclick=()=>{settings.size=Math.min(200,settings.size+25);apply()};
  for(const k of ['contrast','links','motion'])$(k+'-toggle').onclick=()=>{settings[k]=!settings[k];apply()};
  $('accessibility-reset').onclick=()=>{settings={...defaults};try{localStorage.removeItem(key)}catch{}apply(false)};
})();
