/* ==========================================================================
 * rules.js — 规则引擎
 *   月龄段 AGE_BANDS | 能力维度 SKILLS | 玩具类型 TOY_TYPES | 专注 FOCUS
 *   computeAge / skillInterpretation / generateTodayPlan / analyzeLogs
 * 依据来源参考 docs/References-育儿依据.md（refId: AAP/CDC/WHO/MONT/PIAGET/PLAY）
 * ========================================================================== */
(function (root) {
  'use strict';

  /* ---------- 月龄段（覆盖 0-36 月，8 段） ---------- */
  const AGE_BANDS = [
    { key: '0-3',   min: 0,  max: 3  },
    { key: '4-6',   min: 4,  max: 6  },
    { key: '7-9',   min: 7,  max: 9  },
    { key: '10-12', min: 10, max: 12 },
    { key: '13-18', min: 13, max: 18 },
    { key: '19-24', min: 19, max: 24 },
    { key: '25-30', min: 25, max: 30 },
    { key: '31-36', min: 31, max: 36 },
  ];

  /* ---------- 能力维度（7 维） ---------- */
  const SKILLS = [
    { key: 'gross',      name: '大运动' },
    { key: 'fine',       name: '精细动作' },
    { key: 'sensory',    name: '感官' },
    { key: 'language',   name: '语言' },
    { key: 'cognition',  name: '认知' },
    { key: 'social',     name: '社交情绪' },
    { key: 'creativity', name: '创造力' },
  ];

  /* ---------- 玩具类型 + 默认能力 + emoji ---------- */
  const TOY_TYPES = [
    { key: 'comfort',    name: '安抚/牙胶', icon: '🫶', defaultSkills: ['sensory', 'fine'] },
    { key: 'audiovisual', name: '视听玩具', icon: '🔊', defaultSkills: ['sensory', 'cognition'] },
    { key: 'motor',      name: '运动玩具', icon: '🏃', defaultSkills: ['gross'] },
    { key: 'stacking',   name: '堆叠/构建', icon: '🧱', defaultSkills: ['fine', 'cognition'] },
    { key: 'blocks',     name: '拼插积木', icon: '🧩', defaultSkills: ['fine', 'cognition', 'creativity'] },
    { key: 'roleplay',   name: '角色扮演', icon: '🧸', defaultSkills: ['social', 'creativity', 'language'] },
    { key: 'art',        name: '涂画手工', icon: '🎨', defaultSkills: ['fine', 'creativity'] },
    { key: 'music',      name: '音乐乐器', icon: '🎵', defaultSkills: ['sensory', 'social', 'language'] },
    { key: 'reading',    name: '绘本阅读', icon: '📚', defaultSkills: ['language', 'cognition'] },
  ];

  /* ---------- 专注时长基线（月龄段 -> 建议分钟） ---------- */
  const FOCUS = { '0-3': 3, '4-6': 4, '7-9': 4, '10-12': 5, '13-18': 6, '19-24': 8, '25-30': 10, '31-36': 12 };

  /* ---------- 工具 ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function monthBandKey(months) {
    for (let i = 0; i < AGE_BANDS.length; i++) {
      const b = AGE_BANDS[i];
      if (months >= b.min && months <= b.max) return b.key;
    }
    return months < 0 ? '0-3' : '31-36';
  }

  /* ---------- 月龄计算 ----------
   * computeAge(birthDate, now) -> { months, weeks, days, totalDays, label }
   *   - 满整月显示「X 岁 Y 个月」/「X 个月」
   *   - 不足 1 月但 ≥1 周显示「X 周」；不足 1 周显示「X 天」
   */
  function computeAge(birthInput, nowInput) {
    const birth = birthInput instanceof Date ? birthInput : new Date(birthInput);
    const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
    if (isNaN(birth.getTime())) {
      return { months: 0, weeks: 0, days: 0, totalDays: 0, label: '' };
    }
    // 未来出生日期：视为 0 天（防御性，避免负值）
    if (now < birth) {
      return { months: 0, weeks: 0, days: 0, totalDays: 0, label: '0天' };
    }

    // 总天数
    const totalDays = Math.floor((now - birth) / 86400000);

    // 满月数：整月计数
    let months = (now.getFullYear() - birth.getFullYear()) * 12
      + (now.getMonth() - birth.getMonth());
    // 若未到当月同日则减 1
    if (now.getDate() < birth.getDate()) months--;
    if (months < 0) months = 0;

    // 满月后剩余天数（用“满月天数”近似，仅用于展示周/天，整月主标签由 months 决定）
    const days = Math.max(0, totalDays - monthsToDays(months, birth));

    let weeks = Math.floor(days / 7);

    let label = '';
    if (months >= 12) {
      const years = Math.floor(months / 12);
      const rem = months % 12;
      label = rem > 0 ? years + '岁' + rem + '个月' : years + '岁整';
    } else if (months >= 1) {
      label = months + '个月';
    } else {
      if (weeks >= 1) label = weeks + '周';
      else label = totalDays + '天';
    }

    return { months, weeks, days, totalDays, label };
  }

  function monthsToDays(months, birth) {
    // 粗略月->天数：用于剩余天数的近似（足够展示用）
    let d = new Date(birth);
    for (let i = 0; i < months; i++) {
      d.setMonth(d.getMonth() + 1);
    }
    return Math.round((d - birth) / 86400000);
  }

  /* ---------- 能力解读文案 ---------- */
  const SKILL_PLAY = {
    gross: {
      name: '大运动',
      base: '锻炼头颈、躯干及四肢的大肌肉群，是坐、爬、站、走、跑、跳等里程碑的基础',
      bands: {
        '0-3':   '以俯卧抬头、竖抱、腿部蹬动为主（依据: CDC/AAP）',
        '4-6':   '引导翻身与趴着伸手够物，腿部踢蹬锻炼力量（依据: AAP）',
        '7-9':   '鼓励独立坐、匍匐爬行与四肢协调（依据: AAP）',
        '10-12': '扶站、扶走，锻炼平衡与腿部力量（依据: PIAGET/AAP）',
        '13-18': '独立学步、蹲起，提供安全空间多走多爬（依据: MONT）',
        '19-24': '跑、跨步、上下台阶，注意安全看护（依据: PLAY/AAP）',
        '25-30': '双脚跳、单脚站，提升平衡与协调（依据: MONT）',
        '31-36': '平衡走、原地跳、上下楼梯，运动变得更有目的（依据: AAP/PLAY）',
      },
      play: '大人随宝宝一起走跑跳，用口令和欢快语气带动；安全场地内充分活动。',
    },
    fine: {
      name: '精细动作',
      base: '锻炼手部小肌肉的抓、握、捏、拧、垒、画等能力',
      bands: {
        '0-3':   '抓握反射，可轻触小手促进抓握意识（依据: CDC/AAP）',
        '4-6':   '伸手抓物，双手持玩具、口部探索（依据: AAP）',
        '7-9':   '双手传递、手指按压探索，练习双手协同（依据: CDC）',
        '10-12': '两指钳捏取小物，锻炼指尖精细（依据: PIAGET/AAP）',
        '13-18': '垒高积木、翻书页，精细控制逐渐熟练（依据: MONT）',
        '19-24': '乱涂画、拧瓶盖、穿大珠，手眼协调增强（依据: MONT）',
        '25-30': '折纸、捏塑、用勺，动作更精细稳定（依据: MONT）',
        '31-36': '用笔画线条、扣扣子，精细动作接近成人小动作（依据: AAP/PLAY）',
      },
      play: '从大到小、由易到难，大人示范后鼓励宝宝自己尝试，多给成功体验。',
    },
    sensory: {
      name: '感官',
      base: '发展视、听、触、口部等感知，是认识世界的第一步',
      bands: {
        '0-3':   '黑白卡追视、柔和声音，触感安抚（依据: CDC/AAP）',
        '4-6':   '彩色玩具追视、抓握啃咬，多种材质感知（依据: AAP）',
        '7-9':   '不同材质、声音探索，感官更加敏锐（依据: AAP）',
        '10-12': '简单因果（按响、敲击有声），感知探索增强（依据: PIAGET）',
        '13-18': '触摸不同质感、观察移动物体（依据: MONT）',
        '19-24': '听辨声音、感受温度与质地（依据: PLAY）',
        '25-30': '感官游戏更丰富，参与制作与探索（依据: MONT）',
        '31-36': '多感官联动的游戏，如音乐+律动+扮演（依据: AAP/PLAY）',
      },
      play: '营造安全丰富的感官环境，观察宝宝兴趣，玩时伴随语言描述。',
    },
    language: {
      name: '语言',
      base: '接收性与表达性语言发展，包括发音、词汇与理解',
      bands: {
        '0-3':   '回应咿呀发声，多与宝宝说话、唱歌（依据: CDC/AAP）',
        '4-6':   '咿呀发声增多，模仿声音与口型（依据: AAP）',
        '7-9':   '指物、听懂简单指令，多示范指认（依据: CDC）',
        '10-12': '模仿声音、理解简单词，刻意指物命名（依据: PIAGET/AAP）',
        '13-18': '单字词爆发，多鼓励表达、命名日常物品（依据: PLAY/AAP）',
        '19-24': '双字词、简单句，通过绘本与指认扩展词汇（依据: PLAY）',
        '25-30': '三字句，讲简单故事、唱儿歌（依据: MONT）',
        '31-36': '叙事表达，问问题、复述小故事（依据: AAP/PLAY）',
      },
      play: '蹲下来看着宝宝，用清晰缓慢的语言描述眼前事物，给宝宝回应的时间。',
    },
    cognition: {
      name: '认知',
      base: '包括因果关系、客体永存、分类与解决问题的初步能力',
      bands: {
        '0-3':   '视觉追踪、寻找声源，建立基本注意（依据: CDC）',
        '4-6':   '开始探索因果，抓握摇晃观察（依据: PIAGET）',
        '7-9':   '物体消失又出现（客体永存），藏猫猫游戏（依据: PIAGET）',
        '10-12': '简单因果与容器取物，探索"里面-外面"（依据: PIAGET/AAP）',
        '13-18': '因果探索、分类起步，鼓励尝试与发现（依据: PIAGET/MONT）',
        '19-24': '配对、简单分类、套叠，问题解决增强（依据: PLAY）',
        '25-30': '三拼图、排序、假装脚本，逻辑更丰富（依据: MONT）',
        '31-36': '规则游戏、分类排序、简单计数概念（依据: AAP/PLAY）',
      },
      play: '提出"你试试看""为什么"类开放问题，让宝宝自己动手找答案。',
    },
    social: {
      name: '社交情绪',
      base: '依恋、情绪表达、平行游戏与联合游戏等社会性能力',
      bands: {
        '0-3':   '眼神对视、被拥抱微笑，建立依恋（依据: WHO/AAP）',
        '4-6':   '对人笑、咿呀互动，回应性照护（依据: WHO）',
        '7-9':   '陌生人焦虑初现，与家人互动更主动（依据: CDC）',
        '10-12': '模仿表情动作，喜欢亲子互动游戏（依据: PIAGET）',
        '13-18': '平行游戏，模仿同伴与成人（依据: PLAY）',
        '19-24': '平行游戏为主，情绪表达更丰富（依据: PLAY/AAP）',
        '25-30': '简单假装游戏，开始玩伴互动（依据: MONT）',
        '31-36': '联合游戏萌芽，学习等待与轮流（依据: AAP/PLAY）',
      },
      play: '多拥抱、肯定与回应，示范分享与轮流，游戏中的情绪都值得命名。',
    },
    creativity: {
      name: '创造力',
      base: '假装游戏、艺术表达与想象力的发展',
      bands: {
        '0-3':   '感知型探索为创造萌芽作准备（依据: WHO）',
        '4-6':   '用嘴与手探索发声、滚动物体（依据: AAP）',
        '7-9':   '探索不同玩法，重复中尝试变化（依据: PIAGET）',
        '10-12': '模仿动作、敲击节奏（依据: PIAGET/AAP）',
        '13-18': '涂鸦前奏、假装喝奶、给玩具喂食（依据: MONT）',
        '19-24': '乱涂画、搭"高楼"、简单角色扮演（依据: PLAY）',
        '25-30': '较丰富假装脚本、剪纸捏塑、编故事（依据: MONT）',
        '31-36': '联合假装游戏、创意手工与表演（依据: AAP/PLAY）',
      },
      play: '不纠正"对不对"，鼓励"还能怎么玩"，材料开放、允许自由发挥。',
    },
  };

  /* 玩具类型 → 玩法规劝（补充 playGuide） */
  const TYPE_PLAY = {
    comfort:    '安抚与啃咬满足口部探索，陪宝宝握着并轻轻哼唱，注意清洁与安全。',
    audiovisual: '面对面读图、指认颜色声音，配合表情夸张地讲述。',
    motor:      '在安全场地示范动作，用口令和游戏化方式带动。',
    stacking:   '先示范垒高再鼓励重建，描述"高""矮""上""下"。',
    blocks:     '一起从简单拼接到自由创作，鼓励"你搭了什么"。',
    roleplay:   '加入宝宝的假装剧本，扮演回应并扩展一点点情节。',
    art:        '提供安全颜料与纸张，展示过程而非评判结果。',
    music:      '打节拍、跟唱、随乐摆动，鼓励宝宝模仿节奏。',
    reading:    '共读指图命名，用夸张语气讲故事，鼓励宝宝翻页发声。',
  };

  /* ---------- 能力解读 ---------- */
  function skillInterpretation(skillKey, ageMonths) {
    const entry = SKILL_PLAY[skillKey];
    if (!entry) return { text: '', refId: '' };
    const bandKey = monthBandKey(ageMonths || 0);
    const bandNote = entry.bands[bandKey] || entry.bands['0-3'];
    const text = entry.base + '。'
      + bandNote + '。'
      + '陪玩建议：' + entry.play
      + '【个体差异】宝宝发育节奏各有不同，只要整体在进步，不必焦虑，不必与其他宝宝比较。';
    return { text, refId: bandNote.match(/依据:\s*([^)]+)\)/) ? bandNote.match(/依据:\s*([^)]+)\)/)[1] : (bandKey + '/AAP') };
  }

  /* 生成单条 playGuide */
  function buildPlayGuide(skillKey, toy) {
    const skEntry = SKILL_PLAY[skillKey];
    const typeNode = TOY_TYPES.find(function (t) { return t.key === toy.type; });
    const goal = skEntry ? skEntry.name + '｜' + skEntry.base : '';
    const how = (typeNode && TYPE_PLAY[typeNode.key]) ? TYPE_PLAY[typeNode.key] : '陪宝宝一起玩，多鼓励多回应。';
    return { goal: goal, how: how };
  }

  /* ---------- 玩耍历史聚合 ----------
   * analyzeLogs(logs, days=7, toys) -> { skillMinutes, totalMinutes }
   *   skillMinutes: { skillKey: 累计分钟 }
   */
  function analyzeLogs(logs, days, toys) {
    days = days || 7;
    toys = toys || [];
    const now = new Date();
    const cutoff = now - (days * 24 * 3600 * 1000);
    const skillMinutes = {};
    SKILLS.forEach(function (s) { skillMinutes[s.key] = 0; });
    const toyById = {};
    toys.forEach(function (t) { toyById[t.id] = t; });
    let totalMinutes = 0;
    (logs || []).forEach(function (log) {
      const playedAt = log.playedAt ? new Date(log.playedAt) : null;
      if (playedAt && playedAt.getTime() < cutoff) return;
      const toy = toyById[log.toyId];
      const mins = typeof log.minutes === 'number' && log.minutes > 0 ? log.minutes : 0;
      totalMinutes += mins;
      if (toy && toy.skills) {
        toy.skills.forEach(function (s) {
          if (skillMinutes[s] !== undefined) skillMinutes[s] += mins;
        });
      }
    });
    return { skillMinutes: skillMinutes, totalMinutes: totalMinutes };
  }

  /* 取玩具能力列表：优先源码字段，缺失时回退为对应类型默认能力 */
  function pickSkills(toy) {
    if (toy && Array.isArray(toy.skills) && toy.skills.length) return toy.skills;
    const node = TOY_TYPES.find(function (x) { return x.key === toy.type; });
    return (node && node.defaultSkills) || [];
  }

  /* ---------- 今日推荐算法 ----------
   * generateTodayPlan(profile, toys, logs) -> [{ toy, skillMain, minutes, playGuide, refId, nearAge }]
   */
  function generateTodayPlan(profile, toys, logs) {
    if (!profile || !profile.birthDate) return [];
    if (!toys || toys.length === 0) return [];

    const age = computeAge(profile.birthDate, new Date()).months;
    const ageClamped = Math.max(0, Math.min(36, age));
    const bandKey = monthBandKey(ageClamped);

    if (ageClamped > 36) return []; // 超出范围

    // 1. 候选过滤
    let candidates = toys.filter(function (t) {
      const lo = typeof t.ageMin === 'number' ? t.ageMin : 0;
      const hi = typeof t.ageMax === 'number' ? t.ageMax : 36;
      return ageClamped >= lo && ageClamped <= hi;
    });

    let nearAge = false;
    if (candidates.length === 0) {
      // 放宽：选取最接近当前月龄的 1 个
      nearAge = true;
      let best = null, bestDist = Infinity;
      toys.forEach(function (t) {
        const lo = typeof t.ageMin === 'number' ? t.ageMin : 0;
        const hi = typeof t.ageMax === 'number' ? t.ageMax : 36;
        let dist;
        if (ageClamped < lo) dist = lo - ageClamped;
        else if (ageClamped > hi) dist = ageClamped - hi;
        else dist = 0;
        if (dist < bestDist) { bestDist = dist; best = t; }
      });
      candidates = best ? [best] : [];
    }

    // 2. 能力权重：近 7 天锻炼较少的能力给更高权重（补短板）
    const hist = analyzeLogs(logs, 7, toys);
    const weights = {};
    const smooth = 1e-6;
    SKILLS.forEach(function (s) {
      const mins = hist.skillMinutes[s.key] || 0;
      // 权重与近期分钟数成反比：玩得越少权重越高；无历史时给基值 1.6
      weights[s.key] = mins <= 0 ? 1.6 : Math.max(0.4, 1.6 / (1 + mins / 8));
    });

    // 3. 多样性 + 补短板：贪婪选取 1~3 个
    const selected = [];
    const usedSkills = {};
    let pool = candidates.slice();
    while (selected.length < 3 && pool.length > 0) {
      let bestIdx = -1, bestGain = -Infinity;
      for (let i = 0; i < pool.length; i++) {
        const t = pool[i];
        const skills = pickSkills(t);
        let gain = 0;
        let hasNew = false;
        skills.forEach(function (s) {
          if (!usedSkills[s]) { gain += weights[s]; hasNew = true; }
          else { gain -= 0.3; /* 与已选重复略有惩罚 */ }
        });
        // 少量奖励使尽量多覆盖维度
        if (hasNew) gain += 0.2;
        if (gain > bestGain) { bestGain = gain; bestIdx = i; }
      }
      if (bestIdx < 0) break;
      const pick = pool[bestIdx];
      selected.push(pick);
      const pickedSkills = pickSkills(pick);
      pickedSkills.forEach(function (s) { usedSkills[s] = true; });
      pool.splice(bestIdx, 1);
    }

    if (selected.length === 0) return [];

    const focusMinutes = FOCUS[bandKey] || 5;

    return selected.map(function (toy) {
      // skillMain：优先选择当前权重最高（最需补短板）的维度
      const skills = pickSkills(toy);
      let skillMain = skills[0];
      let bestW = -Infinity;
      skills.forEach(function (s) {
        const w = weights[s] !== undefined ? weights[s] : 1;
        if (w > bestW) { bestW = w; skillMain = s; }
      });
      const interp = skillInterpretation(skillMain, ageClamped);
      const script = buildPlayGuide(skillMain, toy);
      return {
        toy: toy,
        skillMain: skillMain,
        minutes: focusMinutes,
        nearAge: nearAge,
        playGuide: {
          goal: script.goal,
          how: script.how,
          why: '今天优先安排近段时间锻炼较少的「' + (SKILLS.find(function (s) { return s.key === skillMain; }) || {}).name + '」维度，帮助能力均衡发展。',
        },
        refId: interp.refId,
        skillName: (SKILLS.find(function (s) { return s.key === skillMain; }) || {}).name,
      };
    });
  }

  /* ---------- 导出 ---------- */
  root.XNRules = {
    AGE_BANDS: AGE_BANDS,
    SKILLS: SKILLS,
    TOY_TYPES: TOY_TYPES,
    FOCUS: FOCUS,
    computeAge: computeAge,
    monthBandKey: monthBandKey,
    skillInterpretation: skillInterpretation,
    analyzeLogs: analyzeLogs,
    generateTodayPlan: generateTodayPlan,
    TYPE_PLAY: TYPE_PLAY,
    SKILL_PLAY: SKILL_PLAY,
  };
})(window);