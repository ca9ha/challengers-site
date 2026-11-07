"use strict";
const $ = id => document.getElementById(id);
const rank = {S:0,A:1,B:2,C:3};
let cards = [];
// RFC-style quoted fields, escaped quotes, CRLF and multiline descriptions.
function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const firstLine = text.split(/?
/,1)[0];
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const rows=[]; let row=[], field='', quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {
      if(quoted && text[i+1]==='"') {field+='"'; i++;}
      else if(quoted || field==='') quoted=!quoted;
      else throw new Error('Некорректные кавычки в CSV.');
    } else if(!quoted && c===delimiter) {row.push(field);field='';}
    else if(!quoted && (c==='
'||c==='')) {
      if(c==='' && text[i+1]==='
') i++;
      row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';
    } else field+=c;
  }
  if(quoted)throw new Error('В CSV не закрыты кавычки.');
  if(field || row.length){row.push(field);if(row.some(v=>v.trim()))rows.push(row);}
  if(!rows.length)throw new Error('CSV-файл пуст.');
  const headers=rows.shift().map(s=>s.trim());
  for(const key of ['id','name','deck','type','power','description','image'])
    if(!headers.includes(key))throw new Error(`В CSV отсутствует столбец ${key}.`);
  if(new Set(headers).size!==headers.length)throw new Error('В CSV повторяются заголовки.');
  const ids=new Set();
  return rows.map((values,index)=>{
    if(values.length!==headers.length)throw new Error(`Запись ${index+2}: неверное число столбцов.`);
    const card=Object.fromEntries(headers.map((key,i)=>[key,values[i].trim()]));
    if(!card.id||!card.name||!card.type||!card.image)throw new Error(`Запись ${index+2}: заполните id, name, type и image.`);
    if(ids.has(card.id))throw new Error(`Повторяется id: ${card.id}`);ids.add(card.id);
    if(!Object.hasOwn(rank,card.deck))throw new Error(`Карта «${card.name}»: набор должен быть S, A, B или C.`);
    if(card.power!=='' && (!Number.isFinite(Number(card.power))||Number(card.power)<0))throw new Error(`Карта «${card.name}»: некорректная сила.`);
    const path=card.image.replace(/\\/g,'/');
    if(!path.startsWith('images/')||path.split('/').includes('..')||/[?#]/.test(path))throw new Error(`Карта «${card.name}»: изображение должно находиться в images/.`);
    card.imageURL=path.split('/').map(encodeURIComponent).join('/');
    return card;
  });
}
function make(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function image(card,lazy=true){const img=make('img');img.src=card.imageURL;img.alt=card.name;if(lazy)img.loading='lazy';img.onerror=()=>{const msg=make('span','tags','Не найдено изображение: '+card.image);img.replaceWith(msg);};return img;}
function openCard(card){$('title').textContent=card.name;$('meta').textContent=`Набор ${card.deck} · ${card.type} · Базовая сила: ${card.power||'—'}`;$('description').textContent=card.description||'Описание пока не добавлено.';$('picture').src=card.imageURL;$('picture').alt=card.name;$('modal').showModal();}
function render(){
 const query=$('search').value.trim().toLocaleLowerCase('ru');
 const list=cards.filter(c=>(!$('deck').value||c.deck===$('deck').value)&&(!$('type').value||c.type===$('type').value)&&(!query||`${c.name} ${c.type} ${c.description}`.toLocaleLowerCase('ru').includes(query)));
 const sort=$('sort').value;
 list.sort((a,b)=>{let diff=0;if(sort==='deck')diff=rank[a.deck]-rank[b.deck];if(sort==='type')diff=a.type.localeCompare(b.type,'ru');if(sort==='power')diff=(a.power===''?Infinity:Number(a.power))-(b.power===''?Infinity:Number(b.power));return diff||a.name.localeCompare(b.name,'ru');});
 $('status').textContent=`Показано ${list.length} из ${cards.length}`;
 const nodes=list.map(c=>{const button=make('button','card');button.type='button';button.setAttribute('aria-label','Открыть карту '+c.name);const art=make('div','art');art.append(image(c));const info=make('div','info');info.append(make('h2','',c.name));const tags=make('div','tags');tags.append(make('span','badge',c.deck),document.createTextNode(c.type+' · Сила '+(c.power||'—')));info.append(tags,make('p','excerpt',c.description));button.append(art,info);button.onclick=()=>openCard(c);return button;});
 $('grid').replaceChildren(...(nodes.length?nodes:[make('div','empty','Карты не найдены. Измените фильтры.')]));
}
for(const id of ['search','deck','type','sort'])$(id).addEventListener(id==='search'?'input':'change',render);
$('reset').onclick=()=>{$('search').value='';$('deck').value='';$('type').value='';$('sort').value='name';render();};
$('close').onclick=()=>$('modal').close();
$('modal').addEventListener('click',e=>{if(e.target!==$('modal'))return;const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();});
(async()=>{try{
 const response=await fetch('data/cards.csv',{cache:'no-cache'});
 if(!response.ok)throw new Error(`Не удалось загрузить data/cards.csv (HTTP ${response.status}).`);
 cards=parseCSV(await response.text());
 [...new Set(cards.map(c=>c.type))].sort((a,b)=>a.localeCompare(b,'ru')).forEach(type=>$('type').add(new Option(type,type)));
 render();
 }catch(error){$('status').textContent='Ошибка: '+error.message;$('grid').replaceChildren(make('div','empty','Откройте сайт через GitHub Pages или локальный HTTP-сервер, а не двойным щелчком по index.html. Проверьте data/cards.csv.'));}
})();
