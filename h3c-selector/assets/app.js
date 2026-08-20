(() => {
  'use strict';

  const data = window.H3C_SELECTOR_DATA;
  const el = id => document.getElementById(id);
  const state = { parsedLine: 'switch', results: [], visible: 10 };

  const refs = {
    databaseStatus: el('databaseStatus'), tenderText: el('tenderText'), productLine: el('productLine'),
    parseButton: el('parseButton'), exampleButton: el('exampleButton'), matchButton: el('matchButton'),
    switchCriteria: el('switchCriteria'), wirelessCriteria: el('wirelessCriteria'), recognizedSummary: el('recognizedSummary'),
    results: el('results'), emptyState: el('emptyState'), resultCount: el('resultCount'), exportButton: el('exportButton'),
    showMoreButton: el('showMoreButton'), switchSegment: el('switchSegment'), switchRole: el('switchRole'),
    switchCapacity: el('switchCapacity'), switchForwarding: el('switchForwarding'), switchPorts: el('switchPorts'),
    switchPoeLevel: el('switchPoeLevel'), switchChassis: el('switchChassis'), switchDomestic: el('switchDomestic'), wirelessType: el('wirelessType'),
    controllerSlots: el('controllerSlots'), fabricSlots: el('fabricSlots'), serviceSlots: el('serviceSlots'),
    wifiGeneration: el('wifiGeneration'), apForm: el('apForm'), apStreams: el('apStreams'), apRate: el('apRate'),
    wirelessPorts: el('wirelessPorts'), poeRequired: el('poeRequired'),
  };

  if (!data || !Array.isArray(data.products)) {
    refs.databaseStatus.textContent = '产品数据库加载失败';
    refs.databaseStatus.style.borderColor = '#f0a79d';
    return;
  }
  refs.databaseStatus.textContent = `数据库：${data.stats.switch} 款交换机 · ${data.stats.wireless} 款无线产品`;

  function normalizeText(value) { return String(value || '').replace(/[，；]/g, ',').replace(/\s+/g, ' ').trim(); }
  function numeric(value) {
    const match = String(value || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }
  function capacityGbps(value) {
    const source = String(value || '').replace(/,/g, '');
    const number = numeric(source);
    if (number === null) return null;
    if (/(?:tbps|t)\b/i.test(source)) return number * 1000;
    if (/(?:gbps|g)\b/i.test(source)) return number;
    return null;
  }
  function rateGbps(value) {
    const source = String(value || '').replace(/,/g, '');
    const number = numeric(source);
    if (number === null) return null;
    if (/tbps/i.test(source)) return number * 1000;
    if (/gbps/i.test(source)) return number;
    if (/mbps/i.test(source)) return number / 1000;
    return number;
  }
  function forwardingMpps(value) {
    const source = String(value || '').replace(/,/g, '');
    const number = numeric(source);
    if (number === null) return null;
    if (/bpps/i.test(source)) return number * 1000;
    if (/(?:mpps|m)\b/i.test(source)) return number;
    if (/kpps/i.test(source)) return number / 1000;
    return null;
  }
  function parseThreshold(source, keywords, units) {
    const key = `(?:${keywords.join('|')})`;
    const unit = `(?:${units.join('|')})`;
    const patterns = [
      new RegExp(`${key}[^\\d]{0,18}(\\d+(?:\\.\\d+)?)\\s*(${unit})`, 'i'),
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unit})[^,。；]{0,14}${key}`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match) return { number: Number(match[1]), unit: match[2] };
    }
    return null;
  }
  function inferLine(source) {
    if (/wifi|wi-fi|无线|\bap\b|接入点|射频|流数|ssid|ac控制器/i.test(source)) return 'wireless';
    return 'switch';
  }
  function switchCapacityFromTender(source) {
    const found = parseThreshold(source, ['交换容量', '交换性能'], ['tbps', 'gbps', 't', 'g']);
    if (!found) return '';
    return ['tbps', 't'].includes(found.unit.toLowerCase()) ? found.number * 1000 : found.number;
  }
  function switchForwardingFromTender(source) {
    const found = parseThreshold(source, ['包转发率', '转发性能', '包转发能力'], ['bpps', 'mpps', 'kpps', 'm']);
    if (!found) return '';
    const unit = found.unit.toLowerCase();
    return unit === 'bpps' ? found.number * 1000 : unit === 'kpps' ? found.number / 1000 : found.number;
  }
  function apRateFromTender(source) {
    const found = parseThreshold(source, ['整机速率', '接入速率', '无线速率', '最高速率'], ['tbps', 'gbps', 'mbps']);
    if (!found) return '';
    const unit = found.unit.toLowerCase();
    return unit === 'tbps' ? found.number * 1000 : unit === 'mbps' ? found.number / 1000 : found.number;
  }
  function extractPortPhrase(source) {
    const fragments = source.split(/[，,。；;\n]/).map(item => item.trim()).filter(Boolean);
    const portText = fragments.filter(item => /(?:接口|端口|电口|光口|sfp|qsfp|ge|万兆|千兆|百兆)/i.test(item) && !/(?:交换容量|包转发)/.test(item)).slice(0, 3).join('；');
    return normalizePortRequirement(portText);
  }
  function switchPoeFromTender(source) {
    if (/不(?:需要|要求|支持)\s*poe|无需\s*poe|非\s*poe/i.test(source)) return 'none';
    if (/poe\s*\+\+|802\.3bt|(?:60|90|99)\s*w\s*(?:poe|供电)/i.test(source)) return 'plusplus';
    if (/poe\s*\+(?!\+)|802\.3at|30\s*w\s*(?:poe|供电)/i.test(source)) return 'plus';
    if (/\bpoe\b|802\.3af|15\.4\s*w\s*(?:poe|供电)/i.test(source)) return 'any';
    return '';
  }
  function switchPoeRequirementText(value) {
    return { any: '支持 PoE（任意等级）', plus: '至少 PoE+（802.3at）', plusplus: 'PoE++（802.3bt）', none: '不支持 PoE' }[value] || '';
  }
  function boardCountFromTender(source, type) {
    const keys = type === 'controller' ? ['主控板', '主控引擎', '引擎模块', '主控槽位', '主控'] : type === 'fabric' ? ['交换网板', '交换板', '网板槽位', '网板'] : ['业务板', '接口板', '线卡', '业务槽位'];
    if (type === 'controller' && /双主控/.test(source)) return 2;
    const key = `(?:${keys.join('|')})`;
    const comparator = '(?::|：|=|不少于|至少|≥|不低于|为|配置)?';
    const patterns = [
      new RegExp(`${key}(?:数量|数|槽位数量|槽位数|槽位)?\\s*${comparator}\\s*(\\d+)\\s*(?:块|个|槽位)`, 'i'),
      new RegExp(`${key}(?:数量|数|槽位数量|槽位数|槽位)\\s*${comparator}\\s*(\\d+)`, 'i'),
      new RegExp(`${comparator}\\s*(\\d+)\\s*(?:块|个|槽位)\\s*${key}`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match) return Number(match[1]);
    }
    return '';
  }
  function parseTender() {
    const source = normalizeText(refs.tenderText.value);
    const selected = refs.productLine.value;
    state.parsedLine = selected === 'auto' ? inferLine(source) : selected;
    showCriteria(state.parsedLine);
    const recognized = [];
    if (state.parsedLine === 'switch') {
      refs.switchCapacity.value = switchCapacityFromTender(source);
      refs.switchForwarding.value = switchForwardingFromTender(source);
      refs.controllerSlots.value = boardCountFromTender(source, 'controller');
      refs.fabricSlots.value = boardCountFromTender(source, 'fabric');
      refs.serviceSlots.value = boardCountFromTender(source, 'service');
      refs.switchPoeLevel.value = switchPoeFromTender(source);
      refs.switchChassis.checked = /框式|机框式|模块化机箱/i.test(source) || Boolean(refs.controllerSlots.value || refs.fabricSlots.value || refs.serviceSlots.value);
      refs.switchPorts.value = refs.switchChassis.checked ? '' : extractPortPhrase(source);
      syncChassisMode();
      refs.switchDomestic.checked = /国产化|国产芯片|自主可控|信创/i.test(source);
      const role = ['低时延', '核心', '汇聚', '接入', '工业', '全光'].find(word => source.includes(word));
      refs.switchRole.value = role || '';
      if (/数据中心/.test(source)) refs.switchSegment.value = '数据中心交换机';
      else if (/园区/.test(source)) refs.switchSegment.value = '园区网交换机';
      else if (/全光|影终端/.test(source)) refs.switchSegment.value = '以太全光影终端';
      recognized.push('产品线：交换机');
      if (refs.switchCapacity.value) recognized.push(`交换容量 ≥ ${refs.switchCapacity.value} Gbps`);
      if (refs.switchForwarding.value) recognized.push(`包转发率 ≥ ${refs.switchForwarding.value} Mpps`);
      if (refs.switchPorts.value) recognized.push(`端口：${refs.switchPorts.value}`);
      if (refs.switchPoeLevel.value) recognized.push(`PoE：${switchPoeRequirementText(refs.switchPoeLevel.value)}`);
      if (refs.switchRole.value) recognized.push(`定位：${refs.switchRole.value}`);
      if (refs.switchChassis.checked) recognized.push('框式交换机');
      if (refs.controllerSlots.value) recognized.push(`主控板 ≥ ${refs.controllerSlots.value}`);
      if (refs.fabricSlots.value) recognized.push(`交换网板 ≥ ${refs.fabricSlots.value}`);
      if (refs.serviceSlots.value) recognized.push(`业务板 ≥ ${refs.serviceSlots.value}`);
      if (refs.switchDomestic.checked) recognized.push('国产化');
    } else {
      if (/控制器|\bac\b/i.test(source) && !/\bap\b/i.test(source)) refs.wirelessType.value = 'AC控制器';
      else refs.wirelessType.value = 'AP';
      refs.wifiGeneration.value = /wifi\s*7|wi-fi\s*7|802\.11be/i.test(source) ? 'Wi-Fi 7' : /wifi\s*6|wi-fi\s*6|802\.11ax/i.test(source) ? 'Wi-Fi 6' : '';
      refs.apForm.value = ['高密', '面板', '室外', '工业', '放装', '分体', '本体'].find(word => source.includes(word)) || '';
      const streams = source.match(/(?:不少于|至少|≥|支持)?\s*(\d+)\s*(?:条)?流/i);
      refs.apStreams.value = streams ? streams[1] : '';
      refs.apRate.value = apRateFromTender(source);
      refs.wirelessPorts.value = extractPortPhrase(source);
      refs.poeRequired.checked = /poe/i.test(source);
      recognized.push(`产品线：无线${refs.wirelessType.value ? ` / ${refs.wirelessType.value}` : ''}`);
      if (refs.wifiGeneration.value) recognized.push(refs.wifiGeneration.value);
      if (refs.apForm.value) recognized.push(`形态：${refs.apForm.value}`);
      if (refs.apStreams.value) recognized.push(`总流数 ≥ ${refs.apStreams.value}`);
      if (refs.apRate.value) recognized.push(`整机速率 ≥ ${refs.apRate.value} Gbps`);
      if (refs.wirelessPorts.value) recognized.push(`端口：${refs.wirelessPorts.value}`);
      if (refs.poeRequired.checked) recognized.push('PoE供电');
    }
    refs.recognizedSummary.textContent = recognized.length > 1 ? `已识别：${recognized.join('；')}` : '没有识别出明确的数值条件，请手动补充后开始匹配。';
  }

  function showCriteria(line) {
    refs.switchCriteria.classList.toggle('hidden', line !== 'switch');
    refs.wirelessCriteria.classList.toggle('hidden', line !== 'wireless');
  }

  function syncChassisMode() {
    const chassisMode = refs.switchChassis.checked || refs.switchSegment.value === '框式交换机' || Boolean(refs.controllerSlots.value || refs.fabricSlots.value || refs.serviceSlots.value);
    refs.switchPorts.disabled = chassisMode;
    refs.switchPorts.placeholder = chassisMode ? '框式交换机不参与端口匹配' : '如：48个千兆电口、4个万兆光口';
    if (chassisMode) refs.switchPorts.value = '';
  }

  function requirementTokens(value) {
    return String(value || '').toLowerCase().split(/[，,、；;\s]+/).map(x => x.trim()).filter(x => x.length > 1);
  }
  function portSpeedGbps(source) {
    const value = String(source || '').toLowerCase();
    if (/400\s*g|400ge|qsfp-dd/.test(value)) return 400;
    if (/200\s*g|200ge/.test(value)) return 200;
    if (/100\s*g|100ge|qsfp28/.test(value)) return 100;
    if (/40\s*g|40ge|qsfp\+/.test(value)) return 40;
    if (/25\s*g|25ge|sfp28/.test(value)) return 25;
    if (/10\s*g|10ge|万兆|sfp\+/.test(value)) return 10;
    if (/5\s*g|5ge/.test(value)) return 5;
    if (/2\.5\s*g|2\.5ge/.test(value)) return 2.5;
    if (/1000\s*base|1\s*g(?:e)?\b|\bge\b|千兆|\bsfp\b/.test(value)) return 1;
    if (/100\s*base|百兆/.test(value)) return 0.1;
    return null;
  }
  function portMedium(source) {
    const value = String(source || '').toLowerCase();
    if (/光电|combo/.test(value)) return 'both';
    if (/base-t|rj45|电口/.test(value)) return 'copper';
    if (/sfp|qsfp|光口/.test(value)) return 'optical';
    return '';
  }
  function highestPortSpeedLabel(source) {
    const speeds = String(source || '').match(/(?:400|200|100|40|25|10|5|2\.5|1)\s*G(?:E)?/gi) || [];
    if (!speeds.length) return source;
    const highest = Math.max(...speeds.map(value => Number.parseFloat(value)));
    return `${highest}G`;
  }
  function normalizePortRequirement(value) {
    const type = '(?:100\\s*\\/\\s*1000\\s*\\/\\s*2500\\s*(?:Mbps|Base-?T)?(?:自适应)?电口|10\\s*\\/\\s*100\\s*\\/\\s*1000\\s*(?:Mbps|Base-?T)?(?:自适应)?电口|SFP\\+万兆光口|SFP\\+光口|SFP\\+口|SFP\\s*Plus(?:万兆)?(?:光)?口|SFP千兆光口|SFP光口|SFP口|(?:1G|1GE)电口|(?:1G|1GE)光口|(?:1G|1GE)端口|2\\.5G电口|千兆电口|万兆光口|千兆光口)';
    return String(value || '')
      .replace(/＋/g, '+')
      .replace(/\b1\s*GE\b/gi, '1G')
      .replace(/((?:(?:400|200|100|40|25|10|5|2\.5|1)\s*G(?:E)?\s*[\/／]\s*)+(?:400|200|100|40|25|10|5|2\.5|1)\s*G(?:E)?)\s*(?:接口|端口)(?:数量|数)?\s*(?:≥|>=|不少于|不低于|至少)\s*(\d+)\s*(?:个|口)?/gi, (_, speedGroup, count) => `至少${count}个${highestPortSpeedLabel(speedGroup)}端口`)
      .replace(/100\s*\/\s*1000\s*\/\s*2500\s*(?:Mbps|Base-?T)?(?:自适应)?电口/gi, '2.5G电口')
      .replace(/10\s*\/\s*100\s*\/\s*1000\s*(?:Mbps|Base-?T)?(?:自适应)?电口/gi, '千兆电口')
      .replace(new RegExp(`(${type})\\s*(?:≥|>=|不少于|不低于|至少)\\s*(\\d+)\\s*(?:个|口)?`, 'gi'), (_, portType, count) => `至少${count}个${portType}`)
      .replace(new RegExp(`(${type})\\s*(\\d+)\\s*(?:个)?\\s*(?:以上|及以上)`, 'gi'), (_, portType, count) => `至少${count}个${portType}`);
  }
  function parsePortRequirements(value) {
    const source = normalizePortRequirement(value);
    const output = [];
    const connector = '(?:QSFP(?:-DD|DD|56|28|\\+)?|SFP(?:28|56|\\+)?|RJ45|BASE-T)';
    const speed = '(?:400G|200G|100G|40G|25G|10G|5G|2\\.5G|1GE?|万兆|千兆|百兆)';
    const patterns = [
      new RegExp(`(\\d+)\\s*(?:个|口)?\\s*(${speed})?\\s*(${connector})?\\s*(电口|光口|端口)`, 'gi'),
      new RegExp(`(\\d+)\\s*(?:个|口)?\\s*(${speed})?\\s*(${connector})`, 'gi'),
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const label = match[0].trim();
        if (output.some(item => item.index === match.index && item.label.length >= label.length)) continue;
        output.push({
          index: match.index,
          count: Number(match[1]),
          speed: portSpeedGbps(`${match[2] || ''} ${match[3] || ''}`),
          medium: portMedium(`${match[3] || ''} ${match[4] || ''}`),
          connector: String(match[3] || '').toLowerCase(),
          label,
        });
      }
    }
    const implicitPattern = /(?:至少|不少于|不低于|≥|支持)?\s*(400G|200G|100G|40G|25G|10G|5G|2\.5G|1G|400GE|200GE|100GE|40GE|25GE|10GE|5GE|2\.5GE|1GE|万兆|千兆)\s*(QSFP(?:-DD|DD|56|28|\+)?|SFP(?:28|56|\+)?|RJ45|BASE-T)?\s*(?:端口|上联)?/gi;
    let implicit;
    while ((implicit = implicitPattern.exec(source)) !== null) {
      if (output.some(item => implicit.index >= item.index && implicit.index < item.index + item.label.length)) continue;
      output.push({
        index: implicit.index,
        count: 1,
        speed: portSpeedGbps(`${implicit[1] || ''} ${implicit[2] || ''}`),
        medium: portMedium(implicit[2] || ''),
        connector: String(implicit[2] || '').toLowerCase(),
        label: implicit[0].trim(),
      });
    }
    return output.sort((a, b) => a.index - b.index).filter((item, index, all) => !all.some((other, otherIndex) => otherIndex !== index && other.index === item.index && other.label.length > item.label.length));
  }
  function splitProductPortSegments(value) {
    const protectedText = String(value || '')
      .replace(/PoE\+\+/gi, 'POEPLUSPLUS')
      .replace(/PoE\+/gi, 'POEPLUS')
      .replace(/QSFP\+/gi, 'QSFPPLUS')
      .replace(/SFP\+/gi, 'SFPPLUS')
      .replace(/＋/g, '+');
    const segments = [];
    let current = '';
    let depth = 0;
    for (const char of protectedText) {
      if (/[（(\[【]/.test(char)) depth += 1;
      if (depth === 0 && /[，,；;+]/.test(char)) {
        if (current.trim()) segments.push(current.trim());
        current = '';
        continue;
      }
      current += char;
      if (/[）)\]】]/.test(char)) depth = Math.max(0, depth - 1);
    }
    if (current.trim()) segments.push(current.trim());
    return segments.map(segment => segment
      .replace(/POEPLUSPLUS/gi, 'PoE++')
      .replace(/POEPLUS/gi, 'PoE+')
      .replace(/QSFPPLUS/gi, 'QSFP+')
      .replace(/SFPPLUS/gi, 'SFP+'));
  }
  function parseProductPorts(value) {
    const segments = splitProductPortSegments(value);
    const output = [];
    for (const segment of segments) {
      const countMatch = segment.match(/^\s*(\d+)\s*(?:个|口|[×xX*])/i);
      const speedOnly = !countMatch && portSpeedGbps(segment) !== null;
      if (!countMatch && !speedOnly) continue;
      const count = countMatch ? Number(countMatch[1]) : 1;
      const speed = portSpeedGbps(segment);
      const medium = portMedium(segment);
      if (!count || speed === null) continue;
      output.push({ count, speed, medium, text: segment.toLowerCase() });
    }
    return output;
  }
  function matchPorts(product, requirement) {
    const requiredPorts = parsePortRequirements(requirement);
    if (!requiredPorts.length) return matchText(product, requirement, '端口形态');
    const actualPorts = parseProductPorts(product.ports);
    if (!actualPorts.length) return { status: 'review', label: '端口形态', detail: '产品端口数据无法结构化识别' };
    const details = [];
    let failed = false;
    let uncertain = false;
    for (const required of requiredPorts) {
      const candidates = actualPorts.filter(actual => {
        if (required.medium && actual.medium && actual.medium !== 'both' && actual.medium !== required.medium) return false;
        if (required.speed !== null && (required.speed === 1 ? actual.speed !== 1 : actual.speed < required.speed)) return false;
        if (required.connector.includes('sfp+') && !actual.text.includes('sfp+')) return false;
        if (required.connector.includes('sfp28') && !actual.text.includes('sfp28')) return false;
        if (required.connector.includes('qsfp') && !actual.text.includes('qsfp')) return false;
        return true;
      });
      const available = candidates.reduce((sum, item) => sum + item.count, 0);
      if (available >= required.count) details.push(`${required.label}：可用${available}口`);
      else if (actualPorts.length) { failed = true; details.push(`${required.label}：仅识别到${available}口`); }
      else { uncertain = true; details.push(`${required.label}：待确认`); }
    }
    const proximity = requiredPorts.length ? requiredPorts.reduce((sum, required) => {
      const available = actualPorts.filter(actual => {
        if (required.medium && actual.medium && actual.medium !== 'both' && actual.medium !== required.medium) return false;
        if (required.speed !== null && (required.speed === 1 ? actual.speed !== 1 : actual.speed < required.speed)) return false;
        if (required.connector.includes('sfp+') && !actual.text.includes('sfp+')) return false;
        if (required.connector.includes('sfp28') && !actual.text.includes('sfp28')) return false;
        if (required.connector.includes('qsfp') && !actual.text.includes('qsfp')) return false;
        return true;
      }).reduce((sum, item) => sum + item.count, 0);
      return sum + Math.min(required.count, available) / Math.max(required.count, available, 1);
    }, 0) / requiredPorts.length : 1;
    return { status: failed ? 'fail' : uncertain ? 'review' : 'pass', label: '端口形态', detail: details.join('；'), proximity };
  }
  function matchText(product, requirement, label) {
    const tokens = requirementTokens(requirement);
    if (!tokens.length) return null;
    const haystack = product.searchText || '';
    const missing = tokens.filter(token => !haystack.includes(token));
    return missing.length ? { status: 'review', label, detail: `未直接检出：${missing.join('、')}` } : { status: 'pass', label, detail: '关键词已匹配' };
  }
  function compareMinimum(actualValues, required, converter, label) {
    if (!required) return null;
    const known = actualValues.map(converter).filter(value => value !== null && Number.isFinite(value));
    if (!known.length) return { status: 'review', label, detail: '产品数据未明确' };
    const sufficient = known.filter(value => value >= required);
    const best = sufficient.length ? Math.min(...sufficient) : Math.max(...known);
    return best >= required
      ? { status: 'pass', label, detail: `${best.toLocaleString()} ≥ ${Number(required).toLocaleString()}`, proximity: required / best }
      : { status: 'fail', label, detail: `${best.toLocaleString()} < ${Number(required).toLocaleString()}`, proximity: best / required };
  }
  function switchRequirements() {
    const controllerSlots = Number(refs.controllerSlots.value) || 0;
    const fabricSlots = Number(refs.fabricSlots.value) || 0;
    const serviceSlots = Number(refs.serviceSlots.value) || 0;
    return {
      segment: refs.switchSegment.value, role: refs.switchRole.value.trim(), capacity: Number(refs.switchCapacity.value) || 0,
      forwarding: Number(refs.switchForwarding.value) || 0, ports: refs.switchPorts.value.trim(),
      poe: refs.switchPoeLevel.value,
      chassis: refs.switchChassis.checked || refs.switchSegment.value === '框式交换机' || Boolean(controllerSlots || fabricSlots || serviceSlots),
      controllerSlots, fabricSlots, serviceSlots, domestic: refs.switchDomestic.checked,
    };
  }
  function wirelessRequirements() {
    return {
      type: refs.wirelessType.value, generation: refs.wifiGeneration.value, form: refs.apForm.value.trim(),
      streams: Number(refs.apStreams.value) || 0, rate: Number(refs.apRate.value) || 0,
      ports: refs.wirelessPorts.value.trim(), poe: refs.poeRequired.checked,
    };
  }
  function evaluateSwitch(product, req) {
    const checks = [];
    if (req.segment) checks.push(product.segment === req.segment || (req.segment === '框式交换机' && isChassis(product)) ? { status: 'pass', label: '产品分类', detail: product.segment } : { status: 'fail', label: '产品分类', detail: product.segment });
    if (req.role) checks.push(product.searchText.includes(req.role.toLowerCase()) ? { status: 'pass', label: '产品定位', detail: req.role } : { status: 'fail', label: '产品定位', detail: `未检出“${req.role}”` });
    if (req.capacity) checks.push(compareMinimum([product.switchingMax, product.switchingMin], req.capacity, capacityGbps, '交换容量'));
    if (req.forwarding) checks.push(compareMinimum([product.forwardingMax, product.forwardingMin], req.forwarding, forwardingMpps, '包转发率'));
    if (req.ports && !req.chassis) checks.push(matchPorts(product, req.ports));
    if (req.poe) checks.push(matchSwitchPoe(product, req.poe));
    if (req.chassis) checks.push(isChassis(product) ? { status: 'pass', label: '框式设备', detail: '具备框式硬件信息' } : { status: 'fail', label: '框式设备', detail: '未检出框式硬件信息' });
    if (req.controllerSlots) checks.push(compareSlotCount(product.controllerSlots, req.controllerSlots, '主控板数量'));
    if (req.fabricSlots) checks.push(compareSlotCount(product.fabricSlots, req.fabricSlots, '交换网板数量'));
    if (req.serviceSlots) checks.push(compareSlotCount(product.serviceSlots, req.serviceSlots, '业务板数量'));
    if (req.domestic) checks.push(product.domestic ? { status: 'pass', label: '国产化', detail: '已列入国产化型号表' } : { status: 'fail', label: '国产化', detail: '未列入国产化型号表' });
    const result = finalize(product, checks);
    if (isWeakCurrentSwitch(product)) {
      result.score = 0;
      result.lowPriority = true;
      result.checks.push({ status: 'review', label: '推荐优先级', detail: 'RS系列为弱电款型，日常项目不常用，已降至最低优先级' });
    }
    return result;
  }
  function compareSlotCount(actual, required, label) {
    if (!required) return null;
    if (actual === null || actual === undefined || actual === '') return { status: 'review', label, detail: '产品槽位数量未明确' };
    const count = Number(actual);
    return count >= required
      ? { status: 'pass', label, detail: `${count} ≥ ${required}`, proximity: required / count }
      : { status: 'fail', label, detail: `${count} < ${required}`, proximity: count / required };
  }
  function switchPoeProfile(value) {
    const source = String(value || '').trim();
    if (!source || /待确认/.test(source) && !/^支持/.test(source)) return { supported: null, rank: null, detail: source || '未记录' };
    if (/不支持|不适用/.test(source)) return { supported: false, rank: 0, detail: source };
    if (!/^支持/.test(source)) return { supported: null, rank: null, detail: source };
    if (/等级待官网确认/.test(source)) return { supported: true, rank: null, detail: source };
    if (/PoE\+\+|802\.3bt/i.test(source)) return { supported: true, rank: 3, detail: source };
    if (/PoE\+|802\.3at/i.test(source)) return { supported: true, rank: 2, detail: source };
    if (/\bPoE\b|802\.3af/i.test(source)) return { supported: true, rank: 1, detail: source };
    return { supported: true, rank: null, detail: source };
  }
  function matchSwitchPoe(product, requirement) {
    const actual = switchPoeProfile(product.poeLevel);
    const label = 'PoE支持/等级';
    if (requirement === 'none') {
      if (actual.supported === false) return { status: 'pass', label, detail: actual.detail };
      if (actual.supported === true) return { status: 'fail', label, detail: actual.detail };
      return { status: 'review', label, detail: actual.detail };
    }
    if (actual.supported === false) return { status: 'fail', label, detail: actual.detail };
    if (actual.supported === null) return { status: 'review', label, detail: actual.detail };
    if (requirement === 'any') return { status: 'pass', label, detail: actual.detail };
    const requiredRank = requirement === 'plusplus' ? 3 : 2;
    if (actual.rank === null) return { status: 'review', label, detail: `${actual.detail}；支持供电但等级需复核` };
    return actual.rank >= requiredRank
      ? { status: 'pass', label, detail: actual.detail }
      : { status: 'fail', label, detail: `${actual.detail}；低于${switchPoeRequirementText(requirement)}` };
  }
  function isChassis(product) { return Boolean(product.controller || product.fabric || product.serviceBoard || product.architecture); }
  function isWeakCurrentSwitch(product) {
    return [product.series, product.model].some(value => /^RS(?:\d|[-\s])/i.test(String(value || '').trim()));
  }
  function evaluateWireless(product, req) {
    const checks = [];
    if (req.type) checks.push(product.type === req.type ? { status: 'pass', label: '设备类型', detail: product.type } : { status: 'fail', label: '设备类型', detail: product.type });
    if (req.generation) checks.push(product.generation === req.generation ? { status: 'pass', label: '无线代际', detail: product.generation } : product.generation ? { status: 'fail', label: '无线代际', detail: product.generation } : { status: 'review', label: '无线代际', detail: '未明确' });
    if (req.form) checks.push(product.searchText.includes(req.form.toLowerCase()) ? { status: 'pass', label: 'AP形态', detail: product.form } : { status: 'fail', label: 'AP形态', detail: product.form || '未明确' });
    if (req.streams) checks.push(compareMinimum([product.streams, product.streamText], req.streams, numeric, '总流数'));
    if (req.rate) checks.push(compareMinimum([product.maxRate], req.rate, rateGbps, '整机速率'));
    if (req.ports) checks.push(matchPorts(product, req.ports));
    if (req.poe) checks.push(/poe/i.test(`${product.poe} ${product.searchText}`) ? { status: 'pass', label: 'PoE供电', detail: product.poe || '产品参数中已检出PoE' } : product.poe ? { status: 'fail', label: 'PoE供电', detail: product.poe } : { status: 'review', label: 'PoE供电', detail: '未明确' });
    return finalize(product, checks);
  }
  function finalize(product, checks) {
    const relevant = checks.filter(Boolean);
    if (!relevant.length) return { product, checks: [], status: 'review', score: 0, fail: 0, review: 1, pass: 0 };
    const fail = relevant.filter(x => x.status === 'fail').length;
    const review = relevant.filter(x => x.status === 'review').length;
    const pass = relevant.filter(x => x.status === 'pass').length;
    const status = fail ? 'fail' : review ? 'review' : 'pass';
    const correctness = relevant.length ? (pass + review * .45) / relevant.length : .5;
    const proximityChecks = relevant.filter(x => Number.isFinite(x.proximity));
    const proximity = proximityChecks.length ? proximityChecks.reduce((sum, x) => sum + Math.max(0, Math.min(1, x.proximity)), 0) / proximityChecks.length : 1;
    const score = Math.round((proximityChecks.length ? correctness * .7 + proximity * .3 : correctness) * 100);
    return { product, checks: relevant, status, score, fail, review, pass };
  }
  function matchProducts() {
    const line = state.parsedLine || (refs.productLine.value === 'wireless' ? 'wireless' : 'switch');
    const products = data.products.filter(product => product.line === (line === 'wireless' ? '无线' : '交换机'));
    const req = line === 'wireless' ? wirelessRequirements() : switchRequirements();
    state.results = products.map(product => line === 'wireless' ? evaluateWireless(product, req) : evaluateSwitch(product, req));
    state.results.sort((a, b) => {
      const order = { pass: 0, review: 1, fail: 2 };
      return Number(Boolean(a.lowPriority)) - Number(Boolean(b.lowPriority)) || order[a.status] - order[b.status] || b.score - a.score || a.product.model.localeCompare(b.product.model, 'zh-CN', { numeric: true });
    });
    state.visible = 10;
    renderResults();
  }
  function escapeHtml(value) { return String(value || '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]); }
  function statusText(status) { return status === 'pass' ? '符合' : status === 'review' ? '待确认' : '不符合'; }
  function tenderGuideLink(product) {
    const guideByModel = {
      'S12504G-AF': 's12500g-af', 'S12508G-AF': 's12500g-af', 'S12516G-AF': 's12500g-af',
      'S6800-2C': 's6800', 'S6800-32Q': 's6800', 'S6800-4C': 's6800', 'S6800-54HF': 's6800', 'S6800-54HT': 's6800', 'S6800-54QF': 's6800', 'S6800-54QT': 's6800',
      'S6805-54HF': 's6805', 'S6805-54HT': 's6805',
      'S6825-54HF': 's6825',
      'S6850-2C': 's6850', 'S6850-56HF': 's6850', 'S6850-56HF-H1': 's6850', 'S6850-56HF-H3': 's6850', 'S6850-56HF-CP': 's6850', 'S6850-56HF-IM': 's6850',
      'S6805-56HF-G': 's6850-g', 'S6805-56HT-G': 's6850-g', 'S6850-56HF-G': 's6850-g',
      'S7503X-G': 's7500x-g', 'S7503X-M-G': 's7500x-g', 'S7506X-G': 's7500x-g', 'S7506X-G-MF': 's7500x-g', 'S7510X-G': 's7500x-g',
    };
    const model = String(product.model || '').trim();
    const guideSlug = guideByModel[model];
    if (!guideSlug) return '';
    return `<a class="tender-guide-link" href="guides/${guideSlug}/index.html" aria-label="查看 ${escapeHtml(model)} 招标引导">招标引导</a>`;
  }
  function productSummary(product) {
    if (product.line === '交换机') {
      const slots = isChassis(product) ? `<br><strong>板卡槽位：</strong>主控 ${escapeHtml(product.controllerSlots ?? '未明确')} / 网板 ${escapeHtml(product.fabricSlots ?? '未明确')} / 业务板 ${escapeHtml(product.serviceSlots ?? '未明确')}` : '';
      const portText = isChassis(product) ? '按业务板配置（不参与框式匹配）' : (product.ports || '未记录');
      return `<strong>性能：</strong>${escapeHtml(product.switchingMin || '—')} / ${escapeHtml(product.switchingMax || '—')}；${escapeHtml(product.forwardingMin || '—')} / ${escapeHtml(product.forwardingMax || '—')}<br><strong>端口：</strong>${escapeHtml(portText)}<br><strong>PoE：</strong>${escapeHtml(product.poeLevel || '未记录')}${slots}<br><strong>架构：</strong>${escapeHtml(product.architecture || '未记录')}`;
    }
    const rate = product.maxRate || '未记录';
    return `<strong>形态：</strong>${escapeHtml(product.form || '未记录')}；<strong>代际：</strong>${escapeHtml(product.generation || '未记录')}<br><strong>流数/速率：</strong>${escapeHtml(product.streams || product.streamText || '未记录')} / ${escapeHtml(rate)}<br><strong>端口：</strong>${escapeHtml(product.ports || '未记录')}`;
  }
  function renderResults() {
    const counts = state.results.reduce((acc, item) => { acc[item.status]++; return acc; }, { pass: 0, review: 0, fail: 0 });
    refs.resultCount.textContent = `符合 ${counts.pass} · 待确认 ${counts.review} · 不符合 ${counts.fail}`;
    refs.emptyState.classList.add('hidden');
    refs.exportButton.disabled = false;
    refs.results.innerHTML = state.results.slice(0, state.visible).map(item => {
      const p = item.product;
      const checks = item.checks.length ? item.checks.map(check => `<div class="check ${check.status}"><strong>${escapeHtml(check.label)}</strong>：${escapeHtml(check.detail)}</div>`).join('') : '<div class="check review">未设置筛选条件，请补充参数。</div>';
      const link = p.url ? `<a class="official-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">查看官网参数</a>` : '';
      return `<article class="result-card ${item.status}"><div class="result-head"><div><div class="model-row"><div class="model">${escapeHtml(p.model)}</div>${tenderGuideLink(p)}</div><div class="series">${escapeHtml(p.segment)} · ${escapeHtml(p.series || p.form || p.type)}</div></div><span class="status-chip">${statusText(item.status)}</span><span class="score">匹配度 ${item.score}%</span></div><div class="result-body"><div class="checks">${checks}</div><div class="product-summary">${productSummary(p)}${link}</div></div></article>`;
    }).join('');
    refs.showMoreButton.classList.toggle('hidden', state.visible >= state.results.length);
  }
  function exportCsv() {
    const rows = [['状态', '匹配度', '产品线', '分类', '产品系列/形态', '产品型号', 'PoE支持/等级', '主控板数量', '交换网板数量', '业务板数量', '判断明细', '官网链接']];
    for (const item of state.results.filter(item => item.status !== 'fail').slice(0, 100)) {
      const p = item.product;
      rows.push([statusText(item.status), item.score, p.line, p.segment, p.series || p.form || p.type, p.model, p.poeLevel || p.poe || '', p.controllerSlots ?? '', p.fabricSlots ?? '', p.serviceSlots ?? '', item.checks.map(x => `${x.label}:${x.detail}`).join('；'), p.url || '']);
    }
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `新华三选型匹配结果_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  refs.parseButton.addEventListener('click', parseTender);
  refs.matchButton.addEventListener('click', matchProducts);
  refs.productLine.addEventListener('change', () => {
    if (refs.productLine.value !== 'auto') {
      state.parsedLine = refs.productLine.value;
      showCriteria(state.parsedLine);
    }
  });
  refs.switchChassis.addEventListener('change', syncChassisMode);
  refs.switchSegment.addEventListener('change', syncChassisMode);
  refs.controllerSlots.addEventListener('input', syncChassisMode);
  refs.fabricSlots.addEventListener('input', syncChassisMode);
  refs.serviceSlots.addEventListener('input', syncChassisMode);
  refs.exampleButton.addEventListener('click', () => {
    refs.tenderText.value = '园区接入交换机，要求不少于48个千兆电口和4个万兆SFP+光口，交换容量不低于672Gbps，包转发率不低于126Mpps，支持PoE+供电。';
    refs.productLine.value = 'auto';
    parseTender();
  });
  refs.showMoreButton.addEventListener('click', () => { state.visible += 20; renderResults(); });
  refs.exportButton.addEventListener('click', exportCsv);
})();
