"use strict";
const $=id=>document.getElementById(id);
const boxes={base:'Коробка 1 — Challengers',beach:'Коробка 2 — Пляжный сезон'};
const ranks={S:0,A:1,B:2,C:3};
let cards=[];
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function parseCSV(source){
 const text=source.replace(/^\uFEFF/,'');
 const header=text.split(/\r\n|\n|\r/,1)[0];
 const sep=header.includes(';')&&!header.includes(',')?';':',';
 const rows=[];let row=[],field='',quoted=false,closed=false;
 const endField=()=>{row.push(field);field='';closed=false;};
 const endRow=()=>{endField();if(row.some(v=>v.trim()))rows.push(row);row=[];};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c===sep){endField();continue;}
  if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;endRow();continue;}
  if(closed){if(c===' '||c==='\t')continue;throw Error('Лишние символы после кавычки в CSV.');}
  if(c==='"'){if(field!=='')throw Error('Некорректные кавычки в CSV.');quoted=true;}else field+=c;
 }
 if(quoted)throw Error('В CSV не закрыты кавычки.');
 if(field!==''||row.length||closed)endRow();
 if(!rows.length)throw Error('CSV пуст.');
 const headers=rows.shift().map(v=>v.trim());
 for(const key of ['id','name','deck','type','power','description','image'])if(!headers.includes(key))throw Error('Нет столбца '+key);
 if(new Set(headers).size!==headers.length)throw Error('Повторяются столбцы CSV.');
 const ids=new Set();
 return rows.map((values,index)=>{
  if(values.length!==headers.length)throw Error(`Запись ${index+2}: неверное число полей.`);
  const c=Object.fromEntries(headers.map((h,i)=>[h,values[i].trim()]));
  // Missing box column is supported for the original box's legacy CSV.
  c.box=headers.includes('box')?c.box:'base';
  if(!Object.prototype.hasOwnProperty.call(boxes,c.box))throw Error(`Карта «${c.name}»: box должен быть base или beach.`);
  if(!c.id||!c.name||!c.type||!c.image)throw Error(`Запись ${index+2}: заполните id, name, type, image.`);
  const key=c.box+':'+c.id;
  if(ids.has(key))throw Error('Повторяется id внутри коробки: '+key);ids.add(key);
  c.deck=c.deck.toUpperCase();
  if(c.deck&&!Object.prototype.hasOwnProperty.call(ranks,c.deck))throw Error(`Карта «${c.name}»: deck — S/A/B/C или пустое поле.`);
  if(c.power!==''&&(!Number.isFinite(Number(c.power))||Number(c.power)<0))throw Error(`Карта «${c.name}»: некорректная сила.`);
  const path=c.image.replace(/\\/g,'/');const parts=path.split('/');
  if(!path.startsWith('images/')||parts.some(p=>!p||p==='.'||p==='..')||/[?#]/.test(path))throw Error(`Карта «${c.name}»: неверный путь изображения.`);
  c.imageURL=parts.map(encodeURIComponent).join('/');return c;
 });
}
function refreshTypes(){const previous=$('type').value;const values=[...new Set(cards.filter(c=>!$('box').value||c.box===$('box').value).map(c=>c.type))].sort((a,b)=>a.localeCompare(b,'ru'));$('type').replaceChildren(new Option('Все типы',''),...values.map(v=>new Option(v,v)));if(values.includes(previous))$('type').value=previous;}
function openCard(c){$('title').textContent=c.name;$('meta').textContent=[boxes[c.box],c.deck?'Набор '+c.deck:'Набор не указан',c.type,'Сила: '+(c.power===''?'—':c.power)].join(' · ');$('description').textContent=c.description||'Описание пока не добавлено.';const img=$('picture');img.onerror=()=>{img.onerror=null;img.removeAttribute('src');img.alt='Не найдено изображение: '+c.image;};img.alt=c.name;img.src=c.imageURL;$('modal').showModal();}
function render(){
 const q=$('search').value.trim().toLocaleLowerCase('ru');const box=$('box').value,deck=$('deck').value,type=$('type').value;
 const list=cards.filter(c=>(!box||c.box===box)&&(!deck||(deck==='unknown'?c.deck==='':c.deck===deck))&&(!type||c.type===type)&&(!q||[c.name,c.type,c.description].join(' ').toLocaleLowerCase('ru').includes(q)));
 const sort=$('sort').value;
 list.sort((a,b)=>{let d=0;if(sort==='box')d=a.box.localeCompare(b.box);if(sort==='deck')d=(ranks[a.deck]??4)-(ranks[b.deck]??4);if(sort==='type')d=a.type.localeCompare(b.type,'ru');if(sort==='power'){const x=a.power===''?Infinity:Number(a.power),y=b.power===''?Infinity:Number(b.power);d=x===y?0:x-y;}return d||a.name.localeCompare(b.name,'ru');});
 const base=cards.filter(c=>c.box==='base').length;const beach=cards.length-base;
 $('status').textContent=`Показано ${list.length} из ${cards.length} · Коробка 1: ${base} · Коробка 2: ${beach}`;
 const nodes=list.map(c=>{
  const b=el('button','card');b.type='button';b.setAttribute('aria-label',boxes[c.box]+': '+c.name);
  const art=el('div','art'),img=el('img');img.alt=c.name;img.loading='lazy';img.onerror=()=>{const msg=el('span','tags','Не найдено: '+c.image);msg.style.padding='16px';msg.style.overflowWrap='anywhere';img.replaceWith(msg);};img.src=c.imageURL;art.append(img);
  const info=el('div','info'),tags=el('div','tags');tags.append(el('span','badge',c.deck||'?'),document.createTextNode(c.type+' · Сила '+(c.power===''?'—':c.power)));
  const label=el('div','box-label',boxes[c.box]);label.style.color=c.box==='beach'?'#6ee7d5':'#c4b5fd';label.style.fontSize='12px';label.style.marginBottom='9px';
  info.append(label,el('h2','',c.name),tags,el('p','excerpt',c.description||'Описание пока не добавлено.'));b.append(art,info);b.onclick=()=>openCard(c);return b;
 });
 if(!nodes.length)nodes.push(el('div','empty',box==='beach'&&!beach?'Карты второй коробки ещё не добавлены в CSV.':'Карты не найдены. Измените фильтры.'));
 $('grid').replaceChildren(...nodes);
}
async function init(){try{
 for(const id of ['box','search','deck','type','sort','reset','status','grid','modal','close','title','meta','description','picture'])if(!$(id))throw Error('Обновите index.html: отсутствует элемент '+id);
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);let text;
 try{const response=await fetch('data/cards.csv',{cache:'no-cache',signal:controller.signal});if(!response.ok)throw Error('Ошибка загрузки data/cards.csv: HTTP '+response.status);text=await response.text();}finally{clearTimeout(timer);}
 if(/^\s*(<!doctype html|<html[\s>])/i.test(text))throw Error('Вместо CSV получен HTML. Проверьте путь data/cards.csv.');
 cards=parseCSV(text);refreshTypes();render();
 $('box').onchange=()=>{refreshTypes();render();};$('search').oninput=render;for(const id of ['deck','type','sort'])$(id).onchange=render;
 $('reset').onclick=()=>{for(const id of ['box','search','deck','type'])$(id).value='';$('sort').value='name';refreshTypes();render();};
 $('close').onclick=()=>$('modal').close();$('modal').onclick=e=>{if(e.target!==$('modal'))return;const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();};
 }catch(error){console.error(error);if($('status'))$('status').textContent='Ошибка: '+(error.name==='AbortError'?'Превышено время загрузки CSV.':error.message);if($('grid'))$('grid').replaceChildren(el('div','empty','Проверьте CSV и запускайте сайт через HTTP-сервер. Подробности: F12 → Console.'));}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
