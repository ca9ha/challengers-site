"use strict";
const $=id=>document.getElementById(id);
const BOXES={base:'Коробка 1 — Challengers',beach:'Коробка 2 — Пляжный сезон'};
const DECKS={S:0,A:1,B:2,C:3};
const RATINGS={S:0,A:1,B:2,C:3,D:4};
const STORAGE='challengers-personal-ratings-v1';
let cards=[],active=null,overrides={},storageAvailable=true;
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function has(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
function key(c){return JSON.stringify([c.box,c.id]);}
function rating(c){return has(overrides,key(c))?overrides[key(c)]:c.rating;}
function parseCSV(source){
 const text=source.replace(/^\uFEFF/,'');const first=text.split(/\r\n|\n|\r/,1)[0];const sep=first.includes(';')&&!first.includes(',')?';':',';
 const rows=[];let row=[],field='',quoted=false,closed=false;
 function endField(){row.push(field);field='';closed=false;}
 function endRow(){endField();if(row.some(v=>v.trim()))rows.push(row);row=[];}
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c===sep){endField();continue;}if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;endRow();continue;}
  if(closed){if(c===' '||c==='\t')continue;throw Error('Лишние символы после кавычки в CSV.');}
  if(c==='"'){if(field!=='')throw Error('Некорректные кавычки в CSV.');quoted=true;}else field+=c;
 }
 if(quoted)throw Error('В CSV не закрыты кавычки.');if(field!==''||row.length||closed)endRow();if(!rows.length)throw Error('CSV пуст.');
 const headers=rows.shift().map(v=>v.trim());
 for(const h of ['id','name','deck','type','power','description','image'])if(!headers.includes(h))throw Error('Нет столбца '+h);
 if(new Set(headers).size!==headers.length)throw Error('Повторяются столбцы CSV.');
 const ids=new Set();return rows.map((values,i)=>{
  if(values.length!==headers.length)throw Error(`Запись ${i+2}: неверное число полей.`);
  const c=Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));
  c.box=headers.includes('box')?c.box:'base';c.rating=(c.rating||'').toUpperCase();c.deck=c.deck.toUpperCase();
  if(!has(BOXES,c.box))throw Error(`Карта «${c.name}»: box должен быть base или beach.`);
  if(!c.id||!c.name||!c.type||!c.image)throw Error(`Запись ${i+2}: заполните id, name, type, image.`);
  if(ids.has(key(c)))throw Error('Повторяется id внутри коробки: '+c.id);ids.add(key(c));
  if(c.deck&&!has(DECKS,c.deck))throw Error(`Карта «${c.name}»: deck — S/A/B/C или пусто.`);
  if(c.rating&&!has(RATINGS,c.rating))throw Error(`Карта «${c.name}»: rating — S/A/B/C/D или пусто.`);
  if(c.power!==''&&(!Number.isFinite(Number(c.power))||Number(c.power)<0))throw Error(`Карта «${c.name}»: некорректная сила.`);
  const path=c.image.replace(/\\/g,'/'),parts=path.split('/');
  if(!path.startsWith('images/')||parts.some(s=>!s||s==='.'||s==='..')||/[?#]/.test(path))throw Error('Неверный путь изображения: '+c.image);
  c.imageURL=parts.map(encodeURIComponent).join('/');return c;
 });
}
function loadOverrides(){try{const value=JSON.parse(localStorage.getItem(STORAGE)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))for(const [k,v] of Object.entries(value))if(v===''||has(RATINGS,v))overrides[k]=v;}catch(e){storageAvailable=false;}}
function persistOverrides(){try{localStorage.setItem(STORAGE,JSON.stringify(overrides));storageAvailable=true;return true;}catch(e){storageAvailable=false;return false;}}
function ratingBadge(value){const n=node('span','rating-badge rating-'+(value||'none'),'Рейтинг '+(value||'—'));return n;}
function updateTypes(){const old=$('type').value;const types=[...new Set(cards.filter(c=>!$('box').value||c.box===$('box').value).map(c=>c.type))].sort((a,b)=>a.localeCompare(b,'ru'));$('type').replaceChildren(new Option('Все типы',''),...types.map(t=>new Option(t,t)));if(types.includes(old))$('type').value=old;}
function openCard(c){active=c;$('title').textContent=c.name;$('meta').textContent=[BOXES[c.box],c.deck?'Набор '+c.deck:'Набор не указан',c.type,'Сила: '+(c.power===''?'—':c.power)].join(' · ');$('description').textContent=c.description||'Описание пока не добавлено.';$('editRating').value=rating(c);$('ratingMessage').textContent=storageAvailable?'Оценки сохраняются в этом браузере. Для GitHub используйте экспорт CSV.':'Локальное сохранение недоступно. После оценки экспортируйте CSV.';const img=$('picture');img.onerror=()=>{img.onerror=null;img.removeAttribute('src');img.alt='Не найдено: '+c.image;};img.alt=c.name;img.src=c.imageURL;$('modal').showModal();}
function render(){const query=$('search').value.trim().toLocaleLowerCase('ru'),box=$('box').value,deck=$('deck').value,type=$('type').value,selected=$('rating').value;
 const list=cards.filter(c=>(!box||c.box===box)&&(!deck||(deck==='unknown'?!c.deck:c.deck===deck))&&(!type||c.type===type)&&(!selected||(selected==='unrated'?!rating(c):rating(c)===selected))&&(!query||[c.name,c.type,c.description].join(' ').toLocaleLowerCase('ru').includes(query)));
 const sort=$('sort').value;list.sort((a,b)=>{let d=0;if(sort==='rating')d=(RATINGS[rating(a)]??5)-(RATINGS[rating(b)]??5);if(sort==='box')d=(a.box==='base'?0:1)-(b.box==='base'?0:1);if(sort==='deck')d=(DECKS[a.deck]??4)-(DECKS[b.deck]??4);if(sort==='type')d=a.type.localeCompare(b.type,'ru');if(sort==='power'){const x=a.power===''?Infinity:Number(a.power),y=b.power===''?Infinity:Number(b.power);d=x===y?0:x-y;}return d||a.name.localeCompare(b.name,'ru');});
 const base=cards.filter(c=>c.box==='base').length;const rated=cards.filter(c=>rating(c)!=='').length;$('status').textContent=`Показано ${list.length} из ${cards.length} · Коробка 1: ${base} · Коробка 2: ${cards.length-base} · С рейтингом: ${rated}`;
 const elements=list.map(c=>{const b=node('button','card');b.type='button';b.setAttribute('aria-label',`${c.name}, ${BOXES[c.box]}, рейтинг ${rating(c)||'не указан'}`);const art=node('div','art'),img=node('img');img.alt=c.name;img.loading='lazy';img.onerror=()=>{const m=node('span','tags','Не найдено: '+c.image);m.style.padding='14px';m.style.overflowWrap='anywhere';img.replaceWith(m);};img.src=c.imageURL;art.append(img);const info=node('div','info');const label=node('div','box-label',BOXES[c.box]);const tags=node('div','tags');tags.append(node('span','badge',c.deck||'?'),document.createTextNode(c.type+' · Сила '+(c.power===''?'—':c.power)));info.append(label,ratingBadge(rating(c)),node('h2','',c.name),tags,node('p','excerpt',c.description||'Описание пока не добавлено.'));b.append(art,info);b.onclick=()=>openCard(c);return b;});
 if(!elements.length)elements.push(node('div','empty','Карты не найдены. Измените фильтры.'));$('grid').replaceChildren(...elements);
}
function exportCSV(){
 const fields=['id','name','deck','type','power','description','image','box','rating'];
 const escape=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const text='\uFEFF'+[fields.join(','),...cards.map(c=>fields.map(f=>escape(f==='rating'?rating(c):c[f])).join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='cards.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function init(){try{
 for(const id of ['box','search','deck','type','rating','sort','reset','export','status','grid','modal','close','title','meta','description','picture','editRating','saveRating','resetRating','ratingMessage'])if(!$(id))throw Error('Замените index.html из обновления: отсутствует '+id);
 loadOverrides();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);let text;try{const response=await fetch('data/cards.csv',{cache:'no-cache',signal:controller.signal});if(!response.ok)throw Error('CSV: HTTP '+response.status);text=await response.text();}finally{clearTimeout(timer);}
 if(/^\s*(<!doctype html|<html[\s>])/i.test(text))throw Error('Вместо CSV получен HTML. Проверьте data/cards.csv.');cards=parseCSV(text);updateTypes();render();
 $('search').oninput=render;for(const id of ['deck','type','rating','sort'])$(id).onchange=render;$('box').onchange=()=>{updateTypes();render();};
 $('reset').onclick=()=>{for(const id of ['search','box','deck','type','rating'])$(id).value='';$('sort').value='name';updateTypes();render();};$('export').onclick=exportCSV;
 $('saveRating').onclick=()=>{if(!active)return;const value=$('editRating').value;if(value!==''&&!has(RATINGS,value))return;overrides[key(active)]=value;const saved=persistOverrides();render();$('ratingMessage').textContent=saved?'Рейтинг сохранён в этом браузере. Для переноса на GitHub экспортируйте CSV.':'Рейтинг изменён только до закрытия страницы. Экспортируйте CSV сейчас.';};
 $('resetRating').onclick=()=>{if(!active)return;delete overrides[key(active)];const saved=persistOverrides();$('editRating').value=rating(active);render();$('ratingMessage').textContent=saved?'Восстановлено значение из CSV.':'Значение из CSV восстановлено в текущем сеансе. Экспортируйте CSV.';};
 $('close').onclick=()=>$('modal').close();$('modal').onclick=e=>{if(e.target!==$('modal'))return;const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();};
 }catch(e){console.error(e);if($('status'))$('status').textContent='Ошибка: '+(e.name==='AbortError'?'Превышено время загрузки CSV.':e.message);if($('grid'))$('grid').replaceChildren(node('div','empty','Проверьте CSV и запускайте сайт через HTTP-сервер. Подробности: F12 → Console.'));}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
