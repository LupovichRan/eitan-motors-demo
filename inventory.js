(()=>{'use strict';const KEY='eitan-inventory-v1';const seed=[{id:1,brand:'טויוטה',name:'קורולה',year:2022,km:42000,hand:1,price:112000,kind:'משפחתית',fuel:'היברידי',photo:'photo-1621007947382-bb3c3994e3fb',badge:'היברידית וחסכונית',color:'לבן'},{id:2,brand:'קיה',name:'ספורטאז׳',year:2021,km:58000,hand:1,price:119000,kind:'פנאי ושטח',fuel:'בנזין',photo:'photo-1533473359331-0135ef1b58bf',badge:'מרחב לכל המשפחה',color:'אפור'},{id:3,brand:'יונדאי',name:'i20',year:2023,km:26000,hand:1,price:89000,kind:'סופר מיני',fuel:'בנזין',photo:'photo-1552519507-da3b142c6e3d',badge:'חדש במלאי',color:'כחול'},{id:4,brand:'מאזדה',name:'3',year:2020,km:72000,hand:2,price:79000,kind:'משפחתית',fuel:'בנזין',photo:'photo-1494905998402-395d579af36f',badge:'בחירה חכמה',color:'אדום'},{id:5,brand:'סקודה',name:'אוקטביה',year:2022,km:49000,hand:1,price:105000,kind:'משפחתית',fuel:'בנזין',photo:'photo-1503376780353-7e6692767b70',badge:'נוחות בכל נסיעה',color:'כסוף'},{id:6,brand:'סיאט',name:'איביזה',year:2021,km:61000,hand:2,price:73500,kind:'סופר מיני',fuel:'בנזין',photo:'photo-1503736334956-4c8f8e92946d',badge:'בדיוק לעיר',color:'לבן'}];
const MAX_ROWS=200, MAX_JSON=4500000, MAX_IMAGE_BYTES=700*1024;
const statusSet=new Set(['published','draft','sold']);
const kinds=new Set(['משפחתית','פנאי ושטח','סופר מיני']);
const fuels=new Set(['בנזין','היברידי','חשמלי','דיזל']);
function imageURL(value){
 if(typeof value!=='string'||value.length>1000000)throw Error('כתובת תמונה אינה תקינה');
 if(value.startsWith('data:')){
  const m=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!m||m[2].length%4!==0||m[2].length*3/4>MAX_IMAGE_BYTES+2)throw Error('תמונה מקומית אינה תקינה או גדולה מדי');
  const valid=m[1]==='png'?m[2].startsWith('iVBORw0KGgo'):m[1]==='jpeg'?m[2].startsWith('/9j/'):m[2].startsWith('UklGR');
  if(!valid)throw Error('תוכן התמונה אינו תואם לפורמט המוצהר');
  return value;
 }
 if(value.length>2048)throw Error('כתובת התמונה ארוכה מדי');
 let u;try{u=new URL(value)}catch{throw Error('כתובת תמונה אינה תקינה')}
 if(u.protocol!=='https:'||u.hostname!=='images.unsplash.com'||u.username||u.password||u.port)throw Error('קישורים לתמונות מותרים רק מ־images.unsplash.com ב־HTTPS. אפשר להעלות תמונה מהמכשיר.');
 return u.href;
}
function text(row,key,max,required=false){
 const value=row[key]??'';
 if(typeof value!=='string'||value.length>max)throw Error('טקסט לא תקין בשדה '+key);
 const result=value.trim();if(required&&!result)throw Error('יש למלא יצרן ודגם');return result;
}
function clean(row){
 if(!row||typeof row!=='object'||Array.isArray(row))throw Error('רשומת רכב אינה תקינה');
 const out={};
 for(const k of ['brand','name','kind','fuel','color','badge'])out[k]=text(row,k,100,['brand','name'].includes(k));
 if(!kinds.has(out.kind)||!fuels.has(out.fuel))throw Error('סוג רכב או הנעה אינם תקינים');
 for(const [k,min,max]of [['id',1,9999999999999],['year',1950,2030],['km',0,2000000],['hand',1,20],['price',1,10000000]]){
  const value=row[k];if(!['number','string'].includes(typeof value)||(typeof value==='string'&&!/^\d+$/.test(value)))throw Error('ערך לא תקין בשדה '+k);
  out[k]=Number(value);if(!Number.isSafeInteger(out[k])||out[k]<min||out[k]>max)throw Error('ערך לא תקין בשדה '+k);
 }
 out.status=row.status??'draft';if(!statusSet.has(out.status))throw Error('סטטוס רכב אינו תקין');
 if(row.images!==undefined&&(!Array.isArray(row.images)||row.images.length>4))throw Error('אפשר לשמור עד 4 תמונות לרכב');
 out.images=(row.images||[]).map(imageURL);
 if(!out.images.length&&typeof row.photo==='string'&&/^photo-[a-z0-9-]+$/i.test(row.photo))out.images=[imageURL('https://images.unsplash.com/'+row.photo+'?auto=format&fit=crop&w=900&q=80')];
 out.description=text(row,'description',2000);return out;
}
const defaults=()=>seed.map(row=>clean({...row,status:'published'}));
function validate(rows){
 if(!Array.isArray(rows)||rows.length>MAX_ROWS)throw Error('המלאי מוגבל ל־200 רכבים');
 const result=rows.map(clean);if(new Set(result.map(c=>c.id)).size!==result.length)throw Error('המלאי מכיל מזהים כפולים');
 return result;
}
function load(){
 try{const raw=localStorage.getItem(KEY);if(raw===null)return defaults();if(raw.length>MAX_JSON)throw Error('מלאי גדול מדי');const result=validate(JSON.parse(raw));window.inventoryLoadFailed=false;return result}
 catch{window.inventoryLoadFailed=true;return defaults()}
}
function save(rows){
 const result=validate(rows),serialized=JSON.stringify(result);
 if(serialized.length>MAX_JSON||new TextEncoder().encode(serialized).length>MAX_JSON)throw Error('המלאי גדול מדי. הקטינו או הסירו תמונות לפני השמירה.');
 try{localStorage.setItem(KEY,serialized)}catch{throw Error('לא ניתן לשמור. ייתכן שאחסון הדפדפן מלא. הקטינו תמונות או הסירו חלק מהן.')}
 return result;
}
function reset(){localStorage.removeItem(KEY);return defaults()}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function decodeImage(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>MAX_IMAGE_BYTES)throw Error('יש לבחור JPEG, PNG או WebP בגודל עד 700KB.');
 const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const isPng=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 const isJpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const isWebp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!(file.type==='image/png'&&isPng||file.type==='image/jpeg'&&isJpeg||file.type==='image/webp'&&isWebp))throw Error('תוכן הקובץ אינו תואם לסוג התמונה.');
 let bitmap;try{bitmap=await createImageBitmap(file)}catch{throw Error('לא ניתן לפענח את התמונה. בחרו קובץ תמונה תקין.')}
 if(!bitmap.width||!bitmap.height||bitmap.width>4096||bitmap.height>4096||bitmap.width*bitmap.height>16000000){bitmap.close();throw Error('רזולוציית התמונה גדולה מדי. המגבלה היא 4096 פיקסלים ו־16 מגה־פיקסל.')}
 return bitmap;
}
async function prepareUpload(file){
 const bitmap=await decodeImage(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
 try{const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);return imageURL(canvas.toDataURL('image/webp',.82))}
 finally{bitmap.close()}
}
async function validateImportedImages(rows){
 // Decode local images sequentially; never make a network request while validating a backup.
 for(const row of rows)for(const source of row.images)if(source.startsWith('data:')){
  const match=/^data:([^;]+);base64,(.*)$/.exec(source),raw=atob(match[2]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const bitmap=await decodeImage(new Blob([bytes],{type:match[1]}));bitmap.close();
 }
}
const bundledImages = Object.freeze({
 'photo-1621007947382-bb3c3994e3fb':'vehicle-01.jpg',
 'photo-1533473359331-0135ef1b58bf':'vehicle-02.jpg',
 'photo-1552519507-da3b142c6e3d':'vehicle-03.jpg',
 'photo-1494905998402-395d579af36f':'vehicle-04.jpg',
 'photo-1503376780353-7e6692767b70':'vehicle-05.jpg',
 'photo-1503736334956-4c8f8e92946d':'vehicle-06.jpg'
});
function displayImage(source){
 if(!source)return 'placeholder.svg';
 const match=/^https:\/\/images\.unsplash\.com\/(photo-[a-z0-9-]+)(?:\?|$)/i.exec(source);
 return match&&Object.hasOwn(bundledImages,match[1])?bundledImages[match[1]]:source;
}
window.Inventory={KEY,load,save,reset,clean,validate,imageURL,prepareUpload,validateImportedImages,displayImage,esc,MAX_JSON};})();
