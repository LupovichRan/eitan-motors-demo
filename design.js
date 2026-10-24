(() => {
 'use strict';
 const toggle=document.getElementById('nav-toggle'),nav=document.getElementById('primary-nav');
 function closeMenu(focus=false){if(!toggle||!nav)return;nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','פתיחת תפריט ניווט');if(focus)toggle.focus()}
 if(toggle&&nav){toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';nav.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'סגירת תפריט ניווט':'פתיחת תפריט ניווט')};nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'&&document.activeElement.closest('.site-header')){e.preventDefault();closeMenu(true)}});window.addEventListener('resize',()=>{if(innerWidth>850)closeMenu()})}
 function updateCount(){const count=window.Inventory?Inventory.load().filter(c=>c.status==='published').length:0;document.querySelectorAll('[data-live-stock]').forEach(e=>e.textContent=String(count))}
 updateCount();window.addEventListener('storage',e=>{if(window.Inventory&&(e.key===Inventory.KEY||e.key===null))updateCount()});
})();
