(() => {
  'use strict';
  const data = window.XIAOBEI_SELECTOR_DATA;
  const el = id => document.getElementById(id);
  const state = { category: '交换机', results: [], visible: 10 };
  const ids = ['databaseStatus','tenderText','category','parseButton','exampleButton','subtype','keyword','maxPrice','routerCriteria','switchCriteria','wirelessCriteria','securityCriteria','accessoryCriteria','routerUsers','routerBandwidth','routerApCount','routerPorts','routerPoe','managed','layer','switchCapacity','switchForwarding','switchPorts','poeGrade','poeBudget','chassis','controllerSlots','serviceSlots','wifiGeneration','apForm','wirelessRate','streams','wirelessUsers','wirelessPorts','protection','wirelessPoe','securityPorts','securityCapacity','securityForwarding','securityPoeBudget','securityPoe','compatibleModel','recognizedSummary','matchButton','resultCount','exportButton','results','emptyState','showMoreButton'];
  const refs = Object.fromEntries(ids.map(id => [id, el(id)]));
  if (!data?.products) { refs.databaseStatus.textContent = '产品数据库加载失败'; return; }
  refs.databaseStatus.textContent = `数据库：${data.stats.total} 条产品与配件 · ${data.sourcePeriod}`;

  const norm = value => String(value || '').replace(/[，；]/g, ',').replace(/\s+/g, ' ').trim();
  const num = value => { const m = String(value || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const categoryPanels = { '路由器/网关':'routerCriteria', '交换机':'switchCriteria', '无线AP':'wirelessCriteria', '安防网络':'securityCriteria', '配件与模块':'accessoryCriteria' };
  const categories = Object.keys(categoryPanels);
  const statusOrder = { pass: 0, review: 1, fail: 2 };

  function inferCategory(source) {
    if (/光模块|电源模块|板卡|业务板|接口模块|组合包|配件|挂耳|收发器机架/i.test(source)) return '配件与模块';
    if (/路由器|网关|带机量|wan|lan|管理\s*\d+\s*(?:个)?ap/i.test(source)) return '路由器/网关';
    if (/无线|wifi|wi-fi|\bap\b|吸顶|面板ap|高密|802\.11(?:ax|be)/i.test(source)) return '无线AP';
    if (/安防|网桥|防私接|长距离传输|光纤收发器/i.test(source)) return '安防网络';
    return '交换机';
  }
  function showCategory(category) {
    state.category = category;
    Object.entries(categoryPanels).forEach(([name, id]) => refs[id].classList.toggle('hidden', name !== category));
    const subtypes = [...new Set(data.products.filter(p => p.category === category).map(p => p.subtype))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
    refs.subtype.innerHTML = '<option value="">不限</option>' + subtypes.map(value => `<option>${esc(value)}</option>`).join('');
  }
  function parseThreshold(source, keys, units) {
    const key = `(?:${keys.join('|')})`, unit = `(?:${units.join('|')})`;
    for (const pattern of [new RegExp(`${key}[^\\d]{0,18}(\\d+(?:\\.\\d+)?)\\s*(${unit})`, 'i'), new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unit})[^,。；]{0,14}${key}`, 'i')]) {
      const match = source.match(pattern); if (match) return { value: Number(match[1]), unit: match[2].toLowerCase() };
    }
    return null;
  }
  const capacityFrom = source => { const f = parseThreshold(source,['交换容量','交换性能'],['tbps','gbps','t','g']); return f ? (f.unit.startsWith('t') ? f.value*1000 : f.value) : ''; };
  const forwardingFrom = source => { const f = parseThreshold(source,['包转发率','转发能力','转发性能'],['mpps','m']); return f ? f.value : ''; };
  const priceFrom = source => { const m=source.match(/(?:预算|价格|不超过|最高)[^\d]{0,8}(\d+(?:\.\d+)?)\s*元/i); return m ? m[1] : ''; };
  const countFrom = (source, keys) => { const m=source.match(new RegExp(`(?:${keys.join('|')})[^\\d]{0,12}(\\d+)`,'i')); return m ? m[1] : ''; };
  function portPhrase(source) { return source.split(/[，,、。；;\n]/).map(x=>x.trim()).filter(x=>/(?:端口|电口|光口|sfp|qsfp|\d(?:\.\d+)?\s*ge|千兆|万兆|百兆)/i.test(x)&&!/交换容量|转发率/.test(x)).slice(0,3).join('；'); }
  function parseText() {
    const source = norm(refs.tenderText.value);
    const category = refs.category.value === 'auto' ? inferCategory(source) : refs.category.value;
    showCategory(category); refs.category.value = category;
    refs.maxPrice.value = priceFrom(source);
    const recognized = [`产品：${category}`];
    if (refs.maxPrice.value) recognized.push(`指导价 ≤ ${refs.maxPrice.value}元`);
    if (category === '交换机') {
      refs.switchCapacity.value=capacityFrom(source); refs.switchForwarding.value=forwardingFrom(source); refs.switchPorts.value=/框式|模块化/.test(source)?'':portPhrase(source);
      refs.layer.value=/三层|静态路由/.test(source)?'三层':/二层/.test(source)?'二层':''; refs.managed.value=/无管理|非网管/.test(source)?'非网管':/极简|云管/.test(source)?'云管/极简管理':/网管/.test(source)?'网管':'';
      refs.poeGrade.value=/不支持poe|非poe/i.test(source)?'none':/poe\+\+|802\.3bt/i.test(source)?'PoE++':/poe\+|802\.3at/i.test(source)?'PoE+':/poe/i.test(source)?'any':'';
      refs.poeBudget.value=countFrom(source,['整机PoE(?:最大)?(?:输出)?功率','PoE预算']); refs.chassis.checked=/框式|模块化机箱/.test(source);
      refs.controllerSlots.value=countFrom(source,['主控槽位','主控板']); refs.serviceSlots.value=countFrom(source,['业务槽位','业务板']);
      if(refs.switchCapacity.value)recognized.push(`交换容量 ≥ ${refs.switchCapacity.value}Gbps`); if(refs.switchForwarding.value)recognized.push(`包转发率 ≥ ${refs.switchForwarding.value}Mpps`); if(refs.switchPorts.value)recognized.push(`端口：${refs.switchPorts.value}`); if(refs.poeGrade.value)recognized.push(`PoE：${refs.poeGrade.value}`);
    } else if (category === '路由器/网关') {
      refs.routerUsers.value=countFrom(source,['带机量','终端数','用户数']); {const rb=parseThreshold(source,['推荐带宽','适用带宽'],['gbps','g','mbps','m']);refs.routerBandwidth.value=rb?(rb.unit.startsWith('m')?rb.value/1000:rb.value):'';} refs.routerApCount.value=countFrom(source,['AP管理','管理AP数','支持管理']); refs.routerPorts.value=portPhrase(source); refs.routerPoe.checked=/poe/i.test(source);
      if(refs.routerUsers.value)recognized.push(`带机量 ≥ ${refs.routerUsers.value}`); if(refs.routerApCount.value)recognized.push(`AP管理 ≥ ${refs.routerApCount.value}`);
    } else if (category === '无线AP') {
      refs.wifiGeneration.value=/wifi\s*7|wi-fi\s*7|802\.11be/i.test(source)?'Wi-Fi 7':/wifi\s*6|wi-fi\s*6|802\.11ax/i.test(source)?'Wi-Fi 6':''; refs.apForm.value=['面板AP','吸顶AP','室外AP','高密AP'].find(x=>source.toLowerCase().includes(x.toLowerCase()))||'';
      const rate=parseThreshold(source,['无线速率','接入速率','整机速率'],['gbps','g','mbps','m']); refs.wirelessRate.value=rate?(rate.unit.startsWith('m')?rate.value/1000:rate.value):''; refs.streams.value=countFrom(source,['流数','流']); refs.wirelessUsers.value=countFrom(source,['推荐用户数','推荐最大接入用户数']); refs.wirelessPorts.value=portPhrase(source); refs.protection.value=source.match(/IP\d{2}/i)?.[0]||''; refs.wirelessPoe.checked=/poe/i.test(source);
      if(refs.wifiGeneration.value)recognized.push(refs.wifiGeneration.value); if(refs.apForm.value)recognized.push(refs.apForm.value); if(refs.wirelessRate.value)recognized.push(`速率 ≥ ${refs.wirelessRate.value}Gbps`);
    } else if (category === '安防网络') {
      refs.securityPorts.value=portPhrase(source); refs.securityCapacity.value=capacityFrom(source); refs.securityForwarding.value=forwardingFrom(source); refs.securityPoeBudget.value=countFrom(source,['整机PoE(?:最大)?输出功率']); refs.securityPoe.checked=/poe/i.test(source);
    } else { refs.compatibleModel.value=source.match(/(?:US700|S730[36]X-G|UR\d+[A-Z-]*)/i)?.[0]||''; }
    refs.recognizedSummary.textContent=`已识别：${recognized.join('；')}`;
  }

  function checkMinimum(actual, required, label) { if(!required)return null; if(actual===null||actual===undefined)return{status:'review',label,detail:'数据源未明确'}; return actual>=required?{status:'pass',label,detail:`${actual} ≥ ${required}`,proximity:required/actual}:{status:'fail',label,detail:`${actual} < ${required}`,proximity:actual/required}; }
  function checkText(product, required, label) { if(!required)return null; const tokens=String(required).toLowerCase().split(/[，,、；;\s]+/).filter(x=>x.length>1); const missing=tokens.filter(x=>!product.searchText.includes(x)); return missing.length?{status:'review',label,detail:`未直接检出：${missing.join('、')}`}:{status:'pass',label,detail:'关键词已匹配'}; }
  function closestAvailable(values,required){const known=values.filter(x=>Number.isFinite(x));const sufficient=known.filter(x=>x>=required);return sufficient.length?Math.min(...sufficient):(known.length?Math.max(...known):null);}
  function extractPortItems(source, definitions){const items=[],occupied=[];for(const definition of definitions){let match;definition.pattern.lastIndex=0;while((match=definition.pattern.exec(source))){const start=match.index,end=start+match[0].length;if(occupied.some(range=>start<range.end&&end>range.start))continue;occupied.push({start,end});items.push({count:Number(match[1]),speed:definition.speed,medium:definition.medium,label:match[0].trim()});}}return items;}
  function normalizePortRequirement(value){const type='(?:100\\s*\\/\\s*1000\\s*\\/\\s*2500\\s*(?:Mbps|Base-?T)?(?:自适应)?(?:PoE\\+?\\+?\\s*)?(?:RJ45)?电口|10\\s*\\/\\s*100\\s*\\/\\s*1000\\s*(?:Mbps|Base-?T)?(?:自适应)?(?:PoE\\+?\\+?\\s*)?(?:RJ45)?电口|SFP\\+万兆光口|SFP\\+光口|SFP\\+口|SFP\\s*Plus(?:万兆)?(?:光)?口|SFP千兆光口|SFP光口|SFP口|(?:1G|1GE)电口|(?:1G|1GE)光口|(?:1G|1GE)端口|(?:2\\.5G|2\\.5GE)电口|千兆电口|万兆光口|千兆光口)';return String(value||'').replace(/＋/g,'+').replace(/\b(\d+(?:\.\d+)?)\s*GE\b/gi,'$1G').replace(/(\d+)\s*(?:个|口)?\s*(?:≥|>=|不低于|不少于)\s*([^，,；;。]+?(?:电口|光口|端口))/gi,'至少$1个$2').replace(new RegExp(`(${type})\\s*(?:≥|>=|不少于|不低于|至少)\\s*(\\d+)\\s*(?:个|口)?`,'gi'),(_,portType,count)=>`至少${count}个${portType}`).replace(new RegExp(`(${type})\\s*(\\d+)\\s*(?:个)?\\s*(?:以上|及以上)`,'gi'),(_,portType,count)=>`至少${count}个${portType}`);}
  function parsePortItems(value){const source=normalizePortRequirement(value);return extractPortItems(source,[
    {pattern:/(?:至少|不少于|≥)?\s*(\d+)\s*(?:个|口)?\s*(?:100\s*\/\s*1000\s*\/\s*2500\s*(?:Mbps|Base-?T)?|2\.5G(?:BASE-?T)?)(?:自适应)?(?:PoE\+?\+?\s*)?(?:RJ45)?电口/gi,speed:2.5,medium:'copper'},
    {pattern:/(?:至少|不少于|≥)?\s*(\d+)\s*(?:个|口)?\s*(?:10\s*\/\s*100\s*\/\s*1000\s*(?:Mbps|Base-?T)?|1000BASE-?T|千兆)(?:自适应)?(?:PoE\+?\+?\s*)?(?:RJ45)?电口/gi,speed:1,medium:'copper'},
    {pattern:/(?:至少|不少于|≥)?\s*(\d+)\s*(?:个|口)?\s*(?:(?:10G|万兆)\s*)?(?:SFP\+|SFP\s*Plus)(?:万兆)?(?:光)?口/gi,speed:10,medium:'optical'},
    {pattern:/(?:至少|不少于|≥)?\s*(\d+)\s*(?:个|口)?\s*(?:SFP\s*万兆光口|万兆(?:SFP\+?\s*)?光口)/gi,speed:10,medium:'optical'},
    {pattern:/(?:至少|不少于|≥)?\s*(\d+)\s*(?:个|口)?\s*(?:(?:千兆|1G)\s*)?SFP(?!\+|\s*Plus)(?:千兆)?(?:光)?口/gi,speed:1,medium:'optical'},
    {pattern:/(?:至少|不少于|≥)?\s*(\d+)\s*(?:个|口)?\s*(?:千兆(?:SFP\s*)?光口)/gi,speed:1,medium:'optical'},
    {pattern:/(?:至少|不少于|≥)?\s*(\d+)\s*(?:个|口)?\s*(?:1G)\s*电口/gi,speed:1,medium:'copper'},
    {pattern:/(?:至少|不少于|≥)?\s*(\d+)\s*(?:个|口)?\s*(?:1G)\s*光口/gi,speed:1,medium:'optical'},
    {pattern:/(?:至少|不少于|≥)?\s*(\d+)\s*(?:个|口)?\s*(?:1G)\s*端口/gi,speed:1,medium:''},
    {pattern:/(?:至少|不少于|≥)?\s*(\d+)\s*(?:个|口)?\s*(?:2\.5G电口)/gi,speed:2.5,medium:'copper'},
    {pattern:/(?:至少|不少于|≥)?\s*(\d+)\s*(?:个|口)?\s*(?:千兆电口)/gi,speed:1,medium:'copper'},
    {pattern:/(?:至少|不少于|≥)?\s*(\d+)\s*(?:个|口)?\s*(?:光口)/gi,speed:null,medium:'optical'}
  ]);}
  function productPortItems(product){const source=String(product.description||'').replace(/＋/g,'+');return extractPortItems(source,[
    {pattern:/(\d+)\s*个\s*(?:100\s*\/\s*1000\s*\/\s*2500\s*(?:Mbps|Base-?T)?|2\.5G(?:BASE-?T)?)(?:自适应)?[^，；。+]{0,20}电口/gi,speed:2.5,medium:'copper'},
    {pattern:/(\d+)\s*个\s*(?:WAN\/PoE\s*)?2\.5G[^，；。+]{0,16}(?:电口|上联端口|下联端口)/gi,speed:2.5,medium:'copper'},
    {pattern:/(\d+)\s*个\s*2\.5G\s*(?:WAN\/PoE\s*)?[^，；。+]{0,16}(?:电口|上联端口|下联端口)/gi,speed:2.5,medium:'copper'},
    {pattern:/(\d+)\s*个\s*(?:10\s*\/\s*100\s*\/\s*1000\s*(?:Mbps|Base-?T)?|1000BASE-?T|千兆)(?:自适应)?[^，；。+]{0,20}电口/gi,speed:1,medium:'copper'},
    {pattern:/(\d+)\s*个\s*[^，；。]{0,24}?(?:SFP\+|SFP\s*Plus)(?:万兆)?(?:光)?口/gi,speed:10,medium:'optical'},
    {pattern:/(\d+)\s*个\s*(?:SFP\s*万兆光口|万兆(?:SFP\+?\s*)?光口)/gi,speed:10,medium:'optical'},
    {pattern:/(\d+)\s*个\s*(?:(?:千兆|1G)\s*)?SFP(?!\+|\s*Plus)(?:千兆)?(?:光)?口/gi,speed:1,medium:'optical'},
    {pattern:/(\d+)\s*个\s*(?:千兆(?:SFP\s*)?光口)/gi,speed:1,medium:'optical'},
    {pattern:/(\d+)\s*个[^，；。+]{0,8}2\.5G[^，；。+]{0,8}电口/gi,speed:2.5,medium:'copper'},
    {pattern:/(\d+)\s*个[^，；。+]{0,8}千兆电口/gi,speed:1,medium:'copper'}
  ]);}
  function checkPorts(product,required){if(!required)return null;const needs=parsePortItems(required);if(!needs.length)return checkText(product,required,'端口形态');const actual=productPortItems(product);if(!actual.length)return{status:'review',label:'端口形态',detail:'端口数据无法结构化识别'};const details=[];let failed=false,proximityTotal=0;for(const need of needs){const available=actual.filter(x=>(!need.medium||x.medium===need.medium)&&(!need.speed||(need.speed===1?x.speed===1:x.speed>=need.speed))).reduce((sum,x)=>sum+x.count,0);details.push(`${need.label}：${available}口`);if(available<need.count)failed=true;proximityTotal+=Math.min(need.count,available)/Math.max(need.count,available,1);}return{status:failed?'fail':'pass',label:'端口形态',detail:details.join('；'),proximity:proximityTotal/needs.length};}
  function poeRank(value){return value==='PoE++'?3:value==='PoE+'?2:value==='PoE'?1:0;}
  function checkPoe(product, requirement, budget=0){const checks=[];if(requirement){if(requirement==='none')checks.push(product.poe?{status:'fail',label:'PoE',detail:product.poeGrade}:{status:'pass',label:'PoE',detail:'不支持PoE'});else if(!product.poe)checks.push({status:'fail',label:'PoE',detail:'不支持PoE'});else{const need=requirement==='any'?1:poeRank(requirement), actual=poeRank(product.poeGrade);checks.push(actual>=need?{status:'pass',label:'PoE',detail:product.poeGrade}:{status:'fail',label:'PoE',detail:product.poeGrade});}}if(budget)checks.push(checkMinimum(product.poeBudget,budget,'整机PoE功率'));return checks;}
  function requirements(){return { subtype:refs.subtype.value,keyword:refs.keyword.value.trim(),price:Number(refs.maxPrice.value)||0 };}
  function evaluate(product){const req=requirements(),checks=[];if(req.subtype)checks.push(product.subtype===req.subtype?{status:'pass',label:'产品小类',detail:product.subtype}:{status:'fail',label:'产品小类',detail:product.subtype});if(req.keyword)checks.push(checkText(product,req.keyword,'型号/关键词'));
    if(state.category==='交换机'){if(refs.managed.value)checks.push(product.managed===refs.managed.value?{status:'pass',label:'管理类型',detail:product.managed}:{status:'fail',label:'管理类型',detail:product.managed||'未明确'});if(refs.layer.value)checks.push(product.layer===refs.layer.value?{status:'pass',label:'网络层级',detail:product.layer}:{status:'fail',label:'网络层级',detail:product.layer||'未明确'});const capacityRequired=Number(refs.switchCapacity.value)||0,forwardingRequired=Number(refs.switchForwarding.value)||0;checks.push(checkMinimum(closestAvailable([product.switchingMinGbps,product.switchingMaxGbps],capacityRequired),capacityRequired,'交换容量'));checks.push(checkMinimum(closestAvailable([product.forwardingMinMpps,product.forwardingMaxMpps],forwardingRequired),forwardingRequired,'包转发率'));if(!refs.chassis.checked)checks.push(checkPorts(product,refs.switchPorts.value));checks.push(...checkPoe(product,refs.poeGrade.value,Number(refs.poeBudget.value)||0));if(refs.chassis.checked)checks.push(/框式|模块化/.test(product.subtype)?{status:'pass',label:'设备形态',detail:product.subtype}:{status:'fail',label:'设备形态',detail:product.subtype});checks.push(checkMinimum(product.controllerSlots,Number(refs.controllerSlots.value)||0,'主控槽位'));checks.push(checkMinimum(product.serviceSlots,Number(refs.serviceSlots.value)||0,'业务槽位'));}
    if(state.category==='路由器/网关'){checks.push(checkMinimum(product.recommendedUsers,Number(refs.routerUsers.value)||0,'带机量'));checks.push(checkMinimum(product.recommendedBandwidthGbps,Number(refs.routerBandwidth.value)||0,'推荐带宽'));checks.push(checkMinimum(product.apManagement,Number(refs.routerApCount.value)||0,'AP管理数量'));checks.push(checkText(product,refs.routerPorts.value,'端口形态'));if(refs.routerPoe.checked)checks.push(...checkPoe(product,'any'));}
    if(state.category==='无线AP'){if(refs.wifiGeneration.value)checks.push(product.wifiGeneration===refs.wifiGeneration.value?{status:'pass',label:'无线代际',detail:product.wifiGeneration}:{status:'fail',label:'无线代际',detail:product.wifiGeneration||'未明确'});if(refs.apForm.value)checks.push(product.subtype===refs.apForm.value?{status:'pass',label:'AP形态',detail:product.subtype}:{status:'fail',label:'AP形态',detail:product.subtype});checks.push(checkMinimum(product.wirelessRateGbps,Number(refs.wirelessRate.value)||0,'无线速率'));checks.push(checkMinimum(product.streams,Number(refs.streams.value)||0,'流数'));checks.push(checkMinimum(product.recommendedUsers,Number(refs.wirelessUsers.value)||0,'推荐用户数'));checks.push(checkPorts(product,refs.wirelessPorts.value));if(refs.protection.value)checks.push(product.protection.toUpperCase()===refs.protection.value.toUpperCase()?{status:'pass',label:'防护等级',detail:product.protection}:{status:'fail',label:'防护等级',detail:product.protection||'未明确'});if(refs.wirelessPoe.checked)checks.push(...checkPoe(product,'any'));}
    if(state.category==='安防网络'){checks.push(checkMinimum(Math.max(product.switchingMinGbps??-1,product.switchingMaxGbps??-1),Number(refs.securityCapacity.value)||0,'交换容量'));checks.push(checkMinimum(Math.max(product.forwardingMinMpps??-1,product.forwardingMaxMpps??-1),Number(refs.securityForwarding.value)||0,'包转发率'));checks.push(checkText(product,refs.securityPorts.value,'端口形态'));if(refs.securityPoe.checked)checks.push(...checkPoe(product,'any',Number(refs.securityPoeBudget.value)||0));}
    if(state.category==='配件与模块'&&refs.compatibleModel.value){const model=refs.compatibleModel.value.toUpperCase();checks.push(product.compatibleWith.some(x=>x===model||x==='GENERIC-SFP')?{status:'pass',label:'适配关系',detail:`适配 ${model}`}:{status:'fail',label:'适配关系',detail:'未记录适配关系'});}
    const technical=checks.filter(Boolean),technicalFail=technical.filter(x=>x.status==='fail').length,technicalReview=technical.filter(x=>x.status==='review').length,technicalPass=technical.filter(x=>x.status==='pass').length,technicalCorrectness=technical.length?(technicalPass+technicalReview*.45)/technical.length:.5,proximityChecks=technical.filter(x=>Number.isFinite(x.proximity)),proximity=proximityChecks.length?proximityChecks.reduce((sum,x)=>sum+Math.max(0,Math.min(1,x.proximity)),0)/proximityChecks.length:1,technicalRank=proximityChecks.length?technicalCorrectness*.7+proximity*.3:technicalCorrectness,priceCheck=req.price?checkMinimum(req.price,product.price,'价格上限'):null,relevant=[...technical,priceCheck].filter(Boolean),fail=relevant.filter(x=>x.status==='fail').length,review=relevant.filter(x=>x.status==='review').length,status=fail?'fail':review?'review':'pass',score=Math.round(technicalRank*100);return{product,checks:relevant,status,score,technicalRank};}

  function relatedAccessories(product){if(product.type==='accessory')return[];const model=product.model.toUpperCase();return data.products.filter(p=>p.type==='accessory'&&(p.compatibleWith.includes(model)||(p.compatibleWith.includes('GENERIC-SFP')&&/SFP|光口/i.test(product.ports||product.description)))).slice(0,8);}
  function statusText(s){return s==='pass'?'符合':s==='review'?'待确认':'不符合';}
  function summary(p){const perf=p.switchingMin?`<strong>性能：</strong>${esc(p.switchingMin)}${p.switchingMax?' / '+esc(p.switchingMax):''}；${esc(p.forwardingMin||'—')}${p.forwardingMax?' / '+esc(p.forwardingMax):''}<br>`:'';const wireless=p.category==='无线AP'?`<strong>无线：</strong>${esc(p.wifiGeneration||'—')}；${esc(p.wirelessRateGbps??'—')} Gbps；${esc(p.streams??'—')}流<br>`:'';const router=p.category==='路由器/网关'?`<strong>能力：</strong>带机量 ${esc(p.recommendedUsers??'—')}；带宽 ${esc(p.recommendedBandwidthGbps??'—')}Gbps；AP ${esc(p.apManagement??'—')}<br>`:'';const accessories=relatedAccessories(p);return `<div class="price">¥${p.price.toLocaleString('zh-CN')}</div>${perf}${wireless}${router}<strong>端口/描述：</strong>${esc(p.ports||p.description)}<br><strong>PoE：</strong>${esc(p.poeGrade)}${p.poeBudget?`，整机${p.poeBudget}W`:''}${accessories.length?`<div class="accessories"><strong>适配配件：</strong><br>${accessories.map(a=>`<span class="accessory-chip">${esc(a.model)} · ¥${a.price}</span>`).join('')}</div>`:''}`;}
  function match(){const candidates=data.products.filter(p=>p.category===state.category);state.results=candidates.map(evaluate).sort((a,b)=>statusOrder[a.status]-statusOrder[b.status]||b.technicalRank-a.technicalRank||a.product.price-b.product.price);const groups=new Map();for(const item of state.results){const key=`${item.status}|${item.technicalRank.toFixed(8)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}for(const group of groups.values()){const prices=[...new Set(group.map(x=>x.product.price))].sort((a,b)=>a-b);for(const item of group){const priceRank=prices.indexOf(item.product.price);item.score=Math.max(0,item.score-Math.min(priceRank,5));}}state.visible=10;render();}
  function render(){const counts=state.results.reduce((a,x)=>(a[x.status]++,a),{pass:0,review:0,fail:0});refs.resultCount.textContent=`符合 ${counts.pass} · 待确认 ${counts.review} · 不符合 ${counts.fail}`;refs.emptyState.classList.add('hidden');refs.exportButton.disabled=false;refs.results.innerHTML=state.results.slice(0,state.visible).map(item=>`<article class="result-card ${item.status}"><div class="result-head"><div><div class="model">${esc(item.product.model)}</div><div class="series">${esc(item.product.category)} · ${esc(item.product.subtype)}</div></div><span class="status-chip">${statusText(item.status)}</span><span class="score">匹配度 ${item.score}%</span></div><div class="result-body"><div>${item.checks.length?item.checks.map(c=>`<div class="check ${c.status}"><strong>${esc(c.label)}</strong>：${esc(c.detail)}</div>`).join(''):'<div class="check review">未设置筛选条件，按价格排序展示。</div>'}</div><div class="product-summary">${summary(item.product)}</div></div></article>`).join('');refs.showMoreButton.classList.toggle('hidden',state.visible>=state.results.length);}
  function exportCsv(){const rows=[['状态','匹配度','产品大类','产品小类','型号','指导价','产品描述','来源说明']];for(const x of state.results.filter(x=>x.status!=='fail'))rows.push([statusText(x.status),x.score,x.product.category,x.product.subtype,x.product.model,x.product.price,x.product.description,x.product.sourceNote]);const csv='\uFEFF'+rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`小贝优选匹配结果_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);}
  refs.category.addEventListener('change',()=>{if(refs.category.value!=='auto')showCategory(refs.category.value);});refs.parseButton.addEventListener('click',parseText);refs.matchButton.addEventListener('click',match);refs.exampleButton.addEventListener('click',()=>{refs.tenderText.value='24口千兆三层交换机，至少4个万兆SFP+光口，交换容量不低于672Gbps，包转发率不低于171Mpps，支持PoE+，整机PoE功率不低于350W，预算3000元。';refs.category.value='auto';parseText();});refs.showMoreButton.addEventListener('click',()=>{state.visible+=20;render();});refs.exportButton.addEventListener('click',exportCsv);showCategory('交换机');
})();
