const IMMEDIATE_MARKERS = [
    /正在/,
    /现在/,
    /此刻/,
    /眼下/,
    /刚刚/,
    /刚才/,
    /当前/,
    /已经.{0,8}(?:窒息|溺水|落水|着火|起火|失踪|走丢|不见|严重出血|血流不止|吞)/
];

const HYPOTHETICAL_MARKERS = [
    /如何预防/,
    /怎么预防/,
    /怎样预防/,
    /如何避免/,
    /怎么避免/,
    /怎样避免/,
    /怎么教育/,
    /安全教育/,
    /演练/,
    /假如/,
    /假设/,
    /如果/,
    /万一/,
    /曾经/,
    /以前/,
    /去年/
];

const EVENT_RULES = [
    {
        kind: 'medical',
        pattern: /(?:窒息|噎住|卡住|喘不过气|不能呼吸|呼吸不了|溺水|落水|掉进水里|严重出血|血流不止|大量出血|严重受伤|严重坠落|从高处摔下|被车撞|吞(?:下|了).{0,8}(?:纽扣电池|电池|药|药品|化学品|清洁剂))/
    },
    {
        kind: 'fire',
        pattern: /(?:火灾|着火|起火|失火|浓烟)/
    },
    {
        kind: 'police',
        pattern: /(?:儿童|孩子|小孩).{0,8}(?:失踪|走丢|不见了|找不到)|(?:失踪|走丢).{0,8}(?:儿童|孩子|小孩)|(?:正在|现在|当前).{0,10}(?:被打|遭受严重伤害|遭受严重暴力|被严重伤害)/
    }
];

const RESPONSES = {
    medical: {
        phoneNumbers: ['120'],
        content: '这是正在发生的紧急情况。请立即拨打中国大陆医疗急救电话 120。本助手不提供现场急救或救援操作，请不要等待进一步分析。'
    },
    fire: {
        phoneNumbers: ['119', '110'],
        content: '这是正在发生的火灾紧急情况。请立即拨打中国大陆火警电话 119；如有人身安全威胁，同时拨打 110。本助手不提供现场救援操作，请不要等待进一步分析。'
    },
    police: {
        phoneNumbers: ['110', '120'],
        content: '这是正在发生的人身安全紧急情况。请立即拨打中国大陆报警电话 110；如有人受伤，同时拨打 120。本助手不提供现场救援操作，请不要等待进一步分析。'
    }
};

function normalizeText(input) {
    return typeof input === 'string'
        ? input.replace(/\s+/g, '').replace(/[，。！？、,.!?]/g, '')
        : '';
}

function hasImmediateContext(text) {
    return IMMEDIATE_MARKERS.some((pattern) => pattern.test(text));
}

function isOnlyHypothetical(text) {
    return HYPOTHETICAL_MARKERS.some((pattern) => pattern.test(text)) && !hasImmediateContext(text);
}

function detectP0(input) {
    const text = normalizeText(input);
    if (!text || isOnlyHypothetical(text) || !hasImmediateContext(text)) {
        return null;
    }

    const matchedRule = EVENT_RULES.find((rule) => rule.pattern.test(text));
    if (!matchedRule) {
        return null;
    }

    return {
        kind: matchedRule.kind,
        local: true,
        ...RESPONSES[matchedRule.kind]
    };
}

module.exports = {
    detectP0,
    normalizeText
};
